'use client';

import { useState } from 'react';
import { ActionButton } from '@/components/forms/action-button';
import { ActionForm, SubmitButton } from '@/components/forms/action-form';
import { CheckField, SelectField, TextAreaField, TextField } from '@/components/forms/fields';
import { Alert, buttonClass } from '@/components/ui';
import {
  addTeamMemberAction,
  confirmInsuranceEvidenceAction,
  confirmPurchaseAction,
  correctFieldAction,
  createInvitationAction,
  confirmHandoverAction,
  markRequirementAction,
  moveCaseAction,
  pauseCaseAction,
  recordAuthorityResponseAction,
  recordManualSubmissionAction,
  recordTemporaryAuthorizationAction,
  rejectDocumentAction,
  resolveReviewAction,
  resumeCaseAction,
  retryTaskAction,
  runTasksAction,
  simulateAuthorityAction,
  simulateInsuranceAction,
  simulateFailureFormAction,
  startSubmissionAction,
  submitDocumentsAction,
  uploadDocumentAction,
  verifyDocumentAction,
  handoverCheckAction,
  markNotificationsReadAction,
} from '@/app/actions';
import { DOCUMENT_KIND_OPTIONS, AUTHORITY_KIND_OPTIONS, INSURANCE_SIMULATION_OPTIONS } from './options';

export function ConfirmPurchaseForm({ caseId }: { caseId: string }) {
  const action = confirmPurchaseAction.bind(null, caseId);
  return (
    <ActionForm action={action}>
      <div className="space-y-4">
        <CheckField
          name="acceptProcessConfirmation"
          label={
            <>
              Ich habe Händler, Fahrzeug und meine Angaben geprüft. Dies ist eine <strong>Prozessbestätigung</strong> und ersetzt keinen Kaufvertrag.
            </>
          }
        />
        <CheckField name="acceptDataProcessing" label="Ich stimme zu, dass AutoPass meine Daten für diesen Zulassungsprozess bearbeitet." />
      </div>
      <SubmitButton className="mt-6 h-12 w-full sm:w-auto">Kauf bestätigen</SubmitButton>
    </ActionForm>
  );
}

export function UploadDocumentForm({ caseId, kinds }: { caseId: string; kinds?: string[] }) {
  const options = kinds ? DOCUMENT_KIND_OPTIONS.filter((o) => kinds.includes(o.value)) : DOCUMENT_KIND_OPTIONS;
  return (
    <ActionForm<{ documentId: string }> action={uploadDocumentAction} successMessage="Dokument hochgeladen. Es wird geprüft.">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="kind" label="Dokumentart" options={options} defaultValue={options[0]?.value} />
        <TextField name="title" label="Bezeichnung" placeholder="z. B. Fahrzeugausweis Vorderseite" />
      </div>
      <div className="mt-4">
        <label htmlFor="file" className="text-sm font-medium">
          Datei
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          capture="environment"
          className="mt-1.5 block w-full rounded-xl border border-dashed border-border bg-surface p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-medium file:text-accent"
        />
        <p className="mt-1 text-xs text-muted">PDF, JPEG oder PNG, höchstens 10 MB. Auf dem Smartphone können Sie direkt fotografieren.</p>
      </div>
      <SubmitButton className="mt-5 h-11 w-full sm:w-auto" pendingLabel="Wird hochgeladen und geprüft …">
        Dokument hochladen
      </SubmitButton>
    </ActionForm>
  );
}

export function SubmitDocumentsButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton run={() => submitDocumentsAction(caseId)} successText="Unterlagen sind eingereicht. Das Team prüft sie." pendingLabel="Wird eingereicht …">
      Unterlagen einreichen
    </ActionButton>
  );
}

export function FieldCorrectionForm({ versionId, fieldKey, label, suggested }: { versionId: string; fieldKey: string; label: string; suggested: string }) {
  return (
    <ActionForm action={correctFieldAction} successMessage="Wert gespeichert.">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="fieldKey" value={fieldKey} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField name="value" label={`${label} (erkannt: ${suggested})`} defaultValue={suggested} />
        </div>
        <SubmitButton variant="secondary" className="h-11">
          Speichern
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InviteButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton
      run={() => createInvitationAction(caseId)}
      pendingLabel="Link wird erstellt …"
      onResult={(data) => <InviteLink url={data.url} expiresAt={data.expiresAt} />}
    >
      Einladungslink erzeugen
    </ActionButton>
  );
}

function InviteLink({ url, expiresAt }: { url: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p>Link erstellt. Er ist bis {new Date(expiresAt).toLocaleDateString('de-CH')} gültig und wird nur einmal angezeigt.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={url} aria-label="Einladungslink" className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm" />
        <button
          type="button"
          className={buttonClass('secondary', 'h-11')}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  );
}

