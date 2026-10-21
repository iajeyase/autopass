import { randomUUID } from 'node:crypto';
import type { AuthorityResponseKind, EventSource } from '@prisma/client';
import { type ActorSource } from '@/domain/case-state';
import { referenceSchema } from '@/domain/schemas';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { env } from '@/lib/env';
import { type Actor, assertOperator } from '@/auth/policy';
import { addReview, enqueueTask, loadCase, syncRequirements, transitionCase } from './case-engine';
import { audit, notifyOrgMembers, notifyUsers, type Json } from './shared';

// Startet die Einreichung. Der Versand selbst erfolgt im MVP manuell; die Aufgabe prüft zuerst,
// ob eine verifizierte Schnittstelle existiert (siehe worker.ts).
export async function startSubmission(actor: Actor, caseId: string): Promise<{ submissionId: string }> {
  assertOperator(actor);
  return db.$transaction(async (tx) => {
    const row = await loadCase(tx, caseId);
    await transitionCase(tx, {
      caseId,
      to: 'SUBMITTED',
      source: 'OPERATOR',
      actorUserId: actor.userId,
      message: 'Einreichung bei der zuständigen Stelle wurde durch das Team veranlasst.',
    });
    const snapshot = await buildSubmissionSnapshot(tx, caseId);
    const submission = await tx.authoritySubmission.create({
      data: {
        caseId,
        status: 'PREPARED',
        channel: 'MANUAL_OR_INTERFACE',
        preparedById: actor.userId,
        payload: snapshot as Json,
      },
    });
    await enqueueTask(tx, {
      caseId,
      type: 'PREPARE_AUTHORITY_SUBMISSION',
      idempotencyKey: `authority-submission:${submission.id}`,
      payload: { submissionId: submission.id, simulateTransientFailures: 0 },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: row.organizationId,
      action: 'submission.started',
      entityType: 'AuthoritySubmission',
      entityId: submission.id,
    });
    return { submissionId: submission.id };
  });
}

async function buildSubmissionSnapshot(tx: Tx, caseId: string): Promise<Record<string, unknown>> {
  const row = await tx.registrationCase.findUniqueOrThrow({ where: { id: caseId } });
  const [vehicle, sale, requirements, insurance, documents, profile] = await Promise.all([
    tx.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId } }),
    tx.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId } }),
    tx.caseRequirement.findMany({ where: { caseId }, select: { ruleKey: true, status: true, verification: true } }),
    tx.insuranceRequest.findUnique({ where: { caseId }, select: { status: true, externalReference: true } }),
    tx.document.findMany({
      where: { caseId, status: 'VERIFIED' },
      select: { id: true, kind: true, title: true },
    }),
    tx.customerProfile.findUnique({ where: { userId: row.customerUserId ?? '00000000-0000-0000-0000-000000000000' } }),
  ]);
  return {
    caseId,
    canton: row.canton,
    caseType: row.caseType,
    vin: vehicle.vin,
    make: vehicle.make,
    model: vehicle.model,
    isNew: vehicle.isNew,
    holderName: sale.buyerName,
    holderAddress: profile ? { street: profile.street, zip: profile.zip, city: profile.city } : null,
    requirements,
    insurance,
    verifiedDocuments: documents,
    capturedAt: new Date().toISOString(),
  };
}

// Operator erfasst die Einreichungs- oder Versandreferenz nach manueller Einreichung.
export async function recordManualSubmission(actor: Actor, submissionId: string, reference: string): Promise<void> {
  assertOperator(actor);
  const ref = referenceSchema.parse(reference);
  await db.$transaction(async (tx) => {
    const submission = await tx.authoritySubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new DomainError('NOT_FOUND', 'Die Einreichung wurde nicht gefunden.');
    }
    if (submission.status !== 'QUEUED_MANUAL' && submission.status !== 'PREPARED') {
      throw new DomainError('CONFLICT', 'Diese Einreichung ist bereits erfasst.');
    }
    await tx.authoritySubmission.update({
      where: { id: submissionId },
      data: { status: 'SUBMITTED', channelReference: ref, submittedAt: new Date() },
    });
    await tx.workflowEvent.create({
      data: {
        caseId: submission.caseId,
        type: 'SUBMISSION_RECORDED',
        source: 'OPERATOR',
        actorUserId: actor.userId,
        message: `Manuelle Einreichung erfasst, Referenz ${ref}.`,
      },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'submission.recorded',
      entityType: 'AuthoritySubmission',
      entityId: submissionId,
      metadata: { reference: ref },
    });
  });
}

