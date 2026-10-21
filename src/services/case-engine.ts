// Kern der Orchestrierung: Fallplanung, Übergänge mit Guards, Anforderungsstatus und Aufgabenwarteschlange.
// Alle Funktionen erwarten eine offene Transaktion (tx). Die Aufrufer öffnen die Transaktion.

import type { CaseRequirement, CaseStatus, DocumentKind, EventSource, RequirementCategory } from '@prisma/client';
import { PILOT_CANTONS } from '@/domain/cantons';
import { assertTransition, InvalidTransitionError, type ActorSource, type CaseState } from '@/domain/case-state';
import { handoverDecision, submissionBlockers, type GateFacts, type HandoverDecision } from '@/domain/gates';
import { evaluateRequirements } from '@/domain/rules/engine';
import { GENERIC_CANTON } from '@/domain/rules/seed-rulesets';
import type { CaseFacts, RulesetDefinition } from '@/domain/rules/types';
import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { env } from '@/lib/env';
import { audit, notifyOrgMembers, notifyUsers, type Json } from './shared';

export interface CaseRow {
  id: string;
  organizationId: string;
  customerUserId: string | null;
  canton: string;
  caseType: string;
  plateSituation: string;
  status: CaseStatus;
  resumeStatus: CaseStatus | null;
  version: number;
  saleId: string;
  vehicleId: string;
  rulesetId: string | null;
}

export async function loadCase(tx: Tx, caseId: string): Promise<CaseRow> {
  const row = await tx.registrationCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      organizationId: true,
      customerUserId: true,
      canton: true,
      caseType: true,
      plateSituation: true,
      status: true,
      resumeStatus: true,
      version: true,
      saleId: true,
      vehicleId: true,
      rulesetId: true,
    },
  });
  if (!row) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  return row;
}

// Fallmerkmale für die Regel-Engine.
export async function buildCaseFacts(tx: Tx, caseId: string): Promise<CaseFacts> {
  const row = await loadCase(tx, caseId);
  const [vehicle, sale] = await Promise.all([
    tx.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId } }),
    tx.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId } }),
  ]);
  return {
    caseType: row.caseType,
    plateSituation: row.plateSituation,
    isNewVehicle: vehicle.isNew,
    // "Unbekannt" wird vorsichtig als vorherige Zulassung behandelt, damit der Fahrzeugausweis angefordert wird.
    wasPreviouslyRegistered: vehicle.previousRegistration !== 'NEVER_REGISTERED',
    isCompanyBuyer: sale.isCompanyBuyer,
    isImport: vehicle.isImport,
  };
}

// Sammelt alle Fakten, die die Freigabe-Gates brauchen.
export async function loadGateFacts(tx: Tx, caseId: string): Promise<GateFacts> {
  const row = await loadCase(tx, caseId);
  const [requirements, confirmation, insurance, authorityConfirmation, temporaryAuth, openReviews] = await Promise.all([
    tx.caseRequirement.findMany({ where: { caseId }, select: { ruleKey: true, status: true } }),
    tx.purchaseConfirmation.findUnique({ where: { saleId: row.saleId }, select: { id: true } }),
    tx.insuranceRequest.findUnique({ where: { caseId }, select: { status: true, id: true } }),
    tx.authorityResponse.findFirst({ where: { caseId, kind: 'REGISTRATION_CONFIRMED' }, orderBy: { createdAt: 'desc' } }),
    tx.temporaryAuthorization.findFirst({ where: { caseId }, orderBy: { createdAt: 'desc' } }),
    tx.reviewItem.count({ where: { caseId, status: 'OPEN' } }),
  ]);

  let insuranceSource: EventSource | null = null;
  if (insurance && insurance.status === 'CONFIRMED') {
    const event = await tx.insuranceStatusEvent.findFirst({
      where: { insuranceRequestId: insurance.id, toStatus: 'CONFIRMED' },
      orderBy: { createdAt: 'desc' },
    });
    insuranceSource = event?.source ?? null;
  }

  return {
    purchaseConfirmed: confirmation !== null,
    onHold: row.status === 'ON_HOLD',
    requirements: requirements.map((r) => ({ ruleKey: r.ruleKey, status: r.status })),
    insurance: { status: insurance?.status ?? 'NOT_STARTED', source: insuranceSource },
    registrationConfirmation: authorityConfirmation ? { source: authorityConfirmation.source } : null,
    temporaryAuthorization: temporaryAuth ? { source: temporaryAuth.source } : null,
    openBlockingReviews: openReviews,
  };
}