export function HandoverConfirmButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton
      run={() => confirmHandoverAction(caseId)}
      confirmText="Fahrzeugübergabe jetzt bestätigen? Der Fall wird danach abgeschlossen."
      successText="Übergabe bestätigt. Der Fall ist abgeschlossen."
    >
      Übergabe bestätigen
    </ActionButton>
  );
}

export function VerifyDocumentButton({ documentId }: { documentId: string }) {
  return (
    <ActionButton run={() => verifyDocumentAction(documentId)} variant="secondary" successText="Dokument verifiziert.">
      Verifizieren
    </ActionButton>
  );
}

export function RejectDocumentForm({ documentId }: { documentId: string }) {
  return (
    <ActionForm action={rejectDocumentAction} successMessage="Dokument abgelehnt. Der Käufer wird informiert.">
      <input type="hidden" name="documentId" value={documentId} />
      <TextAreaField name="reason" label="Begründung für den Käufer" hint="Mindestens 10 Zeichen." />
      <SubmitButton variant="danger" className="mt-3 h-10">
        Ablehnen
      </SubmitButton>
    </ActionForm>
  );
}

export function InsuranceEvidenceForm({ caseId, documents }: { caseId: string; documents: { id: string; title: string }[] }) {
  if (documents.length === 0) {
    return <Alert tone="info">Es liegt noch kein verifizierter Versicherungsnachweis vor. Ohne Beleg kann die Versicherung nicht bestätigt werden.</Alert>;
  }
  return (
    <ActionForm action={confirmInsuranceEvidenceAction} successMessage="Versicherungsnachweis bestätigt.">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="documentId" label="Verifizierter Nachweis" options={documents.map((d) => ({ value: d.id, label: d.title }))} />
        <TextField name="note" label="Belegreferenz" placeholder="z. B. Versicherungsnummer" />
      </div>
      <SubmitButton className="mt-4 h-10">Versicherung bestätigen</SubmitButton>
    </ActionForm>
  );
}

export function SimulateInsuranceButtons({ caseId }: { caseId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {INSURANCE_SIMULATION_OPTIONS.map((opt) => (
        <ActionButton key={opt.value} run={() => simulateInsuranceAction(caseId, opt.value)} variant="secondary" pendingLabel="Simuliert …" successText={`Simuliert: ${opt.label}`} className="min-h-10 text-xs">
          {opt.label}
        </ActionButton>
      ))}
    </div>
  );
}

export function RequirementConfirmForm({ caseId, ruleKey, title }: { caseId: string; ruleKey: string; title: string }) {
  return (
    <ActionForm action={markRequirementAction} successMessage={`„${title}“ bestätigt.`}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="ruleKey" value={ruleKey} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField name="note" label="Beleg oder Notiz" placeholder="z. B. Kontrollschild-Nr. geprüft" />
        </div>
        <SubmitButton variant="secondary" className="h-11">
          Als erfüllt markieren
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MoveCaseButton({ caseId, to, label, message, variant = 'primary' }: { caseId: string; to: string; label: string; message: string; variant?: 'primary' | 'secondary' }) {
  return (
    <ActionButton run={() => moveCaseAction(caseId, to, message)} variant={variant} successText="Status aktualisiert.">
      {label}
    </ActionButton>
  );
}

export function HandoverCheckButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton run={() => handoverCheckAction(caseId)} successText="Übergabe-Prüfung abgeschlossen.">
      Übergabe-Prüfung durchführen
    </ActionButton>
  );
}

export function StartSubmissionButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton run={() => startSubmissionAction(caseId)} successText="Einreichung veranlasst. Die Aufgabe prüft die Schnittstelle.">
      Einreichung veranlassen
    </ActionButton>
  );
}

export function ManualSubmissionForm({ caseId, submissionId }: { caseId: string; submissionId: string }) {
  return (
    <ActionForm action={recordManualSubmissionAction} successMessage="Manuelle Einreichung erfasst.">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField name="reference" label="Versand- oder Einreichungsreferenz" placeholder="z. B. Sendungsnummer" />
        </div>
        <SubmitButton variant="secondary" className="h-11">
          Einreichung erfassen
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AuthorityResponseForm({ caseId }: { caseId: string }) {
  return (
    <ActionForm action={recordAuthorityResponseAction} successMessage="Behördenantwort erfasst.">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="kind" label="Antwort der Behörde" options={AUTHORITY_KIND_OPTIONS} />
        <TextField name="reference" label="Referenz der Behörde" placeholder="Pflicht, z. B. Geschäftsnummer" />
      </div>
      <TextAreaField name="note" label="Notiz" hint="Optional, z. B. welche Unterlagen nachgefordert werden." />
      <SubmitButton className="mt-4 h-10">Antwort erfassen</SubmitButton>
    </ActionForm>
  );
}

export function SimulateAuthorityButtons({ caseId }: { caseId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['ACKNOWLEDGED', 'REGISTRATION_CONFIRMED'] as const).map((kind) => (
        <ActionButton key={kind} run={() => simulateAuthorityAction(caseId, kind)} variant="secondary" pendingLabel="Simuliert …" successText={`Simuliert: ${kind}`} className="min-h-10 text-xs">
          Simuliert: {kind === 'ACKNOWLEDGED' ? 'Eingangsbestätigung' : 'Zulassungsbestätigung'}
        </ActionButton>
      ))}
    </div>
  );
}

