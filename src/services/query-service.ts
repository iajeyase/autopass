import { CANTONS } from '@/domain/cantons';
import { handoverDecision, type HandoverDecision } from '@/domain/gates';
import { INSURANCE_LABELS, type InsuranceState } from '@/domain/insurance-state';
import { buildTimeline, type TimelineStep } from '@/domain/timeline';
import type { CaseStatus } from '@prisma/client';
import type { CaseState } from '@/domain/case-state';
import { canAccessCase, isOperator, membershipIn, type Actor } from '@/auth/policy';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { documentKindLabel } from './document-service';
import { buildGateFactsForView } from './case-view-facts';

export const CASE_TYPE_LABELS: Record<string, string> = {
  VEHICLE_CHANGE_WITH_PLATES: 'Fahrzeugwechsel mit bestehenden Kontrollschildern',
  NEW_VEHICLE_NEW_PLATES: 'Neuzulassung mit neuen Kontrollschildern',
  USED_VEHICLE_PURCHASE: 'Occasion-Kauf',
  MANUAL_CLASSIFICATION: 'Manuelle Klassifikation',
};

export const STATUS_LABELS: Record<CaseState, string> = {
  SALE_CREATED: 'Verkauf erfasst',
  INVITED: 'Käufer eingeladen',
  PURCHASE_CONFIRMED: 'Kauf bestätigt',
  PREPARATION: 'In Vorbereitung',
  REVIEW: 'In Prüfung',
  READY_FOR_SUBMISSION: 'Bereit zur Einreichung',
  SUBMITTED: 'Einreichung veranlasst',
  AUTHORITY_PROCESSING: 'Bei der Behörde',
  PLATES_AND_ORIGINALS: 'Kontrollschilder und Originale',
  HANDOVER_RELEASABLE: 'Übergabe prüfbar',
  HANDED_OVER: 'Übergeben',
  CLOSED: 'Abgeschlossen',
  ON_HOLD: 'Pausiert',
  CANCELLED: 'Storniert',
};

export interface CaseListItem {
  id: string;
  status: CaseState;
  statusLabel: string;
  canton: string;
  vehicleLabel: string;
  dealerName: string;
  buyerName: string;
  nextAction: string | null;
  updatedAt: Date;
  openReviewCount: number;
}

const TERMINAL_STATUSES: CaseStatus[] = ['CLOSED', 'CANCELLED'];
const ACTIVE_FILTER = { notIn: TERMINAL_STATUSES };

export async function listCustomerCases(actor: Actor): Promise<CaseListItem[]> {
  const rows = await db.registrationCase.findMany({
    where: { customerUserId: actor.userId },
    orderBy: { updatedAt: 'desc' },
    include: { organization: true, _count: { select: { reviewItems: { where: { status: 'OPEN' } } } } },
  });
  return Promise.all(rows.map(async (row) => toListItem(row)));
}

export async function listDealerCases(actor: Actor, organizationId: string): Promise<CaseListItem[]> {
  if (!membershipIn(actor, organizationId)) {
    throw new DomainError('NOT_FOUND', 'Die Organisation wurde nicht gefunden.');
  }
  const rows = await db.registrationCase.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
    include: { organization: true, _count: { select: { reviewItems: { where: { status: 'OPEN' } } } } },
  });
  return Promise.all(rows.map(async (row) => toListItem(row)));
}

async function toListItem(row: {
  id: string;
  status: string;
  canton: string;
  nextAction: string | null;
  updatedAt: Date;
  organization: { name: string };
  vehicleId: string;
  saleId: string;
  _count: { reviewItems: number };
}): Promise<CaseListItem> {
  const [vehicle, sale] = await Promise.all([
    db.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId }, select: { make: true, model: true } }),
    db.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId }, select: { buyerName: true } }),
  ]);
  return {
    id: row.id,
    status: row.status as CaseState,
    statusLabel: STATUS_LABELS[row.status as CaseState],
    canton: row.canton,
    vehicleLabel: `${vehicle.make} ${vehicle.model}`,
    dealerName: row.organization.name,
    buyerName: sale.buyerName,
    nextAction: row.nextAction,
    updatedAt: row.updatedAt,
    openReviewCount: row._count.reviewItems,
  };
}

export type ViewerRole = 'CUSTOMER' | 'DEALER' | 'OPERATOR';

