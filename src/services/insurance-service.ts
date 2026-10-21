import { randomUUID } from 'node:crypto';
import type { EventSource, InsuranceStatus } from '@prisma/client';
import { canMoveInsurance, INSURANCE_LABELS, type InsuranceState } from '@/domain/insurance-state';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { env } from '@/lib/env';
import { addReview, syncRequirements } from './case-engine';
import { audit, notifyOrgMembers, notifyUsers, type Json } from './shared';

export interface InsuranceEventInput {
  caseId: string;
  providerKey: string;
  externalEventId: string;
  toStatus: InsuranceState;
  source: Extract<EventSource, 'PARTNER_WEBHOOK' | 'SIMULATION' | 'OPERATOR'>;
  actorUserId: string | null;
  note: string | null;
  evidenceDocumentId: string | null;
}

export type InsuranceIngestOutcome = 'PROCESSED' | 'DUPLICATE';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

// Verarbeitet ein Versicherungsereignis idempotent. Eine doppelte Zustellung (gleiche providerKey + externalEventId)
// scheitert am Unique-Index, die Transaktion wird zurückgerollt und nichts wird doppelt geschrieben.
export async function ingestInsuranceEvent(input: InsuranceEventInput): Promise<InsuranceIngestOutcome> {
  if (input.source === 'SIMULATION' && !env().DEMO_MODE) {
    throw new DomainError('FORBIDDEN', 'Simulierte Ereignisse sind im Produktivbetrieb nicht zulässig.');
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: {
          provider: input.providerKey,
          externalEventId: input.externalEventId,
          payload: { caseId: input.caseId, toStatus: input.toStatus, source: input.source } as Json,
          status: 'PROCESSED',
        },
      });
      await applyInsuranceStatus(tx, input);
    });
    return 'PROCESSED';
  } catch (error) {
    if (isUniqueViolation(error)) {
      return 'DUPLICATE';
    }
    throw error;
  }
}

async function applyInsuranceStatus(tx: Tx, input: InsuranceEventInput): Promise<void> {
  const request = await tx.insuranceRequest.findUnique({ where: { caseId: input.caseId } });
  if (!request) {
    throw new DomainError('NOT_FOUND', 'Für diesen Vorgang gibt es keine Versicherungsanfrage.');
  }
  const from = request.status as InsuranceState;
  if (!canMoveInsurance(from, input.toStatus)) {
    throw new DomainError('INVALID_TRANSITION', `Versicherungsstatus ${INSURANCE_LABELS[from]} kann nicht zu ${INSURANCE_LABELS[input.toStatus]} wechseln.`);
  }

  if (input.toStatus === 'CONFIRMED' && input.source === 'OPERATOR') {
    if (!input.evidenceDocumentId) {
      throw new DomainError('CONFLICT', 'Eine Bestätigung durch das Team braucht einen verifizierten Versicherungsnachweis.');
    }
    const evidence = await tx.document.findUnique({ where: { id: input.evidenceDocumentId } });
    if (!evidence || evidence.caseId !== input.caseId || evidence.kind !== 'INSURANCE_EVIDENCE' || evidence.status !== 'VERIFIED') {
      throw new DomainError('CONFLICT', 'Der Versicherungsnachweis ist nicht verifiziert oder gehört nicht zu diesem Vorgang.');
    }
  }

  await tx.insuranceRequest.update({
    where: { id: request.id },
    data: {
      status: input.toStatus as InsuranceStatus,
      evidenceDocumentId: input.evidenceDocumentId ?? request.evidenceDocumentId,
    },
  });
  await tx.insuranceStatusEvent.create({
    data: {
      insuranceRequestId: request.id,
      fromStatus: from,
      toStatus: input.toStatus,
      source: input.source,
      externalEventId: input.externalEventId,
      actorUserId: input.actorUserId,
      note: input.note,
    },
  });

  const caseRow = await tx.registrationCase.findUniqueOrThrow({
    where: { id: input.caseId },
    select: { organizationId: true, customerUserId: true },
  });
  const label = INSURANCE_LABELS[input.toStatus];
  const simulated = input.source === 'SIMULATION';
  const message = simulated ? `${label} (SIMULATION, keine reale Bestätigung)` : label;
  await tx.workflowEvent.create({
    data: {
      caseId: input.caseId,
      type: 'INSURANCE_STATUS_CHANGED',
      source: input.source,
      actorUserId: input.actorUserId,
      message,
      data: { from, to: input.toStatus, externalEventId: input.externalEventId } as Json,
    },
  });

  if (input.toStatus === 'PROBLEM') {
    await addReview(tx, {
      caseId: input.caseId,
      kind: 'EXCEPTION',
      title: 'Versicherungsproblem',
      detail: input.note ?? 'Die Versicherung hat ein Problem gemeldet.',
      openedBy: input.source,
    });
  }

  await syncRequirements(tx, input.caseId);

  await notifyUsers(tx, caseRow.customerUserId ? [caseRow.customerUserId] : [], {
    caseId: input.caseId,
    kind: 'INSURANCE_STATUS',
    title: 'Versicherungsstatus geändert',
    body: message,
  });
  await notifyOrgMembers(tx, caseRow.organizationId, {
    caseId: input.caseId,
    kind: 'INSURANCE_STATUS',
    title: 'Versicherungsstatus geändert',
    body: message,
  });

  await audit(tx, {
    actorUserId: input.actorUserId,
    organizationId: caseRow.organizationId,
    action: 'insurance.status_changed',
    entityType: 'InsuranceRequest',
    entityId: request.id,
    metadata: { from, to: input.toStatus, source: input.source, externalEventId: input.externalEventId },
  });
}

// Operator-Bestätigung mit verifiziertem Versicherungsnachweis (Option A: bestehende Versicherung).
export async function confirmInsuranceWithEvidence(
  actorUserId: string,
  caseId: string,
  evidenceDocumentId: string,
  note: string,
): Promise<void> {
  await ingestInsuranceEvent({
    caseId,
    providerKey: 'MANUAL_OPERATOR',
    externalEventId: `manual-${randomUUID()}`,
    toStatus: 'CONFIRMED',
    source: 'OPERATOR',
    actorUserId,
    note,
    evidenceDocumentId,
  });
}

// Demo: simuliert ein Ereignis des Demo-Versicherers. Nur im Demo-Modus, klar als Simulation markiert.
export async function simulateInsuranceEvent(actorUserId: string, caseId: string, toStatus: InsuranceState): Promise<void> {
  if (!env().DEMO_MODE) {
    throw new DomainError('FORBIDDEN', 'Simulationen sind nur im Demo-Modus verfügbar.');
  }
  await ingestInsuranceEvent({
    caseId,
    providerKey: 'DEMO_INSURER',
    externalEventId: `sim-${randomUUID()}`,
    toStatus,
    source: 'SIMULATION',
    actorUserId,
    note: 'Demo-Simulation',
    evidenceDocumentId: null,
  });
}
