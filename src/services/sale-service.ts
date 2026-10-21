import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { generateToken, sha256Hex } from '@/lib/security';
import { classifyCase } from '@/domain/case-classification';
import { CANTONS } from '@/domain/cantons';
import { customerProfileSchema, type SaleInput, confirmPurchaseSchema } from '@/domain/schemas';
import type { Actor } from '@/auth/policy';
import { assertCaseAccess, assertOrgMember } from '@/auth/policy';
import { sendEmail } from '@/adapters/notifications/email';
import { addReview, planCase, transitionCase } from './case-engine';
import { audit, notifyOrgMembers, type Json } from './shared';

const INVITE_TTL_DAYS = 14;
const CLOSED_STATES = ['CLOSED', 'CANCELLED'] as const;

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

// Dealer erfasst einen Verkauf. Erstellt Fahrzeug (wiederverwendet bei gleicher VIN) und Zulassungsfall.
export async function createSale(actor: Actor, organizationId: string, input: SaleInput): Promise<{ caseId: string }> {
  assertOrgMember(actor, organizationId);
  const membership = actor.memberships.find((m) => m.organizationId === organizationId);
  if (membership?.organizationType !== 'DEALER') {
    throw new DomainError('FORBIDDEN', 'Verkäufe können nur von Händler-Organisationen erfasst werden.');
  }

  const classification = classifyCase({
    isNewVehicle: input.vehicleKind === 'NEW',
    plateSituation: input.plateSituation,
  });

  return db.$transaction(async (tx) => {
    const vehicle =
      (await tx.vehicle.findUnique({ where: { organizationId_vin: { organizationId, vin: input.vin } } })) ??
      (await tx.vehicle.create({
        data: {
          organizationId,
          vin: input.vin,
          make: input.make,
          model: input.model,
          variant: input.variant || null,
          isNew: input.vehicleKind === 'NEW',
          isImport: input.isImport,
          firstRegistrationDate: parseDate(input.firstRegistrationDate),
          mileageKm: input.mileageKm ?? null,
          previousRegistration: input.previousRegistration,
          previousCanton: input.previousRegistration === 'SWISS_CANTON' ? input.previousCanton || null : null,
        },
      }));

    const activeCase = await tx.registrationCase.findFirst({
      where: { vehicleId: vehicle.id, status: { notIn: [...CLOSED_STATES] } },
      select: { id: true },
    });
    if (activeCase) {
      throw new DomainError('CONFLICT', 'Für dieses Fahrzeug läuft bereits ein Vorgang.', { vin: 'Fahrzeug bereits im Prozess.' });
    }

    const sale = await tx.vehicleSale.create({
      data: {
        organizationId,
        vehicleId: vehicle.id,
        createdById: actor.userId,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        isCompanyBuyer: input.isCompanyBuyer,
        canton: input.canton,
        saleDate: parseDate(input.saleDate) ?? new Date(),
        plannedHandoverDate: parseDate(input.plannedHandoverDate),
        priceChf: input.priceChf ?? null,
      },
    });

    const created = await tx.registrationCase.create({
      data: {
        organizationId,
        saleId: sale.id,
        vehicleId: vehicle.id,
        canton: input.canton,
        caseType: classification.caseType,
        plateSituation: input.plateSituation,
        status: 'SALE_CREATED',
        nextAction: 'Käufer einladen',
      },
    });

    await tx.workflowEvent.create({
      data: {
        caseId: created.id,
        type: 'CASE_CREATED',
        toStatus: 'SALE_CREATED',
        source: 'DEALER',
        actorUserId: actor.userId,
        message: `Fall erstellt. ${classification.reason}`,
        data: { caseType: classification.caseType } as Json,
      },
    });

    if (classification.requiresManualReview) {
      await addReview(tx, {
        caseId: created.id,
        kind: 'MANUAL_CHECK',
        title: 'Fallklassifikation prüfen',
        detail: classification.reason,
        openedBy: 'SYSTEM',
      });
    }

    await audit(tx, {
      actorUserId: actor.userId,
      organizationId,
      action: 'sale.created',
      entityType: 'RegistrationCase',
      entityId: created.id,
      metadata: { caseType: classification.caseType, canton: input.canton },
    });

    return { caseId: created.id };
  });
}

