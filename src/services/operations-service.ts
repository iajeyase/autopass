import type { CaseState } from '@/domain/case-state';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { assertOperator, membershipIn, type Actor } from '@/auth/policy';
import { reasonSchema } from '@/domain/schemas';
import { transitionCase } from './case-engine';
import { audit } from './shared';

// Operator wechselt den Fallstatus mit Begründung. Alle Guards greifen wie im Workflow-Kern.
export async function operatorMove(actor: Actor, caseId: string, to: CaseState, message: string): Promise<void> {
  assertOperator(actor);
  await db.$transaction((tx) => transitionCase(tx, { caseId, to, source: 'OPERATOR', actorUserId: actor.userId, message }));
}

// Übergabe-Prüfung: Fall wird übergabebereit, sofern das Gate nicht blockiert.
export async function operatorHandoverCheck(actor: Actor, caseId: string): Promise<void> {
  await operatorMove(actor, caseId, 'HANDOVER_RELEASABLE', 'Übergabe-Prüfung durchgeführt, Fall ist übergabebereit.');
}

export async function pauseCase(actor: Actor, caseId: string, reason: string): Promise<void> {
  assertOperator(actor);
  const text = reasonSchema.parse(reason);
  await db.$transaction((tx) =>
    transitionCase(tx, { caseId, to: 'ON_HOLD', source: 'OPERATOR', actorUserId: actor.userId, message: `Fall pausiert: ${text}`, data: { reason: text } }),
  );
}

// Schliesst eine offene Prüfung mit Ergebnis. Protokolliert im Workflow und Audit-Log.
export async function resolveReview(actor: Actor, reviewId: string, resolution: string): Promise<void> {
  assertOperator(actor);
  const text = reasonSchema.parse(resolution);
  await db.$transaction(async (tx) => {
    const review = await tx.reviewItem.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== 'OPEN') {
      throw new DomainError('CONFLICT', 'Diese Prüfung ist nicht mehr offen.');
    }
    await tx.reviewItem.update({
      where: { id: reviewId },
      data: { status: 'RESOLVED', resolution: text, resolvedById: actor.userId, resolvedAt: new Date() },
    });
    await tx.workflowEvent.create({
      data: {
        caseId: review.caseId,
        type: 'REVIEW_RESOLVED',
        source: 'OPERATOR',
        actorUserId: actor.userId,
        message: `Prüfung "${review.title}" erledigt: ${text}`,
      },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'review.resolved',
      entityType: 'ReviewItem',
      entityId: reviewId,
      metadata: { resolution: text },
    });
  });
}

// Händler bestätigt die tatsächliche Übergabe. Danach schliesst das System den Fall.
export async function confirmHandover(actor: Actor, caseId: string): Promise<void> {
  const row = await db.registrationCase.findUnique({ where: { id: caseId }, select: { organizationId: true } });
  if (!row || !membershipIn(actor, row.organizationId)) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  await db.$transaction(async (tx) => {
    await transitionCase(tx, {
      caseId,
      to: 'HANDED_OVER',
      source: 'DEALER',
      actorUserId: actor.userId,
      message: 'Fahrzeugübergabe durch den Händler bestätigt.',
    });
    await transitionCase(tx, { caseId, to: 'CLOSED', source: 'SYSTEM', actorUserId: null, message: 'Zulassungsfall abgeschlossen.' });
  });
}