// Setzt den Status der Anforderungen aus den Fakten (verifizierte Dokumente, Versicherungsstatus).
// Manuell abgehakte Anforderungen (satisfiedVia OPERATOR) bleiben unberührt.
export async function syncRequirements(tx: Tx, caseId: string): Promise<void> {
  const [requirements, verifiedDocs, insurance] = await Promise.all([
    tx.caseRequirement.findMany({ where: { caseId } }),
    tx.document.findMany({
      where: { caseId, status: 'VERIFIED' },
      select: { kind: true },
    }),
    tx.insuranceRequest.findUnique({ where: { caseId }, select: { status: true } }),
  ]);
  const verifiedKinds = new Set<DocumentKind>(verifiedDocs.map((d) => d.kind));
  const insuranceConfirmed = insurance?.status === 'CONFIRMED';

  for (const req of requirements) {
    if (req.satisfiedVia === 'OPERATOR') {
      continue;
    }
    let desired: 'OPEN' | 'SATISFIED' | null = null;
    let via: string | null = null;
    if (req.documentKind) {
      desired = verifiedKinds.has(req.documentKind) ? 'SATISFIED' : 'OPEN';
      via = 'DOCUMENT';
    } else if (req.category === 'INSURANCE') {
      desired = insuranceConfirmed ? 'SATISFIED' : 'OPEN';
      via = 'INSURANCE';
    }
    if (desired && req.status !== desired) {
      await tx.caseRequirement.update({
        where: { id: req.id },
        data: {
          status: desired,
          satisfiedAt: desired === 'SATISFIED' ? new Date() : null,
          satisfiedVia: desired === 'SATISFIED' ? via : null,
        },
      });
    }
  }
}

export async function addReview(
  tx: Tx,
  input: { caseId: string; kind: 'MANUAL_CHECK' | 'DATA_CONFLICT' | 'EXCEPTION' | 'DEAD_LETTER' | 'OVERRIDE_REQUEST'; title: string; detail: string; openedBy: EventSource },
): Promise<void> {
  const existing = await tx.reviewItem.findFirst({
    where: { caseId: input.caseId, title: input.title, status: 'OPEN' },
    select: { id: true },
  });
  if (existing) {
    return;
  }
  await tx.reviewItem.create({
    data: {
      caseId: input.caseId,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      openedBy: input.openedBy,
    },
  });
}

// Legt Aufgaben idempotent an. Der Schlüssel verhindert doppelte Aufgaben bei wiederholter Planung.
export async function enqueueTask(
  tx: Tx,
  input: { caseId: string; type: 'REQUEST_INSURANCE' | 'PREPARE_AUTHORITY_SUBMISSION'; idempotencyKey: string; payload: Json },
): Promise<void> {
  await tx.workflowTask.createMany({
    data: [
      {
        caseId: input.caseId,
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
      },
    ],
    skipDuplicates: true,
  });
}

// Guards, die beim Betreten eines Zustands geprüft werden. Ohne Erfüllung scheitert der Übergang.
async function enforceGuards(tx: Tx, caseId: string, to: CaseState): Promise<HandoverDecision | null> {
  if (to === 'READY_FOR_SUBMISSION') {
    const blockers = submissionBlockers(await loadGateFacts(tx, caseId));
    if (blockers.length > 0) {
      throw new DomainError('CONFLICT', `Einreichung nicht möglich: ${blockers.map((b) => b.message).join(' ')}`);
    }
    return null;
  }
  if (to === 'HANDOVER_RELEASABLE' || to === 'HANDED_OVER') {
    const decision = handoverDecision(await loadGateFacts(tx, caseId));
    if (decision.level === 'BLOCKED') {
      throw new DomainError('CONFLICT', `Übergabe nicht freigegeben: ${decision.blockers.map((b) => b.message).join(' ')}`);
    }
    if (to === 'HANDED_OVER' && decision.level === 'DEMO_SIMULATED' && !env().DEMO_MODE) {
      throw new DomainError('CONFLICT', 'Übergabe nicht freigegeben: Simulierte Bestätigungen werden im Produktivbetrieb nicht akzeptiert.');
    }
    return decision;
  }
  return null;
}