export interface CaseView {
  id: string;
  viewerRole: ViewerRole;
  status: CaseState;
  statusLabel: string;
  canton: string;
  cantonName: string;
  caseType: string;
  caseTypeLabel: string;
  nextAction: string | null;
  onHold: boolean;
  createdAt: Date;
  vehicle: { vin: string; make: string; model: string; isNew: boolean; previousRegistration: string };
  sale: { buyerName: string; buyerEmail: string; saleDate: Date; plannedHandoverDate: Date | null; priceChf: number | null };
  dealerName: string;
  timeline: TimelineStep[];
  requirements: { key: string; title: string; status: string; verified: boolean; note: string | null; category: string }[];
  documents: {
    id: string;
    kind: string;
    kindLabel: string;
    title: string;
    status: string;
    scanStatus: string;
    rejectionReason: string | null;
    latestVersionId: string | null;
    versionCount: number;
    fields: { id: string; key: string; value: string; suggested: string; confidence: number; status: string }[];
  }[];
  insurance: { status: InsuranceState; label: string; externalReference: string | null; simulated: boolean };
  handover: { level: HandoverDecision['level']; message: string; blockers: string[]; simulatedSources: string[] };
  reviews: { id: string; title: string; detail: string | null; kind: string }[];
  submissions: { id: string; status: string; channelReference: string | null; createdAt: Date }[];
  authorityResponses: { id: string; kind: string; source: string; reference: string | null; createdAt: Date }[];
  temporaryAuthorizations: { id: string; reference: string; validUntil: Date | null; source: string }[];
  events: { id: string; message: string; source: string; createdAt: Date }[];
  confirmation: { confirmedAt: Date; textVersion: string } | null;
  actions: {
    canConfirmPurchase: boolean;
    canUploadDocuments: boolean;
    canSubmitDocuments: boolean;
    canInvite: boolean;
    canStartSubmission: boolean;
    canMarkReady: boolean;
    canMoveToHandover: boolean;
    canConfirmHandover: boolean;
    canResolveReviews: boolean;
  };
}

const CUSTOMER_EVENT_TYPES = ['STATUS_CHANGED', 'INSURANCE_STATUS_CHANGED', 'DOCUMENT_VERIFIED', 'DOCUMENT_UPLOADED', 'OVERRIDE_APPLIED'];