export interface AuthorityResponseInput {
  caseId: string;
  kind: AuthorityResponseKind;
  source: Extract<EventSource, 'OPERATOR' | 'PARTNER_WEBHOOK' | 'SIMULATION'>;
  reference: string | null;
  note: string | null;
  externalEventId: string | null;
}

export type AuthorityIngestOutcome = 'PROCESSED' | 'DUPLICATE';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

// Verarbeitet eine behördliche Antwort. Eine Zulassungsbestätigung wird nur aus einer Operator-Erfassung
// mit Referenz, einem verifizierten Partnerereignis oder einer ausdrücklich markierten Simulation akzeptiert.
export async function recordAuthorityResponse(actor: Actor | null, input: AuthorityResponseInput): Promise<AuthorityIngestOutcome> {
  if (input.source === 'SIMULATION' && !env().DEMO_MODE) {
    throw new DomainError('FORBIDDEN', 'Simulierte Behördenantworten sind im Produktivbetrieb nicht zulässig.');
  }
  if (input.source === 'OPERATOR') {
    if (!actor) {
      throw new DomainError('UNAUTHENTICATED', 'Bitte melden Sie sich an.');
    }
    assertOperator(actor);
    referenceSchema.parse(input.reference ?? '');
  }
  if (input.source === 'PARTNER_WEBHOOK' && !input.externalEventId) {
    throw new DomainError('VALIDATION', 'Partnerereignisse brauchen eine eindeutige Ereignis-ID.');
  }

  try {
    await db.$transaction(async (tx) => {
      await applyAuthorityResponse(tx, input, actor?.userId ?? null);
    });
    return 'PROCESSED';
  } catch (error) {
    if (isUniqueViolation(error) && input.externalEventId) {
      return 'DUPLICATE';
    }
    throw error;
  }
}