export interface TransitionInput {
  caseId: string;
  to: CaseState;
  source: ActorSource;
  actorUserId: string | null;
  message: string;
  data?: Json;
  // Nur für Wiederaufnahme aus ON_HOLD: Zielzustand muss dem gespeicherten Vorzustand entsprechen.
  resume?: boolean;
}

// Einziger Weg, den Fallstatus zu ändern. Prüft Graph, Akteur, Guards und optimistische Sperre.
export async function transitionCase(tx: Tx, input: TransitionInput): Promise<{ from: CaseState; to: CaseState }> {
  const current = await loadCase(tx, input.caseId);
  const from = current.status as CaseState;

  if (input.resume) {
    if (from !== 'ON_HOLD' || current.resumeStatus === null || current.resumeStatus !== input.to) {
      throw new DomainError('INVALID_TRANSITION', 'Der Fall kann nur in seinen vorherigen Status zurückgesetzt werden.');
    }
  } else {
    try {
      assertTransition(from, input.to, input.source);
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new DomainError('INVALID_TRANSITION', error.message);
      }
      throw error;
    }
  }

  const decision = await enforceGuards(tx, input.caseId, input.to);

  const updated = await tx.registrationCase.updateMany({
    where: { id: input.caseId, status: current.status, version: current.version },
    data: {
      status: input.to,
      version: { increment: 1 },
      resumeStatus: input.to === 'ON_HOLD' ? current.status : null,
      closedAt: input.to === 'CLOSED' || input.to === 'CANCELLED' ? new Date() : null,
      nextAction: nextActionFor(input.to),
    },
  });
  if (updated.count !== 1) {
    throw new DomainError('CONFLICT', 'Der Vorgang wurde zwischenzeitlich geändert. Bitte laden Sie die Seite neu.');
  }

  await tx.workflowEvent.create({
    data: {
      caseId: input.caseId,
      type: input.resume ? 'OVERRIDE_APPLIED' : 'STATUS_CHANGED',
      fromStatus: current.status,
      toStatus: input.to,
      source: input.source as EventSource,
      actorUserId: input.actorUserId,
      message: input.message,
      data: { ...(input.data as object | undefined), handoverLevel: decision?.level ?? null } as Json,
    },
  });

  await audit(tx, {
    actorUserId: input.actorUserId,
    organizationId: current.organizationId,
    action: input.resume ? 'case.resumed' : 'case.transition',
    entityType: 'RegistrationCase',
    entityId: input.caseId,
    metadata: { from, to: input.to, source: input.source, message: input.message },
  });

  const customerIds = current.customerUserId ? [current.customerUserId] : [];
  await notifyUsers(tx, customerIds, {
    caseId: input.caseId,
    kind: 'CASE_STATUS',
    title: 'Ihr Zulassungsfall hat einen neuen Stand',
    body: input.message,
  });

  return { from, to: input.to };
}

function nextActionFor(state: CaseState): string | null {
  const map: Partial<Record<CaseState, string>> = {
    INVITED: 'Einladung öffnen und Kaufangaben bestätigen',
    PURCHASE_CONFIRMED: 'Fehlende Angaben und Dokumente ergänzen',
    PREPARATION: 'Dokumente hochladen und Angaben vervollständigen',
    REVIEW: 'Eingereichte Unterlagen werden vom AutoPass-Team geprüft',
    READY_FOR_SUBMISSION: 'Einreichung bei der zuständigen Stelle durch das Team',
    SUBMITTED: 'Auf Eingangsbestätigung der zuständigen Stelle warten',
    AUTHORITY_PROCESSING: 'Behördliche Bearbeitung abwarten',
    PLATES_AND_ORIGINALS: 'Kontrollschilder und Originaldokumente koordinieren',
    HANDOVER_RELEASABLE: 'Übergabetermin mit dem Käufer bestätigen',
    HANDED_OVER: 'Abschluss bestätigen',
    ON_HOLD: 'Fall wird vom AutoPass-Team bearbeitet',
  };
  return map[state] ?? null;
}

