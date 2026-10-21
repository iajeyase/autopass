// Gemeinsame Fallaufbauten für Integrationstests. Bildet den realen Ablauf über die Services nach.
import { db } from '@/lib/db';
import type { Actor } from '@/auth/policy';
import { submitDocumentsForReview } from '@/services/sale-service';
import { uploadDocument, verifyDocument } from '@/services/document-service';
import { confirmInsuranceWithEvidence } from '@/services/insurance-service';
import { recordAuthorityResponse, recordManualSubmission, startSubmission } from '@/services/authority-service';
import { markRequirementManually } from '@/services/case-engine';
import { operatorMove, resolveReview } from '@/services/operations-service';
import { processDueTasks } from '@/services/worker';
import { actorFor, createDealer, createUser, demoPdf } from './helpers';

export const VIN = 'WVWZZZ1KZAW100001';

export interface Parties {
  dealer: Actor;
  orgId: string;
  buyer: Actor;
  operator: Actor;
}

export async function parties(): Promise<Parties> {
  const { org, admin } = await createDealer('Garage Testfall AG', 'LU', 'dealer@example.test');
  const buyerUser = await createUser('anna@example.test', 'Anna Beispiel');
  const operatorUser = await createUser('ops@example.test', 'Olivia Operator', 'OPERATOR');
  await db.customerProfile.create({ data: { userId: buyerUser.id, street: 'Seeweg 4', zip: '6003', city: 'Luzern', canton: 'LU' } });
  return { dealer: admin, orgId: org.id, buyer: await actorFor(buyerUser.id), operator: await actorFor(operatorUser.id) };
}

// Lädt alle Pflichtdokumente hoch, reicht sie ein und verifiziert sie. Gibt die Versicherungsnachweis-ID zurück.
export async function uploadAndVerifyDocuments(p: Parties, caseId: string) {
  const id = await uploadDocument(p.buyer, {
    caseId,
    documentId: null,
    kind: 'IDENTITY',
    title: 'Identitätskarte',
    filename: 'id.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf({ holderName: { value: 'Anna Beispiel', confidence: 0.92 } }),
  });
  const registration = await uploadDocument(p.buyer, {
    caseId,
    documentId: null,
    kind: 'VEHICLE_REGISTRATION',
    title: 'Fahrzeugausweis',
    filename: 'fahrzeugausweis.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf({ vin: { value: VIN, confidence: 0.97 } }),
  });
  const inspection = await uploadDocument(p.buyer, {
    caseId,
    documentId: null,
    kind: 'INSPECTION_REPORT_13_20A',
    title: 'Prüfungsbericht 13.20A',
    filename: 'pruefung.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf(null),
  });
  const evidence = await uploadDocument(p.buyer, {
    caseId,
    documentId: null,
    kind: 'INSURANCE_EVIDENCE',
    title: 'Bestehende Haftpflicht-Police',
    filename: 'police.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf(null),
  });
  await submitDocumentsForReview(p.buyer, caseId);
  for (const doc of [id, registration, inspection, evidence]) {
    await verifyDocument(p.operator, doc.documentId);
  }
  return { evidenceId: evidence.documentId };
}

// Bringt einen Fall mit realen Quellen bis READY_FOR_SUBMISSION.
export async function readyForSubmission(p: Parties, caseId: string): Promise<void> {
  const { evidenceId } = await uploadAndVerifyDocuments(p, caseId);
  await confirmInsuranceWithEvidence(p.operator.userId, caseId, evidenceId, 'Police-Nr. 77-1234');
  await db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: 'PLATES_REUSE_CHECK', actorUserId: p.operator.userId, note: 'Kontrollschild geprüft' }));
  await db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: 'ORIGINALS_CHECK', actorUserId: p.operator.userId, note: 'Originale geprüft' }));
  for (const review of await db.reviewItem.findMany({ where: { caseId, status: 'OPEN' } })) {
    await resolveReview(p.operator, review.id, 'Im Team geprüft und bestätigt.');
  }
  await operatorMove(p.operator, caseId, 'READY_FOR_SUBMISSION', 'Alle Prüfungen abgeschlossen.');
}

// Wie readyForSubmission, startet anschliessend die Einreichung und führt die Worker-Aufgaben aus.
export async function submissionStarted(p: Parties, caseId: string): Promise<string> {
  await readyForSubmission(p, caseId);
  const { submissionId } = await startSubmission(p.operator, caseId);
  await processDueTasks({ retryBaseMs: 0 });
  return submissionId;
}

// Bringt den Fall bis zur Zulassungsbestätigung mit realen Quellen.
export async function reachAuthorityConfirmed(p: Parties, caseId: string): Promise<void> {
  const submissionId = await submissionStarted(p, caseId);
  for (const review of await db.reviewItem.findMany({ where: { caseId, status: 'OPEN' } })) {
    await resolveReview(p.operator, review.id, 'Manuell eingereicht und erfasst.');
  }
  await recordManualSubmission(p.operator, submissionId, 'SEND-2026-0001');
  await recordAuthorityResponse(p.operator, { caseId, kind: 'ACKNOWLEDGED', source: 'OPERATOR', reference: 'EING-2026-7', note: null, externalEventId: null });
  await recordAuthorityResponse(p.operator, { caseId, kind: 'REGISTRATION_CONFIRMED', source: 'OPERATOR', reference: 'ZUL-2026-42', note: null, externalEventId: null });
}