export async function getCaseView(actor: Actor, caseId: string): Promise<CaseView> {
  const row = await db.registrationCase.findUnique({ where: { id: caseId }, include: { organization: true } });
  if (!row || !canAccessCase(actor, row)) {
    throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
  }
  const viewerRole: ViewerRole = isOperator(actor) ? 'OPERATOR' : row.customerUserId === actor.userId ? 'CUSTOMER' : 'DEALER';
  const internal = viewerRole !== 'CUSTOMER';

  const [vehicle, sale, requirements, documents, insurance, reviews, submissions, responses, tempAuths, events, confirmation, gateFacts] =
    await Promise.all([
      db.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId } }),
      db.vehicleSale.findUniqueOrThrow({ where: { id: row.saleId } }),
      db.caseRequirement.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } }),
      db.document.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, include: { extraction: { include: { fields: true } } } },
        },
      }),
      db.insuranceRequest.findUnique({ where: { caseId }, include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
      db.reviewItem.findMany({ where: { caseId, status: 'OPEN' }, orderBy: { createdAt: 'asc' } }),
      db.authoritySubmission.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } }),
      db.authorityResponse.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } }),
      db.temporaryAuthorization.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } }),
      db.workflowEvent.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.purchaseConfirmation.findUnique({ where: { saleId: row.saleId } }),
      buildGateFactsForView(caseId),
    ]);

  const insuranceStatus = (insurance?.status ?? 'NOT_STARTED') as InsuranceState;
  const latestInsuranceEvent = insurance?.events[0] ?? null;
  const insuranceFromSimulation = latestInsuranceEvent?.source === 'SIMULATION';
  const decision = handoverDecision(gateFacts);

  const authorityConfirmation = responses.find((r) => r.kind === 'REGISTRATION_CONFIRMED') ?? null;
  const plateAndOriginalsDone = requirements
    .filter((r) => r.category === 'PLATE' || r.category === 'ORIGINAL')
    .every((r) => r.status === 'SATISFIED');

  const timeline = buildTimeline({
    status: row.status as CaseState,
    onHold: row.status === 'ON_HOLD',
    insurance: insuranceStatus,
    insuranceFromSimulation,
    documentsSubmitted: false,
    authorityConfirmed: authorityConfirmation !== null && authorityConfirmation.source !== 'SIMULATION',
    authorityFromSimulation: authorityConfirmation?.source === 'SIMULATION',
    plateAndOriginalsDone,
  });

  const status = row.status as CaseState;
  const isActive = !TERMINAL_STATUSES.includes(row.status);
  const dealerRole = viewerRole === 'DEALER' ? membershipIn(actor, row.organizationId)?.role : null;

  return {
    id: row.id,
    viewerRole,
    status,
    statusLabel: STATUS_LABELS[status],
    canton: row.canton,
    cantonName: CANTONS[row.canton as keyof typeof CANTONS] ?? row.canton,
    caseType: row.caseType,
    caseTypeLabel: CASE_TYPE_LABELS[row.caseType] ?? row.caseType,
    nextAction: row.nextAction,
    onHold: status === 'ON_HOLD',
    createdAt: row.createdAt,
    vehicle: {
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      isNew: vehicle.isNew,
      previousRegistration: vehicle.previousRegistration,
    },
    sale: {
      buyerName: sale.buyerName,
      buyerEmail: sale.buyerEmail,
      saleDate: sale.saleDate,
      plannedHandoverDate: sale.plannedHandoverDate,
      priceChf: sale.priceChf,
    },
    dealerName: row.organization.name,
    timeline,
    requirements: requirements.map((r) => ({
      key: r.ruleKey,
      title: r.title,
      status: r.status,
      verified: r.verification === 'VERIFIED_RULE',
      note: internal ? r.note : null,
      category: r.category,
    })),
    documents: documents.map((d) => {
      const latest = d.versions[0];
      const fields = latest?.extraction?.fields ?? [];
      return {
        id: d.id,
        kind: d.kind,
        kindLabel: documentKindLabel(d.kind),
        title: d.title,
        status: d.status,
        scanStatus: d.scanStatus,
        rejectionReason: d.rejectionReason,
        latestVersionId: latest?.id ?? null,
        versionCount: d.versions.length,
        fields: fields.map((f) => ({
          id: f.id,
          key: f.fieldKey,
          value: f.confirmedValue ?? f.suggestedValue,
          suggested: f.suggestedValue,
          confidence: f.confidence,
          status: f.status,
        })),
      };
    }),
    insurance: {
      status: insuranceStatus,
      label: INSURANCE_LABELS[insuranceStatus],
      externalReference: internal ? insurance?.externalReference ?? null : null,
      simulated: insuranceFromSimulation,
    },
    handover: {
      level: decision.level,
      message: handoverMessage(decision),
      blockers: decision.blockers.map((b) => b.message),
      simulatedSources: decision.simulatedSources,
    },
    reviews: internal
      ? reviews.map((r) => ({ id: r.id, title: r.title, detail: viewerRole === 'OPERATOR' ? r.detail : null, kind: r.kind }))
      : reviews.filter((r) => r.kind === 'OVERRIDE_REQUEST').map((r) => ({ id: r.id, title: r.title, detail: null, kind: r.kind })),
    submissions: internal ? submissions.map((s) => ({ id: s.id, status: s.status, channelReference: s.channelReference, createdAt: s.createdAt })) : [],
    authorityResponses: internal ? responses.map((r) => ({ id: r.id, kind: r.kind, source: r.source, reference: r.reference, createdAt: r.createdAt })) : [],
    temporaryAuthorizations: internal ? tempAuths.map((t) => ({ id: t.id, reference: t.reference, validUntil: t.validUntil, source: t.source })) : [],
    events: events
      .filter((e) => internal || CUSTOMER_EVENT_TYPES.includes(e.type))
      .map((e) => ({ id: e.id, message: e.message, source: e.source, createdAt: e.createdAt })),
    confirmation: confirmation ? { confirmedAt: confirmation.confirmedAt, textVersion: confirmation.textVersion } : null,
    actions: {
      canConfirmPurchase: viewerRole === 'CUSTOMER' && status === 'INVITED',
      canUploadDocuments: viewerRole === 'CUSTOMER' && (status === 'PURCHASE_CONFIRMED' || status === 'PREPARATION'),
      canSubmitDocuments: viewerRole === 'CUSTOMER' && status === 'PREPARATION',
      canInvite: viewerRole === 'DEALER' && dealerRole !== null && (status === 'SALE_CREATED' || status === 'INVITED'),
      canStartSubmission: viewerRole === 'OPERATOR' && status === 'READY_FOR_SUBMISSION',
      canMarkReady: viewerRole === 'OPERATOR' && status === 'REVIEW',
      canMoveToHandover: viewerRole === 'OPERATOR' && status === 'PLATES_AND_ORIGINALS',
      canConfirmHandover: viewerRole === 'DEALER' && status === 'HANDOVER_RELEASABLE' && decision.level !== 'BLOCKED',
      canResolveReviews: viewerRole === 'OPERATOR' && isActive,
    },
  };
}

// Benutzerführung: Was genau ist bei der Übergabe offen?
export function handoverMessage(decision: HandoverDecision): string {
  if (decision.level === 'RELEASED') {
    return 'Ihr Fahrzeug kann übergeben werden.';
  }
  if (decision.level === 'DEMO_SIMULATED') {
    return `Demo: Übergabe simuliert. Simulierte Bestätigungen: ${decision.simulatedSources.join(', ')}. Dies ist keine reale Freigabe.`;
  }
  return `Übergabe noch nicht möglich: ${decision.blockers.map((b) => b.message).join(' ')}`;
}

