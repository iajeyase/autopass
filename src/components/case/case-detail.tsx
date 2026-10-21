import { CheckCircle2, Circle, Clock, AlertTriangle, PauseCircle, ShieldCheck, XCircle, Download } from 'lucide-react';
import type { CaseView } from '@/services/query-service';
import { formatChf, formatConfidence, formatDate, formatDateTime } from '@/lib/format';
import { VERIFICATION_LABELS, type TimelineStep } from '@/domain/timeline';
import { Alert, Badge, Card, DemoBadge, EmptyState, cn } from '@/components/ui';
import {
  AuthorityResponseForm,
  ConfirmPurchaseForm,
  FieldCorrectionForm,
  HandoverCheckButton,
  HandoverConfirmButton,
  InsuranceEvidenceForm,
  InviteButton,
  ManualSubmissionForm,
  MoveCaseButton,
  PauseCaseForm,
  RejectDocumentForm,
  RequirementConfirmForm,
  ResumeCaseForm,
  ReviewResolveForm,
  RunTasksButton,
  SimulateAuthorityButtons,
  SimulateFailureForm,
  SimulateInsuranceButtons,
  StartSubmissionButton,
  SubmitDocumentsButton,
  TemporaryAuthorizationForm,
  UploadDocumentForm,
  VerifyDocumentButton,
} from './client-actions';
import { env } from '@/lib/env';

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM: 'System',
  CUSTOMER: 'Käufer',
  DEALER: 'Händler',
  OPERATOR: 'AutoPass-Team',
  PARTNER_WEBHOOK: 'Partner',
  SIMULATION: 'Simulation (Demo)',
};

const DOC_STATUS: Record<string, { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }> = {
  UPLOADED: { label: 'Noch nicht geprüft', tone: 'warning' },
  VERIFIED: { label: 'Vom Team geprüft', tone: 'success' },
  REJECTED: { label: 'Abgelehnt', tone: 'danger' },
};

const STEP_ICON = {
  done: CheckCircle2,
  current: Clock,
  open: Circle,
  blocked: PauseCircle,
} as const;

