'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import type { AuthorityResponseKind, DocumentKind } from '@prisma/client';
import { requireActorForAction, assertOperator, type Actor } from '@/auth/actor';
import { operatorMove, operatorHandoverCheck, pauseCase, resolveReview, confirmHandover } from '@/services/operations-service';
import { db } from '@/lib/db';
import { DomainError, toActionError, type ActionResult } from '@/lib/errors';
import { env } from '@/lib/env';
import { INSURANCE_STATES, type InsuranceState } from '@/domain/insurance-state';
import { loginSchema, registerSchema, saleSchema, customerProfileSchema, reasonSchema, referenceSchema } from '@/domain/schemas';
import { logout, loginWithPassword, registerAccount } from '@/services/auth-service';
import { createSale, createInvitation, acceptInvitation, confirmPurchase, saveCustomerProfile, submitDocumentsForReview } from '@/services/sale-service';
import { uploadDocument, correctExtractionField, verifyDocument, rejectDocument, DOCUMENT_KINDS } from '@/services/document-service';
import { confirmInsuranceWithEvidence, simulateInsuranceEvent } from '@/services/insurance-service';
import { recordAuthorityResponse, recordManualSubmission, recordTemporaryAuthorization, simulateAuthorityResponse, startSubmission } from '@/services/authority-service';
import { markRequirementManually, resumeCase } from '@/services/case-engine';
import { processDueTasks, retryDeadLetterTask } from '@/services/worker';
import { audit } from '@/services/shared';
import type { CaseState } from '@/domain/case-state';

type Result<T = void> = ActionResult<T>;

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on';
}

function optional(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, error: 'Bitte prüfen Sie Ihre Eingaben.', fieldErrors: zodFieldErrors(error) };
    }
    return toActionError(error);
  }
}

function refreshAll(): void {
  revalidatePath('/', 'layout');
}

// --- Konto -----------------------------------------------------------------

export async function registerAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const result = await run(async () => {
    const input = registerSchema.parse(fields(formData));
    await registerAccount(input);
  });
  if (result.ok) {
    redirect(safeNext(optional(formData.get('next')?.toString())));
  }
  return result;
}

// Nur interne Pfade zulassen (Schutz vor offenen Weiterleitungen).
function safeNext(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export async function loginAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const clientKey = (await headers()).get('x-forwarded-for') ?? 'local';
  const result = await run(async () => {
    const input = loginSchema.parse(fields(formData));
    await loginWithPassword(input, clientKey);
  });
  if (result.ok) {
    redirect(safeNext(optional(formData.get('next')?.toString())));
  }
  return result;
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/');
}

// --- Händler: Verkauf und Einladung ---------------------------------------

export async function createSaleAction(_prev: Result<{ caseId: string }> | null, formData: FormData): Promise<Result<{ caseId: string }>> {
  const actor = await requireActorForAction();
  const dealer = actor.memberships.find((m) => m.organizationType === 'DEALER');
  const result = await run(async () => {
    if (!dealer) {
      throw new DomainError('FORBIDDEN', 'Für diesen Benutzer ist keine Händler-Organisation hinterlegt.');
    }
    const raw = fields(formData);
    const input = saleSchema.parse({
      ...raw,
      variant: raw.variant ?? '',
      vehicleKind: raw.vehicleKind,
      isImport: checked(formData, 'isImport'),
      isCompanyBuyer: checked(formData, 'isCompanyBuyer'),
      mileageKm: optional(raw.mileageKm),
      priceChf: optional(raw.priceChf),
      plannedHandoverDate: optional(raw.plannedHandoverDate),
      firstRegistrationDate: optional(raw.firstRegistrationDate),
    });
    return createSale(actor, dealer.organizationId, input);
  });
  if (result.ok) {
    refreshAll();
    redirect(`/faelle/${result.data.caseId}`);
  }
  return result;
}

export async function createInvitationAction(caseId: string): Promise<Result<{ url: string; expiresAt: string }>> {
  const actor = await requireActorForAction();
  const result = await run(async () => {
    const invitation = await createInvitation(actor, caseId);
    return { url: invitation.url, expiresAt: invitation.expiresAt.toISOString() };
  });
  refreshAll();
  return result;
}

export async function acceptInvitationAction(token: string): Promise<Result<{ caseId: string }>> {
  const actor = await requireActorForAction();
  const result = await run(() => acceptInvitation(actor, token));
  if (result.ok) {
    refreshAll();
    redirect(`/faelle/${result.data.caseId}`);
  }
  return result;
}