async function applyAuthorityResponse(tx: Tx, input: AuthorityResponseInput, actorUserId: string | null): Promise<void> {
  const row = await loadCase(tx, input.caseId);
  const latestSubmission = await tx.authoritySubmission.findFirst({
    where: { caseId: input.caseId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const source = input.source as ActorSource;

  const response = await tx.authorityResponse.create({
    data: {
      caseId: input.caseId,
      submissionId: latestSubmission?.id ?? null,
      kind: input.kind,
      source: input.source,
      reference: input.reference,
      externalEventId: input.externalEventId,
      recordedById: actorUserId,
      note: input.note,
    },
  });

  const label = input.source === 'SIMULATION' ? ' (SIMULATION, keine reale Behördenbestätigung)' : '';

  switch (input.kind) {
    case 'ACKNOWLEDGED': {
      await transitionCase(tx, {
        caseId: input.caseId,
        to: 'AUTHORITY_PROCESSING',
        source,
        actorUserId,
        message: `Eingangsbestätigung der zuständigen Stelle erfasst${label}.`,
      });
      break;
    }
    case 'REGISTRATION_CONFIRMED': {
      if (row.status !== 'AUTHORITY_PROCESSING') {
        throw new DomainError('CONFLICT', 'Eine Zulassungsbestätigung ist erst nach der Eingangsbestätigung möglich.');
      }
      await transitionCase(tx, {
        caseId: input.caseId,
        to: 'PLATES_AND_ORIGINALS',
        source,
        actorUserId,
        message: `Behördliche Zulassungsbestätigung erfasst${label}.`,
        data: { reference: input.reference, responseId: response.id } as Json,
      });
      break;
    }
    case 'MORE_DOCUMENTS_REQUESTED': {
      if (input.source === 'SIMULATION') {
        throw new DomainError('INVALID_TRANSITION', 'Diese Simulation ist für Nachforderungen nicht vorgesehen.');
      }
      await transitionCase(tx, {
        caseId: input.caseId,
        to: 'PREPARATION',
        source,
        actorUserId,
        message: 'Die zuständige Stelle fordert zusätzliche Unterlagen an.',
      });
      await addReview(tx, {
        caseId: input.caseId,
        kind: 'MANUAL_CHECK',
        title: 'Behörde fordert zusätzliche Unterlagen',
        detail: input.note ?? 'Details aus der Behördenantwort prüfen.',
        openedBy: input.source,
      });
      break;
    }
    case 'REJECTED': {
      await transitionCase(tx, {
        caseId: input.caseId,
        to: 'ON_HOLD',
        source: input.source === 'OPERATOR' ? 'OPERATOR' : 'SYSTEM',
        actorUserId,
        message: `Behördliche Ablehnung erfasst${label}. Der Fall ist pausiert.`,
      });
      await addReview(tx, {
        caseId: input.caseId,
        kind: 'EXCEPTION',
        title: 'Behördliche Ablehnung',
        detail: input.note ?? 'Ablehnung prüfen und weiteres Vorgehen festlegen.',
        openedBy: input.source,
      });
      break;
    }
  }

  await syncRequirements(tx, input.caseId);

  const customer = row.customerUserId ? [row.customerUserId] : [];
  await notifyUsers(tx, customer, {
    caseId: input.caseId,
    kind: 'AUTHORITY_RESPONSE',
    title: 'Neuer Stand bei der zuständigen Stelle',
    body: `Behördenantwort: ${input.kind}${label}`,
  });
  await notifyOrgMembers(tx, row.organizationId, {
    caseId: input.caseId,
    kind: 'AUTHORITY_RESPONSE',
    title: 'Neuer Stand bei der zuständigen Stelle',
    body: `Behördenantwort: ${input.kind}${label}`,
  });
  await audit(tx, {
    actorUserId,
    organizationId: row.organizationId,
    action: 'authority.response_recorded',
    entityType: 'AuthorityResponse',
    entityId: response.id,
    metadata: { kind: input.kind, source: input.source, reference: input.reference },
  });
}

// Vorläufige Verkehrsberechtigung: nur von der Behörde ausgestellt und manuell erfasst.
// Das System leitet sie nie selbst ab und ändert den Fallstatus nicht.
export async function recordTemporaryAuthorization(
  actor: Actor,
  input: { caseId: string; reference: string; validUntil: Date | null; documentId: string | null },
): Promise<void> {
  assertOperator(actor);
  const ref = referenceSchema.parse(input.reference);
  if (!input.documentId) {
    throw new DomainError('CONFLICT', 'Eine vorläufige Berechtigung braucht den Beleg der Behörde.');
  }
  await db.$transaction(async (tx) => {
    const row = await loadCase(tx, input.caseId);
    if (row.status !== 'AUTHORITY_PROCESSING' && row.status !== 'PLATES_AND_ORIGINALS') {
      throw new DomainError('CONFLICT', 'Eine vorläufige Berechtigung kann nur während der behördlichen Bearbeitung erfasst werden.');
    }
    const document = await tx.document.findUnique({ where: { id: input.documentId! } });
    if (!document || document.caseId !== input.caseId || document.status !== 'VERIFIED') {
      throw new DomainError('CONFLICT', 'Der Beleg ist nicht verifiziert oder gehört nicht zu diesem Vorgang.');
    }
    const record = await tx.temporaryAuthorization.create({
      data: {
        caseId: input.caseId,
        reference: ref,
        validUntil: input.validUntil,
        documentId: input.documentId,
        source: 'OPERATOR',
        recordedById: actor.userId,
      },
    });
    await tx.workflowEvent.create({
      data: {
        caseId: input.caseId,
        type: 'TEMPORARY_AUTHORIZATION_RECORDED',
        source: 'OPERATOR',
        actorUserId: actor.userId,
        message: `Vorläufige Berechtigung der Behörde erfasst, Referenz ${ref}.`,
      },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: row.organizationId,
      action: 'temporary_authorization.recorded',
      entityType: 'TemporaryAuthorization',
      entityId: record.id,
    });
  });
}

// Demo: simuliert eine Behördenantwort. Nur Demo-Modus, klar als Simulation markiert.
export async function simulateAuthorityResponse(actor: Actor, caseId: string, kind: AuthorityResponseKind): Promise<void> {
  assertOperator(actor);
  if (!env().DEMO_MODE) {
    throw new DomainError('FORBIDDEN', 'Simulationen sind nur im Demo-Modus verfügbar.');
  }
  await recordAuthorityResponse(actor, {
    caseId,
    kind,
    source: 'SIMULATION',
    reference: null,
    note: 'Demo-Simulation',
    externalEventId: `sim-${randomUUID()}`,
  });
}