export function CaseDetail({ view }: { view: CaseView }) {
  const isOperator = view.viewerRole === 'OPERATOR';
  const isDealer = view.viewerRole === 'DEALER';
  const isCustomer = view.viewerRole === 'CUSTOMER';
  const demo = env().DEMO_MODE;
  const openDocumentKinds = view.requirements
    .filter((r) => r.status === 'OPEN' && r.category === 'DOCUMENT')
    .map((r) => r.key);
  const insuranceEvidence = view.documents.filter((d) => d.kind === 'INSURANCE_EVIDENCE' && d.status === 'VERIFIED');

  const customerUploadKinds = isCustomer ? ['IDENTITY', 'VEHICLE_REGISTRATION', 'INSPECTION_REPORT_13_20A', 'INSURANCE_EVIDENCE', 'PURCHASE_CONTRACT', 'POWER_OF_ATTORNEY', 'RESIDENCE_PROOF', 'COMMERCIAL_REGISTER', 'OTHER'] : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={view.onHold ? 'warning' : 'accent'}>{view.statusLabel}</Badge>
          <Badge>{view.cantonName} ({view.canton})</Badge>
          {view.handover.level === 'DEMO_SIMULATED' && <DemoBadge>Übergabe simuliert</DemoBadge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {view.vehicle.make} {view.vehicle.model}
        </h1>
        <p className="text-sm text-muted">
          {view.caseTypeLabel} · VIN {view.vehicle.vin} · {isCustomer ? view.dealerName : view.sale.buyerName}
        </p>
      </header>

      {view.onHold && (
        <Alert tone="warning" title="Der Fall ist pausiert">
          Das AutoPass-Team bearbeitet den Fall. Es sind keine Aktionen von Ihrer Seite nötig, bis er wieder aufgenommen wird.
        </Alert>
      )}

      {view.nextAction && !view.onHold && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent-soft p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Nächster Schritt</p>
            <p className="mt-1 font-medium">{view.nextAction}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card title="Fortschritt" description="Jeder Schritt zeigt, wer ihn verantwortet und woher die Angabe stammt.">
            <Timeline steps={view.timeline} />
          </Card>

          {isCustomer && view.actions.canConfirmPurchase && (
            <Card title="Angaben bestätigen" description="Prüfen Sie Händler, Fahrzeug und Ihre Angaben. Die Bestätigung ist eine Prozessbestätigung, kein Kaufvertrag.">
              <dl className="mb-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Entry label="Händler" value={view.dealerName} />
                <Entry label="Fahrzeug" value={`${view.vehicle.make} ${view.vehicle.model}`} />
                <Entry label="VIN" value={view.vehicle.vin} />
                <Entry label="Kanton" value={view.cantonName} />
                <Entry label="Verkaufsdatum" value={formatDate(view.sale.saleDate)} />
                <Entry label="Kaufpreis" value={formatChf(view.sale.priceChf)} />
              </dl>
              <ConfirmPurchaseForm caseId={view.id} />
            </Card>
          )}

          {(isCustomer || isOperator) && (view.actions.canUploadDocuments || view.documents.length > 0) && (
            <Card
              title="Dokumente"
              description={
                isCustomer
                  ? 'Laden Sie Ihre Unterlagen hoch. Erkannte Werte prüfen Sie und korrigieren Sie bei Bedarf.'
                  : 'Dokumente prüfen, Werte kontrollieren und verifizieren.'
              }
            >
              {view.documents.length === 0 && <EmptyState title="Noch keine Dokumente" text="Sobald Sie Unterlagen hochladen, erscheinen sie hier." />}
              <ul className="space-y-4">
                {view.documents.map((doc) => (
                  <li key={doc.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-muted">{doc.kindLabel} · Version {doc.versionCount}</p>
                      </div>
                      <Badge tone={DOC_STATUS[doc.status]?.tone ?? 'neutral'}>{DOC_STATUS[doc.status]?.label ?? doc.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Malwarescan: {doc.scanStatus === 'NOT_SCANNED' ? 'nicht durchgeführt (MVP)' : doc.scanStatus === 'CLEAN' ? 'ohne Befund' : 'Befund'}
                    </p>
                    {doc.rejectionReason && (
                      <Alert tone="danger" className="mt-3">
                        {doc.rejectionReason}
                      </Alert>
                    )}
                    {doc.latestVersionId && (
                      <a
                        href={`/api/documents/${doc.latestVersionId}`}
                        className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-accent"
                      >
                        <Download className="size-4" aria-hidden /> Herunterladen
                      </a>
                    )}
                    {doc.fields.length > 0 && (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">Erkannte Angaben (Vorschlag)</p>
                        {doc.fields.map((field) => (
                          <div key={field.id} className="space-y-1">
                            <p className="text-sm">
                              <span className="text-muted">{fieldLabel(field.key)}:</span> <span className="font-medium break-all">{field.value}</span>{' '}
                              <span className="text-xs text-muted">· Konfidenz {formatConfidence(field.confidence)} · {field.status === 'SUGGESTED' ? 'nicht bestätigt' : field.status === 'CONFIRMED' ? 'bestätigt' : 'korrigiert'}</span>
                            </p>
                            {(isCustomer || isOperator) && doc.latestVersionId && (
                              <FieldCorrectionForm versionId={doc.latestVersionId} fieldKey={field.key} label={fieldLabel(field.key)} suggested={field.suggested} />
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-muted">Demo-Extraktion. Keine echte Texterkennung. Jede Änderung wird protokolliert.</p>
                      </div>
                    )}
                    {isOperator && doc.status !== 'VERIFIED' && (
                      <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
                        <VerifyDocumentButton documentId={doc.id} />
                        <div className="w-full sm:max-w-md">
                          <RejectDocumentForm documentId={doc.id} />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {isCustomer && view.actions.canUploadDocuments && (
                <div className="mt-6 border-t border-border pt-6">
                  <UploadDocumentForm caseId={view.id} kinds={customerUploadKinds} />
                </div>
              )}
              {isCustomer && view.actions.canSubmitDocuments && (
                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                  {openDocumentKinds.length > 0 && (
                    <p className="text-sm text-muted">Noch offen: {view.requirements.filter((r) => r.status === 'OPEN' && r.category === 'DOCUMENT').map((r) => r.title).join(', ')}</p>
                  )}
                  <SubmitDocumentsButton caseId={view.id} />
                </div>
              )}
            </Card>
          )}

          {!isCustomer && (
            <Card title="Anforderungen" description="Aus dem kantonalen Regelwerk abgeleitet. Nicht verifizierte Regeln brauchen eine manuelle Prüfung.">
              <ul className="divide-y divide-border">
                {view.requirements.map((req) => (
                  <li key={req.key} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{req.title}</p>
                      <div className="flex gap-2">
                        {!req.verified && <Badge tone="warning">Regel nicht verifiziert</Badge>}
                        <Badge tone={req.status === 'SATISFIED' ? 'success' : 'neutral'}>{req.status === 'SATISFIED' ? 'Erfüllt' : 'Offen'}</Badge>
                      </div>
                    </div>
                    {req.note && isOperator && <p className="mt-1 text-xs text-muted">{req.note}</p>}
                    {isOperator && req.status === 'OPEN' && req.category !== 'DOCUMENT' && req.category !== 'INSURANCE' && (
                      <div className="mt-3">
                        <RequirementConfirmForm caseId={view.id} ruleKey={req.key} title={req.title} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {view.requirements.length === 0 && <EmptyState title="Noch keine Anforderungen" text="Die Anforderungen entstehen nach der Kaufbestätigung." />}
            </Card>
          )}

          <Card title="Verlauf" description={isCustomer ? 'Die wichtigsten Stationen Ihres Vorgangs.' : 'Vollständiger, unveränderlicher Verlauf.'}>
            <ol className="space-y-4">
              {view.events.length === 0 && <p className="text-sm text-muted">Noch keine Einträge.</p>}
              {view.events.map((event) => (
                <li key={event.id} className="border-l-2 border-border pl-4">
                  <p className="text-sm">{event.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(event.createdAt)} · {SOURCE_LABELS[event.source] ?? event.source}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Versicherungsnachweis">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={view.insurance.status === 'CONFIRMED' ? 'success' : view.insurance.status === 'PROBLEM' ? 'danger' : 'accent'}>
                  {view.insurance.label}
                </Badge>
                {view.insurance.simulated && <DemoBadge>Simulation</DemoBadge>}
              </div>
              <p className="text-sm text-muted">
                Der Versicherungsnachweis wird durch die Versicherung an die zuständige Stelle übermittelt. AutoPass erstellt keinen eigenen Nachweis.
              </p>
              {isOperator && view.insurance.externalReference && <p className="text-xs text-muted">Referenz Partner: {view.insurance.externalReference}</p>}
              {isCustomer && view.insurance.status === 'NOT_STARTED' && <p className="text-sm">Ihr Vorgang wird vorbereitet.</p>}
            </div>
            {isOperator && (
              <div className="mt-5 space-y-5 border-t border-border pt-5">
                <div>
                  <p className="mb-2 text-sm font-medium">Bestehende Versicherung belegen</p>
                  <InsuranceEvidenceForm caseId={view.id} documents={insuranceEvidence.map((d) => ({ id: d.id, title: d.title }))} />
                </div>
                {demo && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Demo: Versicherer simulieren</p>
                    <SimulateInsuranceButtons caseId={view.id} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Übergabe">
            <HandoverPanel view={view} isDealer={isDealer} />
          </Card>

          {(isOperator || isDealer) && view.reviews.length > 0 && (
            <Card title="Offene Prüfungen" description={isOperator ? undefined : 'Diese Punkte klärt das AutoPass-Team.'}>
              <ul className="space-y-4">
                {view.reviews.map((review) => (
                  <li key={review.id} className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{review.title}</p>
                    {review.detail && <p className="text-xs text-muted">{review.detail}</p>}
                    {isOperator && <ReviewResolveForm reviewId={review.id} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isDealer && view.actions.canInvite && (
            <Card title="Käufer einladen" description="Der Link ist 14 Tage gültig. Der Käufer muss sich mit der hinterlegten E-Mail-Adresse anmelden.">
              <InviteButton caseId={view.id} />
            </Card>
          )}

          {isOperator && (
            <OperatorPanel view={view} demo={demo} />
          )}
        </aside>
      </div>
    </div>
  );
}

function HandoverPanel({ view, isDealer }: { view: CaseView; isDealer: boolean }) {
  const tone = view.handover.level === 'RELEASED' ? 'success' : view.handover.level === 'DEMO_SIMULATED' ? 'demo' : 'warning';
  const Icon = view.handover.level === 'RELEASED' ? CheckCircle2 : view.handover.level === 'DEMO_SIMULATED' ? AlertTriangle : XCircle;
  return (
    <div className="space-y-4">
      <Alert tone={tone}>
        <span className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{view.handover.message}</span>
        </span>
      </Alert>
      {view.handover.blockers.length > 0 && (
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          {view.handover.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {view.viewerRole === 'OPERATOR' && view.actions.canMoveToHandover && <HandoverCheckButton caseId={view.id} />}
      {isDealer && view.actions.canConfirmHandover && <HandoverConfirmButton caseId={view.id} />}
      <p className="text-xs text-muted">
        Eine Übergabe wird nur freigegeben, wenn Zulassung, Versicherungsnachweis, Kontrollschilder und Originaldokumente belegt sind und keine Prüfung offen ist.
      </p>
    </div>
  );
}

function OperatorPanel({ view, demo }: { view: CaseView; demo: boolean }) {
  const canPause = !['CLOSED', 'CANCELLED', 'HANDED_OVER', 'ON_HOLD'].includes(view.status);
  const submissionOpen = view.submissions.find((s) => s.status === 'QUEUED_MANUAL' || s.status === 'PREPARED');
  const verifiedAuthDocs = view.documents.filter((d) => d.status === 'VERIFIED').map((d) => ({ id: d.id, title: d.title }));
  return (
    <Card title="Operations-Aktionen" description="Nur für das AutoPass-Team. Jede Aktion wird mit Benutzer, Zeitpunkt und Quelle protokolliert.">
      <div className="space-y-6">
        <section className="space-y-3">
          <p className="text-sm font-medium">Fallstatus</p>
          <div className="flex flex-wrap gap-2">
            {view.actions.canMarkReady && <MoveCaseButton caseId={view.id} to="READY_FOR_SUBMISSION" label="Bereit zur Einreichung" message="Alle Prüfungen abgeschlossen, Fall ist bereit zur Einreichung." />}
            {view.actions.canStartSubmission && <StartSubmissionButton caseId={view.id} />}
          </div>
          {submissionOpen && <ManualSubmissionForm caseId={view.id} submissionId={submissionOpen.id} />}
          {view.submissions.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {view.submissions.map((s) => (
                <li key={s.id}>
                  Einreichung {formatDateTime(s.createdAt)}: {s.status}
                  {s.channelReference ? ` · Referenz ${s.channelReference}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        {(view.status === 'SUBMITTED' || view.status === 'AUTHORITY_PROCESSING') && (
          <section className="space-y-3 border-t border-border pt-5">
            <p className="text-sm font-medium">Behördenantwort erfassen</p>
            <AuthorityResponseForm caseId={view.id} />
            {demo && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted">Demo-Simulation (keine reale Behördenantwort):</p>
                <SimulateAuthorityButtons caseId={view.id} />
              </div>
            )}
          </section>
        )}

        {(view.status === 'AUTHORITY_PROCESSING' || view.status === 'PLATES_AND_ORIGINALS') && (
          <section className="space-y-3 border-t border-border pt-5">
            <p className="text-sm font-medium">Vorläufige Berechtigung der Behörde</p>
            <TemporaryAuthorizationForm caseId={view.id} documents={verifiedAuthDocs} />
          </section>
        )}

        {view.authorityResponses.length > 0 && (
          <ul className="space-y-1 text-xs text-muted">
            {view.authorityResponses.map((r) => (
              <li key={r.id}>
                {formatDateTime(r.createdAt)} · {r.kind} · {SOURCE_LABELS[r.source] ?? r.source}
                {r.reference ? ` · Ref. ${r.reference}` : ''}
              </li>
            ))}
          </ul>
        )}

        <section className="space-y-3 border-t border-border pt-5">
          <p className="text-sm font-medium">Pause und Wiederaufnahme</p>
          {canPause && <PauseCaseForm caseId={view.id} />}
          {view.onHold && <ResumeCaseForm caseId={view.id} />}
        </section>

        {demo && (
          <section className="space-y-3 border-t border-border pt-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              Demo-Werkzeuge <DemoBadge>Simulation</DemoBadge>
            </p>
            <SimulateFailureForm caseId={view.id} />
            <RunTasksButton />
          </section>
        )}
      </div>
    </Card>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-6">
      {steps.map((step, index) => {
        const Icon = STEP_ICON[step.state];
        return (
          <li key={step.key} className="relative flex gap-4" aria-current={step.state === 'current' ? 'step' : undefined}>
            {index < steps.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%+8px)] w-px bg-border" />}
            <span
              className={cn(
                'relative z-10 grid size-8 shrink-0 place-items-center rounded-full',
                step.state === 'done' && 'bg-success-soft text-success',
                step.state === 'current' && 'bg-accent-soft text-accent',
                step.state === 'blocked' && 'bg-warning-soft text-warning',
                step.state === 'open' && 'bg-surface-muted text-muted',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className={cn('font-medium', step.state === 'open' && 'text-muted')}>{step.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {step.responsibleParty} · {step.dataSource}
              </p>
              <p className="mt-1 text-xs">
                <span className={cn(step.verification === 'SIMULATION' && 'text-demo', step.verification === 'NOT_VERIFIED' && 'text-warning')}>
                  {VERIFICATION_LABELS[step.verification]}
                </span>
              </p>
              {step.state === 'current' && step.nextAction && <p className="mt-2 text-sm font-medium text-accent">{step.nextAction}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Entry({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    vin: 'Fahrgestellnummer',
    plateNumber: 'Kontrollschild',
    make: 'Marke',
    model: 'Modell',
    firstRegistrationDate: 'Erstzulassung',
    holderName: 'Halter',
  };
  return labels[key] ?? key;
}