export async function addTeamMemberAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await requireActorForAction();
  const dealer = actor.memberships.find((m) => m.organizationType === 'DEALER');
  return run(async () => {
    if (!dealer || dealer.role !== 'ORG_ADMIN') {
      throw new DomainError('FORBIDDEN', 'Teammitglieder kann nur ein Organisations-Administrator hinzufügen.');
    }
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const role = formData.get('role') === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'ORG_STAFF';
    const user = await db.user.findUnique({ where: { email }, select: { id: true, fullName: true } });
    if (!user) {
      throw new DomainError('VALIDATION', 'Konto nicht gefunden.', { email: 'Diese Person hat noch kein AutoPass-Konto.' });
    }
    await db.$transaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: dealer.organizationId, userId: user.id } },
        create: { organizationId: dealer.organizationId, userId: user.id, role },
        update: { role },
      });
      await audit(tx, {
        actorUserId: actor.userId,
        organizationId: dealer.organizationId,
        action: 'team.member_added',
        entityType: 'User',
        entityId: user.id,
        metadata: { role },
      });
    });
    refreshAll();
  });
}

// --- Kunde ----------------------------------------------------------------

export async function confirmPurchaseAction(caseId: string, _prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await requireActorForAction();
  const result = await run(() =>
    confirmPurchase(actor, caseId, {
      acceptProcessConfirmation: checked(formData, 'acceptProcessConfirmation'),
      acceptDataProcessing: checked(formData, 'acceptDataProcessing'),
    }),
  );
  refreshAll();
  return result;
}

export async function saveProfileAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await requireActorForAction();
  const result = await run(async () => {
    const raw = fields(formData);
    await saveCustomerProfile(actor, customerProfileSchema.parse({ ...raw, phone: raw.phone ?? '' }));
  });
  refreshAll();
  return result;
}

export async function submitDocumentsAction(caseId: string): Promise<Result> {
  const actor = await requireActorForAction();
  const result = await run(() => submitDocumentsForReview(actor, caseId));
  refreshAll();
  return result;
}

export async function uploadDocumentAction(_prev: Result<{ documentId: string }> | null, formData: FormData): Promise<Result<{ documentId: string }>> {
  const actor = await requireActorForAction();
  const file = formData.get('file');
  const result = await run(async () => {
    if (!(file instanceof File) || file.size === 0) {
      throw new DomainError('VALIDATION', 'Bitte wählen Sie eine Datei aus.', { file: 'Bitte wählen Sie eine Datei aus.' });
    }
    const kind = String(formData.get('kind') ?? '') as DocumentKind;
    if (!DOCUMENT_KINDS.includes(kind)) {
      throw new DomainError('VALIDATION', 'Bitte wählen Sie eine Dokumentart.', { kind: 'Bitte wählen Sie eine Dokumentart.' });
    }
    const content = Buffer.from(await file.arrayBuffer());
    const caseId = optional(String(formData.get('caseId') ?? ''));
    const documentId = optional(String(formData.get('documentId') ?? ''));
    const uploaded = await uploadDocument(actor, {
      caseId: caseId ?? null,
      documentId: documentId ?? null,
      kind,
      title: String(formData.get('title') ?? ''),
      filename: file.name,
      declaredMime: file.type,
      content,
    });
    return { documentId: uploaded.documentId };
  });
  refreshAll();
  return result;
}

export async function correctFieldAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await requireActorForAction();
  const result = await run(() =>
    correctExtractionField(actor, String(formData.get('versionId')), String(formData.get('fieldKey')), String(formData.get('value') ?? '')),
  );
  refreshAll();
  return result;
}

// --- Operations -----------------------------------------------------------

async function operatorActor(): Promise<Actor> {
  const actor = await requireActorForAction();
  assertOperator(actor);
  return actor;
}

export async function verifyDocumentAction(documentId: string): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => verifyDocument(actor, documentId));
  refreshAll();
  return result;
}

export async function rejectDocumentAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => rejectDocument(actor, String(formData.get('documentId')), reasonSchema.parse(String(formData.get('reason') ?? ''))));
  refreshAll();
  return result;
}

export async function confirmInsuranceEvidenceAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    await confirmInsuranceWithEvidence(
      actor.userId,
      String(formData.get('caseId')),
      String(formData.get('documentId')),
      referenceSchema.parse(String(formData.get('note') ?? '')),
    );
  });
  refreshAll();
  return result;
}

export async function simulateInsuranceAction(caseId: string, toStatus: string): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    if (!(INSURANCE_STATES as readonly string[]).includes(toStatus)) {
      throw new DomainError('VALIDATION', 'Ungültiger Versicherungsstatus.');
    }
    await simulateInsuranceEvent(actor.userId, caseId, toStatus as InsuranceState);
  });
  refreshAll();
  return result;
}

export async function markRequirementAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    const caseId = String(formData.get('caseId'));
    const note = referenceSchema.parse(String(formData.get('note') ?? ''));
    await db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: String(formData.get('ruleKey')), actorUserId: actor.userId, note }));
  });
  refreshAll();
  return result;
}

export async function moveCaseAction(caseId: string, to: string, message: string): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => operatorMove(actor, caseId, to as CaseState, message));
  refreshAll();
  return result;
}

export async function startSubmissionAction(caseId: string): Promise<Result<{ submissionId: string }>> {
  const actor = await operatorActor();
  const result = await run(() => startSubmission(actor, caseId));
  refreshAll();
  return result;
}