export function TemporaryAuthorizationForm({ caseId, documents }: { caseId: string; documents: { id: string; title: string }[] }) {
  if (documents.length === 0) {
    return <Alert tone="info">Für eine vorläufige Berechtigung braucht es den verifizierten Beleg der Behörde.</Alert>;
  }
  return (
    <ActionForm action={recordTemporaryAuthorizationAction} successMessage="Vorläufige Berechtigung erfasst.">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="documentId" label="Beleg der Behörde" options={documents.map((d) => ({ value: d.id, label: d.title }))} />
        <TextField name="reference" label="Referenz" />
        <TextField name="validUntil" label="Gültig bis" type="date" />
      </div>
      <SubmitButton className="mt-4 h-10">Erfassen</SubmitButton>
    </ActionForm>
  );
}

export function PauseCaseForm({ caseId }: { caseId: string }) {
  return (
    <ActionForm action={pauseCaseAction} successMessage="Fall pausiert.">
      <input type="hidden" name="caseId" value={caseId} />
      <TextAreaField name="reason" label="Grund für die Pause" hint="Mindestens 10 Zeichen." />
      <SubmitButton variant="secondary" className="mt-3 h-10">
        Pausieren
      </SubmitButton>
    </ActionForm>
  );
}

export function ResumeCaseForm({ caseId }: { caseId: string }) {
  return (
    <ActionForm action={resumeCaseAction} successMessage="Fall wieder aufgenommen.">
      <input type="hidden" name="caseId" value={caseId} />
      <TextAreaField name="reason" label="Begründung für die Wiederaufnahme" hint="Mindestens 10 Zeichen. Wird protokolliert." />
      <SubmitButton className="mt-3 h-10">Wiederaufnehmen</SubmitButton>
    </ActionForm>
  );
}

export function ReviewResolveForm({ reviewId }: { reviewId: string }) {
  return (
    <ActionForm action={resolveReviewAction} successMessage="Prüfung erledigt.">
      <input type="hidden" name="reviewId" value={reviewId} />
      <TextAreaField name="resolution" label="Ergebnis der Prüfung" hint="Mindestens 10 Zeichen. Wird protokolliert." />
      <SubmitButton variant="secondary" className="mt-3 h-10">
        Als erledigt markieren
      </SubmitButton>
    </ActionForm>
  );
}

export function RetryTaskForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={retryTaskAction} successMessage="Aufgabe wird erneut ausgeführt.">
      <input type="hidden" name="taskId" value={taskId} />
      <TextAreaField name="reason" label="Begründung für den erneuten Versuch" hint="Mindestens 10 Zeichen." />
      <SubmitButton variant="secondary" className="mt-3 h-10">
        Erneut ausführen
      </SubmitButton>
    </ActionForm>
  );
}

export function RunTasksButton() {
  return (
    <ActionButton run={() => runTasksAction()} variant="secondary" successText="Fällige Aufgaben wurden verarbeitet.">
      Fällige Aufgaben jetzt verarbeiten (Demo)
    </ActionButton>
  );
}

export function SimulateFailureForm({ caseId }: { caseId: string }) {
  return (
    <ActionForm action={simulateFailureFormAction} successMessage="Fehler für den nächsten Versuch hinterlegt.">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SelectField name="count" label="Simulierte Fehlversuche (Demo)" options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}` }))} />
        </div>
        <SubmitButton variant="secondary" className="h-11">
          Fehler simulieren
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TeamMemberForm() {
  return (
    <ActionForm action={addTeamMemberAction} successMessage="Teammitglied hinzugefügt.">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <TextField name="email" label="E-Mail-Adresse des Kontos" type="email" required />
        <SelectField
          name="role"
          label="Rolle"
          options={[
            { value: 'ORG_STAFF', label: 'Mitarbeitende' },
            { value: 'ORG_ADMIN', label: 'Administrator' },
          ]}
        />
      </div>
      <SubmitButton className="mt-4 h-10">Hinzufügen</SubmitButton>
    </ActionForm>
  );
}

export function MarkReadButton() {
  return (
    <ActionButton run={async () => { await markNotificationsReadAction(); return { ok: true as const, data: undefined }; }} variant="ghost" successText="Alles als gelesen markiert.">
      Alle als gelesen markieren
    </ActionButton>
  );
}