// Plant einen Fall nach Kaufbestätigung: Anforderungen, Prüfaufträge, Versicherungsanfrage.
export async function planCase(tx: Tx, caseId: string): Promise<void> {
  const row = await loadCase(tx, caseId);
  const facts = await buildCaseFacts(tx, caseId);
  const sale = await tx.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId }, select: { buyerName: true } });

  const isPilot = (PILOT_CANTONS as readonly string[]).includes(row.canton);
  const rulesetRow = await tx.cantonRuleset.findFirst({
    where: { canton: isPilot ? row.canton : GENERIC_CANTON },
    orderBy: { version: 'desc' },
  });
  const fallbackRow = rulesetRow ?? (await tx.cantonRuleset.findFirst({ where: { canton: GENERIC_CANTON }, orderBy: { version: 'desc' } }));
  if (!fallbackRow) {
    throw new DomainError('CONFLICT', 'Kein Regelwerk hinterlegt. Bitte den Administrator informieren.');
  }
  const definition: RulesetDefinition = {
    canton: fallbackRow.canton,
    version: fallbackRow.version,
    status: fallbackRow.status,
    sourceUrls: fallbackRow.sourceUrls as string[],
    sourceCheckedAt: fallbackRow.sourceCheckedAt?.toISOString() ?? null,
    rules: fallbackRow.rules as unknown as RulesetDefinition['rules'],
  };
  const requirements = evaluateRequirements(definition, facts);

  await tx.caseRequirement.createMany({
    data: requirements.map((r) => ({
      caseId,
      ruleKey: r.ruleKey,
      title: r.title,
      category: r.category as RequirementCategory,
      documentKind: (r.documentKind ?? null) as DocumentKind | null,
      verification: r.verified ? 'VERIFIED_RULE' : 'UNVERIFIED_RULE',
      sourceRef: r.sourceRef,
      note: r.note ?? null,
    })),
    skipDuplicates: true,
  });

  await tx.registrationCase.update({
    where: { id: caseId },
    data: { rulesetId: fallbackRow.id, rulesetVersion: fallbackRow.version },
  });

  // Manuelle Prüfpflichten. Nie automatisch als erledigt werten.
  const unverified = requirements.filter((r) => !r.verified).map((r) => r.ruleKey);
  if (unverified.length > 0) {
    await addReview(tx, {
      caseId,
      kind: 'MANUAL_CHECK',
      title: 'Nicht verifizierte Regeln prüfen',
      detail: `Regelwerk ${fallbackRow.canton} v${fallbackRow.version}: ${unverified.join(', ')}. Quelle muss gegen den amtlichen Stand geprüft werden.`,
      openedBy: 'SYSTEM',
    });
  }
  if (!isPilot || fallbackRow.canton === GENERIC_CANTON) {
    await addReview(tx, {
      caseId,
      kind: 'MANUAL_CHECK',
      title: 'Kanton ohne verifiziertes Regelwerk',
      detail: `Für ${row.canton} liegt kein verifiziertes Regelwerk vor. Der Fall wird vollständig manuell bearbeitet.`,
      openedBy: 'SYSTEM',
    });
  }
  if (row.caseType === 'MANUAL_CLASSIFICATION') {
    await addReview(tx, {
      caseId,
      kind: 'MANUAL_CHECK',
      title: 'Fallklassifikation prüfen',
      detail: 'Fahrzeugstatus und Kontrollschildsituation ergeben keine eindeutige Fallart.',
      openedBy: 'SYSTEM',
    });
  }
  if (facts.isCompanyBuyer || facts.isImport) {
    await addReview(tx, {
      caseId,
      kind: 'MANUAL_CHECK',
      title: facts.isCompanyBuyer ? 'Firmenkäufer: Vertretung prüfen' : 'Importfahrzeug: Nachweise prüfen',
      detail: 'Dieser Fall braucht eine manuelle Prüfung der Vertretungs- beziehungsweise Importnachweise.',
      openedBy: 'SYSTEM',
    });
  }

  // Versicherungsanfrage als eigene Zustandsmaschine, parallel zu den Dokumenten.
  const insurance = await tx.insuranceRequest.upsert({
    where: { caseId },
    create: { caseId, providerKey: 'DEMO_INSURER', status: 'REQUESTED' },
    update: {},
  });
  if (insurance.status === 'REQUESTED') {
    await tx.insuranceStatusEvent.createMany({
      data: [{ insuranceRequestId: insurance.id, fromStatus: null, toStatus: 'REQUESTED', source: 'SYSTEM' }],
    });
  }
  await enqueueTask(tx, {
    caseId,
    type: 'REQUEST_INSURANCE',
    idempotencyKey: `insurance-request:${caseId}`,
    payload: { simulateTransientFailures: 0 },
  });

  await tx.workflowEvent.create({
    data: {
      caseId,
      type: 'CASE_PLANNED',
      source: 'SYSTEM',
      message: `${requirements.length} Anforderungen aus Regelwerk ${fallbackRow.canton} v${fallbackRow.version} abgeleitet.`,
      data: { requirements: requirements.map((r) => r.ruleKey), buyer: sale.buyerName } as Json,
    },
  });

  await syncRequirements(tx, caseId);
}