export interface DealerDashboard {
  kpis: {
    openCases: number;
    awaitingCustomer: number;
    missingDocuments: number;
    criticalDelays: number;
    completedCases: number;
    averageDays: number | null;
    upcomingHandovers: number;
  };
  attention: { caseId: string; title: string; reason: string }[];
}

export async function getDealerDashboard(actor: Actor, organizationId: string): Promise<DealerDashboard> {
  if (!membershipIn(actor, organizationId)) {
    throw new DomainError('NOT_FOUND', 'Die Organisation wurde nicht gefunden.');
  }
  const now = new Date();
  const criticalBefore = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [active, completed, openReviewCases, missingDocCases] = await Promise.all([
    db.registrationCase.findMany({
      where: { organizationId, status: ACTIVE_FILTER },
      include: { sale: { select: { buyerName: true, plannedHandoverDate: true } }, vehicle: { select: { make: true, model: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.registrationCase.findMany({
      where: { organizationId, status: 'CLOSED', closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 500,
    }),
    db.reviewItem.findMany({
      where: { status: 'OPEN', case: { organizationId } },
      select: { caseId: true, title: true },
      take: 20,
    }),
    db.caseRequirement.findMany({
      where: { status: 'OPEN', documentKind: { not: null }, case: { organizationId, status: 'PREPARATION' } },
      select: { caseId: true },
    }),
  ]);

  const missingCaseIds = new Set(missingDocCases.map((m) => m.caseId));
  const awaitingCustomer = active.filter((c) => c.status === 'INVITED' || c.status === 'PREPARATION').length;
  const criticalCases = active.filter((c) => c.createdAt < criticalBefore);
  const upcoming = active.filter(
    (c) => c.sale.plannedHandoverDate && c.sale.plannedHandoverDate >= now && c.sale.plannedHandoverDate <= weekAhead,
  );

  const durations = completed
    .filter((c) => c.closedAt)
    .map((c) => (c.closedAt!.getTime() - c.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const averageDays = durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;

  const attention = [
    ...openReviewCases.map((r) => ({ caseId: r.caseId, title: r.title, reason: 'Offene Prüfung' })),
    ...active
      .filter((c) => missingCaseIds.has(c.id))
      .map((c) => ({ caseId: c.id, title: `${c.sale.buyerName}, ${c.vehicle.make} ${c.vehicle.model}`, reason: 'Dokumente fehlen' })),
  ].slice(0, 10);

  return {
    kpis: {
      openCases: active.length,
      awaitingCustomer,
      missingDocuments: missingCaseIds.size,
      criticalDelays: criticalCases.length,
      completedCases: completed.length,
      averageDays,
      upcomingHandovers: upcoming.length,
    },
    attention,
  };
}

export async function getOperationsQueue() {
  const [reviews, queuedSubmissions, deadLetters, documentsToVerify, insuranceOpen] = await Promise.all([
    db.reviewItem.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { case: { select: { id: true, canton: true, status: true, sale: { select: { buyerName: true } } } } },
    }),
    db.authoritySubmission.findMany({ where: { status: 'QUEUED_MANUAL' }, orderBy: { createdAt: 'asc' }, take: 50 }),
    db.workflowTask.findMany({ where: { status: 'DEAD_LETTER' }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    db.document.findMany({
      where: { status: 'UPLOADED', caseId: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, title: true, kind: true, caseId: true, createdAt: true },
    }),
    db.insuranceRequest.findMany({
      where: { status: { in: ['REQUESTED', 'IN_PROGRESS', 'PROBLEM', 'NOT_VERIFIED'] } },
      take: 100,
      select: { caseId: true, status: true, updatedAt: true },
    }),
  ]);
  return { reviews, queuedSubmissions, deadLetters, documentsToVerify, insuranceOpen };
}

export async function getAdminOverview() {
  const [rulesets, auditLog, counts] = await Promise.all([
    db.cantonRuleset.findMany({ orderBy: [{ canton: 'asc' }, { version: 'desc' }] }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    Promise.all([db.user.count(), db.organization.count(), db.registrationCase.count(), db.workflowTask.count({ where: { status: 'DEAD_LETTER' } })]),
  ]);
  return {
    rulesets: rulesets.map((r) => ({ id: r.id, canton: r.canton, version: r.version, status: r.status, ruleCount: (r.rules as unknown[]).length, sourceUrls: r.sourceUrls as string[] })),
    auditLog,
    counts: { users: counts[0], organizations: counts[1], cases: counts[2], deadLetters: counts[3] },
  };
}