export async function recordManualSubmissionAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => recordManualSubmission(actor, String(formData.get('submissionId')), String(formData.get('reference') ?? '')));
  refreshAll();
  return result;
}

export async function recordAuthorityResponseAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    const kind = String(formData.get('kind')) as AuthorityResponseKind;
    await recordAuthorityResponse(actor, {
      caseId: String(formData.get('caseId')),
      kind,
      source: 'OPERATOR',
      reference: String(formData.get('reference') ?? ''),
      note: optional(String(formData.get('note') ?? '')) ?? null,
      externalEventId: null,
    });
  });
  refreshAll();
  return result;
}

export async function simulateAuthorityAction(caseId: string, kind: string): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => simulateAuthorityResponse(actor, caseId, kind as AuthorityResponseKind));
  refreshAll();
  return result;
}

export async function recordTemporaryAuthorizationAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    const validUntil = optional(String(formData.get('validUntil') ?? ''));
    await recordTemporaryAuthorization(actor, {
      caseId: String(formData.get('caseId')),
      reference: String(formData.get('reference') ?? ''),
      validUntil: validUntil ? new Date(`${validUntil}T23:59:59.000Z`) : null,
      documentId: optional(String(formData.get('documentId') ?? '')) ?? null,
    });
  });
  refreshAll();
  return result;
}

export async function pauseCaseAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => pauseCase(actor, String(formData.get('caseId')), String(formData.get('reason') ?? '')));
  refreshAll();
  return result;
}

export async function resumeCaseAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    const reason = reasonSchema.parse(String(formData.get('reason') ?? ''));
    await db.$transaction((tx) => resumeCase(tx, { caseId: String(formData.get('caseId')), actorUserId: actor.userId, reason }));
  });
  refreshAll();
  return result;
}

export async function handoverCheckAction(caseId: string): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => operatorHandoverCheck(actor, caseId));
  refreshAll();
  return result;
}

export async function resolveReviewAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => resolveReview(actor, String(formData.get('reviewId')), String(formData.get('resolution') ?? '')));
  refreshAll();
  return result;
}

export async function retryTaskAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(() => retryDeadLetterTask(actor, String(formData.get('taskId')), reasonSchema.parse(String(formData.get('reason') ?? ''))));
  refreshAll();
  return result;
}

export async function runTasksAction(): Promise<Result<{ processed: number }>> {
  const actor = await operatorActor();
  if (!env().DEMO_MODE) {
    return { ok: false, error: 'Die manuelle Ausführung ist nur im Demo-Modus verfügbar. Im Betrieb läuft der Worker-Prozess.' };
  }
  const result = await run(async () => {
    const summary = await processDueTasks();
    await db.auditLog.create({ data: { actorUserId: actor.userId, action: 'worker.run_manual', entityType: 'WorkflowTask', entityId: 'batch', metadata: { claimed: summary.claimed, done: summary.done, retried: summary.retried, deadLettered: summary.deadLettered } } });
    return { processed: summary.claimed };
  });
  refreshAll();
  return result;
}

// Demo: Der nächste Versuch der Versicherungsanfrage schlägt fehl (zeigt Retry-Verhalten).
export async function simulateTransientFailureAction(caseId: string, count: number): Promise<Result> {
  const actor = await operatorActor();
  const result = await run(async () => {
    if (!env().DEMO_MODE) {
      throw new DomainError('FORBIDDEN', 'Fehlersimulation ist nur im Demo-Modus verfügbar.');
    }
    const tasks = await db.workflowTask.findMany({ where: { caseId, status: 'PENDING', type: 'REQUEST_INSURANCE' } });
    for (const task of tasks) {
      await db.workflowTask.update({
        where: { id: task.id },
        data: { payload: { ...(task.payload as object), simulateTransientFailures: Math.max(0, Math.min(count, 5)) } },
      });
    }
    await db.auditLog.create({ data: { actorUserId: actor.userId, action: 'demo.failure_simulated', entityType: 'RegistrationCase', entityId: caseId, metadata: { count } } });
  });
  refreshAll();
  return result;
}

// Formularvariante für die Demo-Fehlersimulation.
export async function simulateFailureFormAction(_prev: Result | null, formData: FormData): Promise<Result> {
  return simulateTransientFailureAction(String(formData.get('caseId')), Number(formData.get('count') ?? 0));
}

export async function markNotificationsReadAction(): Promise<void> {
  const actor = await requireActorForAction();
  await db.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
  refreshAll();
}


// Händler bestätigt die tatsächliche Übergabe. Das Übergabe-Gate wird beim Übergang erneut geprüft.
export async function confirmHandoverAction(caseId: string): Promise<Result<{ closed: boolean }>> {
  const actor = await requireActorForAction();
  const result = await run(async () => {
    await confirmHandover(actor, caseId);
    return { closed: true };
  });
  refreshAll();
  return result;
}