// Operator oder Systemaktion: Anforderung ohne Dokument abhaken (z. B. Kontrollschilder, Originale).
// Dokumentbasierte Anforderungen und Versicherung können so nie erfüllt werden.
export async function markRequirementManually(
  tx: Tx,
  input: { caseId: string; ruleKey: string; actorUserId: string; note: string },
): Promise<void> {
  const req: CaseRequirement | null = await tx.caseRequirement.findUnique({
    where: { caseId_ruleKey: { caseId: input.caseId, ruleKey: input.ruleKey } },
  });
  if (!req) {
    throw new DomainError('NOT_FOUND', 'Die Anforderung wurde nicht gefunden.');
  }
  if (req.documentKind || req.category === 'INSURANCE') {
    throw new DomainError('FORBIDDEN', 'Diese Anforderung kann nur über einen verifizierten Beleg erfüllt werden.');
  }
  await tx.caseRequirement.update({
    where: { id: req.id },
    data: { status: 'SATISFIED', satisfiedAt: new Date(), satisfiedBy: input.actorUserId, satisfiedVia: 'OPERATOR' },
  });
  await tx.workflowEvent.create({
    data: {
      caseId: input.caseId,
      type: 'REQUIREMENT_CONFIRMED',
      source: 'OPERATOR',
      actorUserId: input.actorUserId,
      message: `Anforderung "${req.title}" manuell bestätigt: ${input.note}`,
    },
  });
  await audit(tx, {
    actorUserId: input.actorUserId,
    action: 'requirement.confirmed',
    entityType: 'CaseRequirement',
    entityId: req.id,
    metadata: { caseId: input.caseId, ruleKey: input.ruleKey, note: input.note },
  });
}

export async function notifyCaseOrg(tx: Tx, caseId: string, title: string, body: string): Promise<void> {
  const row = await loadCase(tx, caseId);
  await notifyOrgMembers(tx, row.organizationId, { caseId, kind: 'CASE_UPDATE', title, body });
}

// Wiederaufnahme aus ON_HOLD. Erfordert Begründung und läuft über dieselben Guards.
export async function resumeCase(tx: Tx, input: { caseId: string; actorUserId: string; reason: string }): Promise<void> {
  const row = await loadCase(tx, input.caseId);
  if (row.status !== 'ON_HOLD' || !row.resumeStatus) {
    throw new DomainError('INVALID_TRANSITION', 'Der Fall ist nicht pausiert.');
  }
  await transitionCase(tx, {
    caseId: input.caseId,
    to: row.resumeStatus as CaseState,
    source: 'OPERATOR',
    actorUserId: input.actorUserId,
    message: `Fall wieder aufgenommen: ${input.reason}`,
    data: { reason: input.reason },
    resume: true,
  });
}
