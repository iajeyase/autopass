import type { WorkflowTask } from '@prisma/client';
import { demoInsuranceAdapter } from '@/adapters/insurance/demo-insurance';
import { getAuthorityAdapter } from '@/adapters/authority/authority-adapter';
import type { AdapterOutcome } from '@/adapters/types';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { type Actor, assertOperator } from '@/auth/policy';
import { addReview } from './case-engine';
import { audit, type Json } from './shared';

export interface WorkerOptions {
  now?: Date;
  limit?: number;
  // Basis des exponentiellen Backoffs in Millisekunden (Standard 30 s)
  retryBaseMs?: number;
}

export interface WorkerRunSummary {
  claimed: number;
  done: number;
  retried: number;
  deadLettered: number;
}

class RetryableTaskError extends Error {}

const STALE_RUNNING_MS = 10 * 60 * 1000;

// Verarbeitet fällige Aufgaben. Jede Aufgabe wird vorher atomar beansprucht (PENDING -> RUNNING),
// damit mehrere Worker sich nicht gegenseitig ausführen.
export async function processDueTasks(options: WorkerOptions = {}): Promise<WorkerRunSummary> {
  const now = options.now ?? new Date();
  const retryBaseMs = options.retryBaseMs ?? 30_000;
  const summary: WorkerRunSummary = { claimed: 0, done: 0, retried: 0, deadLettered: 0 };

  // Hängende Aufgaben (Worker abgestürzt) zurück in die Warteschlange.
  await db.workflowTask.updateMany({
    where: { status: 'RUNNING', updatedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } },
    data: { status: 'PENDING', nextRunAt: now },
  });

  const due = await db.workflowTask.findMany({
    where: { status: 'PENDING', nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
    take: options.limit ?? 20,
  });

  for (const candidate of due) {
    const claimed = await db.workflowTask.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: { status: 'RUNNING', attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      continue;
    }
    summary.claimed += 1;
    const task = { ...candidate, attempts: candidate.attempts + 1 };

    try {
      await runTask(task);
      summary.done += 1;
    } catch (error) {
      if (error instanceof RetryableTaskError) {
        const outcome = await scheduleRetryOrDeadLetter(task, error.message, now, retryBaseMs);
        if (outcome === 'DEAD_LETTER') {
          summary.deadLettered += 1;
        } else {
          summary.retried += 1;
        }
      } else {
        // Unerwarteter Fehler: sofort in Dead Letter, damit er sichtbar wird.
        await moveToDeadLetter(task, error instanceof Error ? error.message : 'Unbekannter Fehler');
        summary.deadLettered += 1;
      }
    }
  }
  return summary;
}

async function runTask(task: WorkflowTask): Promise<void> {
  switch (task.type) {
    case 'REQUEST_INSURANCE':
      return runInsuranceRequest(task);
    case 'PREPARE_AUTHORITY_SUBMISSION':
      return runAuthoritySubmission(task);
  }
}

function unwrapOutcome<T>(outcome: AdapterOutcome<T>): { ok: true; value: T } | { ok: false; reason: string; retryable: boolean } {
  if (outcome.status === 'OK') {
    return { ok: true, value: outcome.value };
  }
  return { ok: false, reason: outcome.reason, retryable: outcome.status === 'TRANSIENT_ERROR' };
}