// Erzeugt einen Einladungslink. Der Klartext-Token wird nur einmal zurückgegeben; gespeichert wird der Hash.
export async function createInvitation(actor: Actor, caseId: string): Promise<{ url: string; expiresAt: Date }> {
  const row = await db.registrationCase.findUnique({ where: { id: caseId }, select: { organizationId: true, status: true, saleId: true } });
  if (!row) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  assertOrgMember(actor, row.organizationId);
  if (row.status !== 'SALE_CREATED' && row.status !== 'INVITED') {
    throw new DomainError('CONFLICT', 'Für diesen Vorgang kann keine Einladung mehr erzeugt werden.');
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const sale = await db.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId }, select: { buyerEmail: true } });

  await db.$transaction(async (tx) => {
    await tx.vehicleSale.update({
      where: { id: row.saleId },
      data: { inviteTokenHash: sha256Hex(token), inviteExpiresAt: expiresAt, invitedAt: new Date() },
    });
    if (row.status === 'SALE_CREATED') {
      await transitionCase(tx, {
        caseId,
        to: 'INVITED',
        source: 'DEALER',
        actorUserId: actor.userId,
        message: 'Käufer wurde eingeladen.',
      });
    }
    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: row.organizationId,
      action: 'invitation.created',
      entityType: 'VehicleSale',
      entityId: row.saleId,
      metadata: { expiresAt: expiresAt.toISOString() },
    });
  });

  await sendEmail({
    to: sale.buyerEmail,
    subject: 'Ihr Fahrzeug ist bereit für die Zulassung',
    body: 'Ein Händler hat Ihnen einen Zulassungsvorgang zur Bestätigung bereitgestellt.',
  });

  return { url: `${env().APP_BASE_URL}/einladung/${token}`, expiresAt };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain ?? ''}`;
}

export interface InvitationPreview {
  dealerName: string;
  make: string;
  model: string;
  canton: string;
  cantonName: string;
  saleDate: Date;
  // Nur ein Hinweis, z. B. j***@example.ch. Die vollständige Adresse bleibt verborgen.
  buyerEmailHint: string;
}

// Öffentliche Vorschau. Zeigt nur die Verkaufsdaten, keine Dokumente.
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const sale = await db.vehicleSale.findUnique({
    where: { inviteTokenHash: sha256Hex(token) },
    include: { vehicle: true, organization: true },
  });
  if (!sale || !sale.inviteExpiresAt || sale.inviteExpiresAt.getTime() < Date.now()) {
    return null;
  }
  return {
    dealerName: sale.organization.name,
    make: sale.vehicle.make,
    model: sale.vehicle.model,
    canton: sale.canton,
    cantonName: CANTONS[sale.canton as keyof typeof CANTONS] ?? sale.canton,
    saleDate: sale.saleDate,
    buyerEmailHint: maskEmail(sale.buyerEmail),
  };
}

// Verknüpft den angemeldeten Käufer mit dem Vorgang. Nur wenn die E-Mail-Adresse übereinstimmt.
export async function acceptInvitation(actor: Actor, token: string): Promise<{ caseId: string }> {
  const sale = await db.vehicleSale.findUnique({
    where: { inviteTokenHash: sha256Hex(token) },
    include: { case: true },
  });
  if (!sale || !sale.case || !sale.inviteExpiresAt || sale.inviteExpiresAt.getTime() < Date.now()) {
    throw new DomainError('NOT_FOUND', 'Die Einladung ist ungültig, abgelaufen oder bereits verwendet.');
  }
  if (sale.buyerEmail.toLowerCase() !== actor.email.toLowerCase()) {
    throw new DomainError('FORBIDDEN', 'Diese Einladung wurde für eine andere E-Mail-Adresse ausgestellt.');
  }

  await db.$transaction(async (tx) => {
    await tx.vehicleSale.update({
      where: { id: sale.id },
      data: { buyerUserId: actor.userId, inviteTokenHash: null },
    });
    await tx.registrationCase.update({
      where: { id: sale.case!.id },
      data: { customerUserId: actor.userId },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: sale.organizationId,
      action: 'invitation.accepted',
      entityType: 'VehicleSale',
      entityId: sale.id,
    });
    await notifyOrgMembers(tx, sale.organizationId, {
      caseId: sale.case!.id,
      kind: 'INVITATION_ACCEPTED',
      title: 'Käufer hat die Einladung geöffnet',
      body: `${sale.buyerName} hat den Vorgang geöffnet.`,
    });
  });

  return { caseId: sale.case.id };
}

// Käufer bestätigt die Angaben. Ausdrücklich eine Prozessbestätigung, kein Kaufvertrag.
export async function confirmPurchase(actor: Actor, caseId: string, input: unknown): Promise<void> {
  confirmPurchaseSchema.parse(input);
  const owned = await db.registrationCase.findUnique({ where: { id: caseId }, select: { customerUserId: true } });
  if (!owned || owned.customerUserId !== actor.userId) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }

  await db.$transaction(async (tx) => {
    const caseRow = await tx.registrationCase.findUniqueOrThrow({ where: { id: caseId } });
    const [sale, vehicle, organization] = await Promise.all([
      tx.vehicleSale.findUniqueOrThrow({ where: { id: caseRow.saleId } }),
      tx.vehicle.findUniqueOrThrow({ where: { id: caseRow.vehicleId } }),
      tx.organization.findUniqueOrThrow({ where: { id: caseRow.organizationId } }),
    ]);
    const snapshot = {
      sellerName: organization.name,
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      isNew: vehicle.isNew,
      canton: caseRow.canton,
      buyerName: sale.buyerName,
      buyerEmail: sale.buyerEmail,
      saleDate: sale.saleDate.toISOString().slice(0, 10),
      plannedHandoverDate: sale.plannedHandoverDate?.toISOString().slice(0, 10) ?? null,
      priceChf: sale.priceChf,
      confirmedAt: new Date().toISOString(),
    };
    await tx.purchaseConfirmation.create({
      data: {
        saleId: caseRow.saleId,
        confirmedByUserId: actor.userId,
        textVersion: 'PB-2026-01',
        dataConsent: true,
        snapshot: snapshot as Json,
      },
    });
    await transitionCase(tx, {
      caseId,
      to: 'PURCHASE_CONFIRMED',
      source: 'CUSTOMER',
      actorUserId: actor.userId,
      message: 'Käufer hat die Prozessbestätigung abgegeben.',
    });
    await transitionCase(tx, {
      caseId,
      to: 'PREPARATION',
      source: 'SYSTEM',
      actorUserId: null,
      message: 'Zulassungsanforderungen werden ermittelt.',
    });
    await planCase(tx, caseId);
    await notifyOrgMembers(tx, caseRow.organizationId, {
      caseId,
      kind: 'PURCHASE_CONFIRMED',
      title: 'Kaufangaben bestätigt',
      body: `${sale.buyerName} hat die Angaben bestätigt. Der Vorgang ist in Vorbereitung.`,
    });
    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: caseRow.organizationId,
      action: 'purchase.confirmed',
      entityType: 'PurchaseConfirmation',
      entityId: caseRow.saleId,
      metadata: { textVersion: 'PB-2026-01' },
    });
  });
}

export async function saveCustomerProfile(actor: Actor, input: unknown): Promise<void> {
  const parsed = customerProfileSchema.parse(input);
  await db.customerProfile.upsert({
    where: { userId: actor.userId },
    create: {
      userId: actor.userId,
      phone: parsed.phone || null,
      street: parsed.street,
      zip: parsed.zip,
      city: parsed.city,
      canton: parsed.canton,
    },
    update: {
      phone: parsed.phone || null,
      street: parsed.street,
      zip: parsed.zip,
      city: parsed.city,
      canton: parsed.canton,
    },
  });
}

// Customer meldet die Unterlagen als vollständig. Prüft zuerst, ob alle geforderten Dokumentarten vorliegen.
export async function submitDocumentsForReview(actor: Actor, caseId: string): Promise<void> {
  const owned = await db.registrationCase.findUnique({ where: { id: caseId }, select: { customerUserId: true, organizationId: true } });
  if (!owned || owned.customerUserId !== actor.userId) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  await db.$transaction(async (tx) => {
    const open = await tx.caseRequirement.findMany({
      where: { caseId, status: 'OPEN', documentKind: { not: null } },
      select: { title: true, documentKind: true },
    });
    const uploaded = await tx.document.findMany({
      where: { caseId, status: { in: ['UPLOADED', 'VERIFIED'] } },
      select: { kind: true },
    });
    const uploadedKinds = new Set(uploaded.map((d) => d.kind));
    const missing = open.filter((r) => r.documentKind && !uploadedKinds.has(r.documentKind));
    if (missing.length > 0) {
      throw new DomainError('CONFLICT', `Es fehlen noch Unterlagen: ${missing.map((m) => m.title).join(', ')}.`);
    }
    const profile = await tx.customerProfile.findUnique({ where: { userId: actor.userId } });
    if (!profile || !profile.street || !profile.zip || !profile.city) {
      throw new DomainError('CONFLICT', 'Bitte ergänzen Sie zuerst Ihre Adressangaben.');
    }
    await transitionCase(tx, {
      caseId,
      to: 'REVIEW',
      source: 'CUSTOMER',
      actorUserId: actor.userId,
      message: 'Unterlagen eingereicht. Das AutoPass-Team prüft sie.',
    });
    await notifyOrgMembers(tx, owned.organizationId, {
      caseId,
      kind: 'DOCUMENTS_SUBMITTED',
      title: 'Unterlagen eingereicht',
      body: 'Der Käufer hat die Unterlagen eingereicht. Die Prüfung läuft.',
    });
  });
}

export async function assertCustomerOfCase(actor: Actor, caseId: string): Promise<void> {
  const row = await db.registrationCase.findUnique({ where: { id: caseId }, select: { organizationId: true, customerUserId: true } });
  if (!row) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  assertCaseAccess(actor, row);
}