async function runInsuranceRequest(task: WorkflowTask): Promise<void> {
  const caseRow = await db.registrationCase.findUniqueOrThrow({ where: { id: task.caseId } });
  const [vehicle, sale] = await Promise.all([
    db.vehicle.findUniqueOrThrow({ where: { id: caseRow.vehicleId } }),
    db.vehicleSale.findUniqueOrThrow({ where: { id: caseRow.saleId } }),
  ]);
  const payload = task.payload as { simulateTransientFailures?: number };
  const outcome = unwrapOutcome(
    await demoInsuranceAdapter.requestCoverage({
      caseId: task.caseId,
      vin: vehicle.vin,
      plateNumber: null,
      holderName: sale.buyerName,
      idempotencyKey: task.idempotencyKey,
      simulateTransientFailures: payload.simulateTransientFailures ?? 0,
    }),
  );

  if (!outcome.ok) {
    if (outcome.retryable) {
      throw new RetryableTaskError(outcome.reason);
    }
    // Nicht eingebunden: keine Schein-Anfrage, sondern manueller Prüfauftrag.
    await db.$transaction(async (tx) => {
      await tx.workflowTask.update({ where: { id: task.id }, data: { status: 'DONE', lastError: outcome.reason } });
      await addReview(tx, {
        caseId: task.caseId,
        kind: 'MANUAL_CHECK',
        title: 'Versicherungsanfrage manuell stellen',
        detail: outcome.reason,
        openedBy: 'SYSTEM',
      });
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.insuranceRequest.update({
      where: { caseId: task.caseId },
      data: { externalReference: outcome.value.externalReference },
    });
    await tx.workflowTask.update({ where: { id: task.id }, data: { status: 'DONE', lastError: null } });
    await tx.workflowEvent.create({
      data: {
        caseId: task.caseId,
        type: 'TASK_DONE',
        source: 'SYSTEM',
        message: `Versicherungsanfrage gestellt (Referenz ${outcome.value.externalReference}).`,
      },
    });
  });
}

async function runAuthoritySubmission(task: WorkflowTask): Promise<void> {
  const payloadData = task.payload as { submissionId: string; simulateTransientFailures?: number };
  const submission = await db.authoritySubmission.findUniqueOrThrow({ where: { id: payloadData.submissionId } });
  const caseRow = await db.registrationCase.findUniqueOrThrow({ where: { id: task.caseId }, select: { canton: true, caseType: true, organizationId: true } });
  const adapter = getAuthorityAdapter(caseRow.canton);
  const outcome = unwrapOutcome(
    await adapter.submit({
      caseId: task.caseId,
      canton: caseRow.canton,
      caseType: caseRow.caseType,
      vin: String((submission.payload as Record<string, unknown>).vin ?? ''),
      holderName: String((submission.payload as Record<string, unknown>).holderName ?? ''),
      snapshot: submission.payload as Record<string, unknown>,
      simulateTransientFailures: payloadData.simulateTransientFailures ?? 0,
    }),
  );

  if (!outcome.ok) {
    if (outcome.retryable) {
      throw new RetryableTaskError(outcome.reason);
    }
    // Keine Schnittstelle: Daten bleiben im Snapshot erhalten, Einreichung wird manuell erledigt.
    await db.$transaction(async (tx) => {
      await tx.authoritySubmission.update({ where: { id: submission.id }, data: { status: 'QUEUED_MANUAL' } });
      await tx.workflowTask.update({ where: { id: task.id }, data: { status: 'DONE', lastError: outcome.reason } });
      await addReview(tx, {
        caseId: task.caseId,
        kind: 'EXCEPTION',
        title: 'Manuelle Einreichung erforderlich',
        detail: `${outcome.reason} Die Daten sind im Einreichungsprotokoll gesichert.`,
        openedBy: 'SYSTEM',
      });
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.authoritySubmission.update({
      where: { id: submission.id },
      data: { status: 'SUBMITTED', channelReference: outcome.value.reference, submittedAt: new Date() },
    });
    await tx.workflowTask.update({ where: { id: task.id }, data: { status: 'DONE', lastError: null } });
  });
}

async function scheduleRetryOrDeadLetter(task: WorkflowTask, reason: string, now: Date, retryBaseMs: number): Promise<'RETRY' | 'DEAD_LETTER'> {
  if (task.attempts >= task.maxAttempts) {
    await moveToDeadLetter(task, reason);
    return 'DEAD_LETTER';
  }
  const delay = retryBaseMs * 2 ** (task.attempts - 1);
  await db.workflowTask.update({
    where: { id: task.id },
    data: { status: 'PENDING', lastError: reason, nextRunAt: new Date(now.getTime() + delay) },
  });
  return 'RETRY';
}

async function moveToDeadLetter(task: WorkflowTask, reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.workflowTask.update({ where: { id: task.id }, data: { status: 'DEAD_LETTER', lastError: reason } });
    if (task.type === 'PREPARE_AUTHORITY_SUBMISSION') {
      const payloadData = task.payload as { submissionId: string };
      await tx.authoritySubmission.update({ where: { id: payloadData.submissionId }, data: { status: 'QUEUED_MANUAL' } });
    }
    await addReview(tx, {
      caseId: task.caseId,
      kind: 'DEAD_LETTER',
      title: `Aufgabe fehlgeschlagen: ${task.type}`,
      detail: `Aufgabe ${task.id} nach ${task.attempts} Versuchen fehlgeschlagen: ${reason}`,
      openedBy: 'SYSTEM',
    });
    await tx.workflowEvent.create({
      data: {
        caseId: task.caseId,
        type: 'TASK_DEAD_LETTERED',
        source: 'SYSTEM',
        message: `Aufgabe ${task.type} nach ${task.attempts} Versuchen in die Fehlerwarteschlange verschoben.`,
        data: { taskId: task.id, reason } as Json,
      },
    });
  });
}

// Team setzt eine fehlgeschlagene Aufgabe zurück und stösst sie erneut an. Begründung wird protokolliert.
export async function retryDeadLetterTask(actor: Actor, taskId: string, reason: string): Promise<void> {
  assertOperator(actor);
  await db.$transaction(async (tx) => {
    const task = await tx.workflowTask.findUnique({ where: { id: taskId } });
    if (!task || task.status !== 'DEAD_LETTER') {
      throw new DomainError('CONFLICT', 'Nur fehlgeschlagene Aufgaben können erneut ausgeführt werden.');
    }
    await tx.workflowTask.update({
      where: { id: taskId },
      data: { status: 'PENDING', attempts: 0, nextRunAt: new Date(), lastError: null },
    });
    await tx.reviewItem.updateMany({
      where: { caseId: task.caseId, kind: 'DEAD_LETTER', status: 'OPEN', detail: { contains: taskId } },
      data: { status: 'RESOLVED', resolution: `Erneut ausgeführt: ${reason}`, resolvedById: actor.userId, resolvedAt: new Date() },
    });
    await tx.workflowEvent.create({
      data: {
        caseId: task.caseId,
        type: 'TASK_RETRY_REQUESTED',
        source: 'OPERATOR',
        actorUserId: actor.userId,
        message: `Aufgabe ${task.type} erneut ausgeführt: ${reason}`,
      },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'task.retry_requested',
      entityType: 'WorkflowTask',
      entityId: taskId,
      metadata: { reason },
    });
  });
}
