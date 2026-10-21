import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import type { ErrorCode } from '@/lib/errors';
import { resetEnvForTests } from '@/lib/env';
import { loadGateFacts } from '@/services/case-engine';
import { handoverDecision } from '@/domain/gates';
import { getCaseView, STATUS_LABELS } from '@/services/query-service';
import { acceptInvitation } from '@/services/sale-service';
import { createSale, createInvitation } from '@/services/sale-service';
import { rejectDocument, uploadDocument, verifyDocument } from '@/services/document-service';
import { confirmInsuranceWithEvidence, ingestInsuranceEvent, simulateInsuranceEvent } from '@/services/insurance-service';
import { recordAuthorityResponse, recordManualSubmission, startSubmission } from '@/services/authority-service';
import { operatorHandoverCheck, operatorMove, resolveReview, confirmHandover, pauseCase } from '@/services/operations-service';
import { processDueTasks } from '@/services/worker';
import { markRequirementManually } from '@/services/case-engine';
import { confirmedCase, demoPdf, resetDatabase, saleInput } from './helpers';

import { VIN, parties, uploadAndVerifyDocuments, reachAuthorityConfirmed, type Parties } from './scenarios';

async function expectCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Vollständiger Fall: Einladung bis Abschluss', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('führt den Happy Path mit realen Quellen bis zur bestätigten Übergabe', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });

    const afterConfirm = await getCaseView(p.buyer, caseId);
    expect(afterConfirm.status).toBe('PREPARATION');
    expect(afterConfirm.requirements.map((r) => r.key)).toEqual(
      expect.arrayContaining(['ID_PROOF', 'VEHICLE_REGISTRATION', 'INSURANCE_EVN', 'PLATES_REUSE_CHECK', 'ORIGINALS_CHECK']),
    );

    await reachAuthorityConfirmed(p, caseId);
    const confirmed = await getCaseView(p.operator, caseId);
    expect(confirmed.status).toBe('PLATES_AND_ORIGINALS');

    await operatorHandoverCheck(p.operator, caseId);
    const releasable = await getCaseView(p.dealer, caseId);
    expect(releasable.status).toBe('HANDOVER_RELEASABLE');
    expect(releasable.handover.level).toBe('RELEASED');
    expect(releasable.handover.message).toBe('Ihr Fahrzeug kann übergeben werden.');
    expect(releasable.actions.canConfirmHandover).toBe(true);

    await confirmHandover(p.dealer, caseId);
    const closed = await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).not.toBeNull();

    const history = await db.workflowEvent.findMany({ where: { caseId, type: 'STATUS_CHANGED' }, orderBy: { createdAt: 'asc' } });
    expect(history.at(-1)?.toStatus).toBe('CLOSED');
    expect(STATUS_LABELS.CLOSED).toBe('Abgeschlossen');
  });

  it('erzeugt Anforderungen mit Regelstatus und einen Prüfauftrag für nicht verifizierte Regeln', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const reqs = await db.caseRequirement.findMany({ where: { caseId } });
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.every((r) => r.verification === 'UNVERIFIED_RULE')).toBe(true);
    const review = await db.reviewItem.findFirst({ where: { caseId, status: 'OPEN', title: 'Nicht verifizierte Regeln prüfen' } });
    expect(review).not.toBeNull();
    const rulesetId = (await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } })).rulesetId;
    const ruleset = await db.cantonRuleset.findUniqueOrThrow({ where: { id: rulesetId! } });
    expect(ruleset.status).toBe('UNVERIFIED');
  });

  it('sendet dem Käufer eine In-App-Benachrichtigung bei Statuswechsel', async () => {
    const p = await parties();
    await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const notes = await db.notification.findMany({ where: { userId: p.buyer.userId } });
    expect(notes.some((n) => n.kind === 'CASE_STATUS')).toBe(true);
    expect(notes.every((n) => n.emailStatus === 'LOGGED_ONLY')).toBe(true);
  });
});

describe('Freigabe-Gates und Schutz vor unbestätigten Vorgängen', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('verhindert die Einreichung, solange der Versicherungsnachweis nicht bestätigt ist (Szenario 5)', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await uploadAndVerifyDocuments(p, caseId);
    await simulateInsuranceEvent(p.operator.userId, caseId, 'IN_PROGRESS');
    await expectCode(operatorMove(p.operator, caseId, 'READY_FOR_SUBMISSION', 'Versuch ohne Versicherung'), 'CONFLICT');
    const state = await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(state.status).toBe('REVIEW');
  });

  it('kennzeichnet simulierte Behördenbestätigung nie als reale Übergabefreigabe', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const { evidenceId } = await uploadAndVerifyDocuments(p, caseId);
    await confirmInsuranceWithEvidence(p.operator.userId, caseId, evidenceId, 'Police-Nr. 77-1234');
    await db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: 'PLATES_REUSE_CHECK', actorUserId: p.operator.userId, note: 'geprüft' }));
    await db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: 'ORIGINALS_CHECK', actorUserId: p.operator.userId, note: 'geprüft' }));
    for (const review of await db.reviewItem.findMany({ where: { caseId, status: 'OPEN' } })) {
      await resolveReview(p.operator, review.id, 'Im Team geprüft und bestätigt.');
    }
    await operatorMove(p.operator, caseId, 'READY_FOR_SUBMISSION', 'bereit');
    const { submissionId } = await startSubmission(p.operator, caseId);
    await processDueTasks({ retryBaseMs: 0 });
    for (const review of await db.reviewItem.findMany({ where: { caseId, status: 'OPEN' } })) {
      await resolveReview(p.operator, review.id, 'Manuell eingereicht und erfasst.');
    }
    await recordManualSubmission(p.operator, submissionId, 'SEND-SIM-1');
    await recordAuthorityResponse(p.operator, { caseId, kind: 'ACKNOWLEDGED', source: 'SIMULATION', reference: null, note: null, externalEventId: 'sim-ack-1' });
    await recordAuthorityResponse(p.operator, { caseId, kind: 'REGISTRATION_CONFIRMED', source: 'SIMULATION', reference: null, note: null, externalEventId: 'sim-reg-1' });

    const view = await getCaseView(p.operator, caseId);
    expect(view.status).toBe('PLATES_AND_ORIGINALS');
    expect(view.handover.level).toBe('DEMO_SIMULATED');

    await operatorHandoverCheck(p.operator, caseId);
    const demo = await getCaseView(p.dealer, caseId);
    expect(demo.handover.level).toBe('DEMO_SIMULATED');
    expect(demo.handover.message).toMatch(/^Demo: Übergabe simuliert/);
    expect(demo.handover.message).not.toContain('Ihr Fahrzeug kann übergeben werden.');
    expect(demo.timeline.find((s) => s.key === 'authority')?.verification).toBe('SIMULATION');
  });

  it('erkennt eine falsch erkannte VIN, verhindert die Verifikation und löst den Konflikt über Ablehnung', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const { documentId } = await uploadDocument(p.buyer, {
      caseId,
      documentId: null,
      kind: 'VEHICLE_REGISTRATION',
      title: 'Fahrzeugausweis (Scan)',
      filename: 'scan.pdf',
      declaredMime: 'application/pdf',
      content: demoPdf({ vin: { value: 'WVWZZZ1KZAW100010', confidence: 0.58 } }),
    });
    const conflict = await db.reviewItem.findFirst({ where: { caseId, kind: 'DATA_CONFLICT', status: 'OPEN' } });
    expect(conflict).not.toBeNull();
    expect(conflict?.detail).toContain('WVWZZZ1KZAW100010');

    await expectCode(verifyDocument(p.operator, documentId), 'CONFLICT');

    await rejectDocument(p.operator, documentId, 'Fahrgestellnummer weicht ab. Bitte neuen Scan hochladen.');
    const after = await db.reviewItem.findUniqueOrThrow({ where: { id: conflict!.id } });
    expect(after.status).toBe('RESOLVED');
    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.status).toBe('REJECTED');
  });

  it('verlangt für Dokumentanforderungen einen Beleg und lässt keine manuelle Abhaken zu', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await expect(
      db.$transaction((tx) => markRequirementManually(tx, { caseId, ruleKey: 'ID_PROOF', actorUserId: p.operator.userId, note: 'ohne Beleg' })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('nimmt Versicherungsereignisse idempotent an und erkennt doppelte Zustellungen', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const event = {
      caseId,
      providerKey: 'DEMO_INSURER',
      externalEventId: 'partner-evt-001',
      toStatus: 'IN_PROGRESS' as const,
      source: 'PARTNER_WEBHOOK' as const,
      actorUserId: null,
      note: null,
      evidenceDocumentId: null,
    };
    expect(await ingestInsuranceEvent(event)).toBe('PROCESSED');
    expect(await ingestInsuranceEvent(event)).toBe('DUPLICATE');
    const rows = await db.insuranceStatusEvent.count({ where: { externalEventId: 'partner-evt-001' } });
    expect(rows).toBe(1);
  });

  it('lehnt unzulässige Versicherungsübergänge ab', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const { evidenceId } = await uploadAndVerifyDocuments(p, caseId);
    await confirmInsuranceWithEvidence(p.operator.userId, caseId, evidenceId, 'Police-Nr. 77-1234');
    await expectCode(
      ingestInsuranceEvent({
        caseId,
        providerKey: 'DEMO_INSURER',
        externalEventId: 'late-1',
        toStatus: 'IN_PROGRESS',
        source: 'PARTNER_WEBHOOK',
        actorUserId: null,
        note: null,
        evidenceDocumentId: null,
      }),
      'INVALID_TRANSITION',
    );
  });

  it('bestätigt die Versicherung durch das Team nur mit verifiziertem Nachweis', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    const unverified = await uploadDocument(p.buyer, {
      caseId,
      documentId: null,
      kind: 'INSURANCE_EVIDENCE',
      title: 'Police (unverifiziert)',
      filename: 'police.pdf',
      declaredMime: 'application/pdf',
      content: demoPdf(null),
    });
    await expectCode(confirmInsuranceWithEvidence(p.operator.userId, caseId, unverified.documentId, 'Police-Nr. 1'), 'CONFLICT');
  });

  it('lässt keine Simulation im Produktivbetrieb zu', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    process.env.DEMO_MODE = 'false';
    resetEnvForTests();
    try {
      await expectCode(simulateInsuranceEvent(p.operator.userId, caseId, 'CONFIRMED'), 'FORBIDDEN');
      await expectCode(
        recordAuthorityResponse(p.operator, { caseId, kind: 'ACKNOWLEDGED', source: 'SIMULATION', reference: null, note: null, externalEventId: 'x' }),
        'FORBIDDEN',
      );
    } finally {
      process.env.DEMO_MODE = 'true';
      resetEnvForTests();
    }
  });

  it('verlangt eine Eingangsbestätigung vor der Zulassungsbestätigung', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await expectCode(
      recordAuthorityResponse(p.operator, { caseId, kind: 'REGISTRATION_CONFIRMED', source: 'OPERATOR', reference: 'ZUL-1', note: null, externalEventId: null }),
      'CONFLICT',
    );
  });

  it('pausiert und setzt den Fall nur mit Begründung in den Vorzustand zurück', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await expectCode(pauseCase(p.buyer, caseId, 'Ich möchte pausieren, bitte.'), 'FORBIDDEN');
    await pauseCase(p.operator, caseId, 'Rückfrage zur Kontrollschildsituation offen.');
    expect((await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe('ON_HOLD');
    const { resumeCase } = await import('@/services/case-engine');
    await db.$transaction((tx) => resumeCase(tx, { caseId, actorUserId: p.operator.userId, reason: 'Rückfrage geklärt.' }));
    expect((await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe('PREPARATION');
  });

  it('nimmt keine Einladung an, die abgelaufen oder bereits verwendet ist', async () => {
    const p = await parties();
    const { caseId, url } = await createSaleAndInvite(p);
    const token = url.split('/einladung/')[1];
    await db.vehicleSale.updateMany({ where: { id: (await db.registrationCase.findUniqueOrThrow({ where: { id: caseId } })).saleId }, data: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    await expectCode(acceptInvitation(p.buyer, token), 'NOT_FOUND');
  });

  it('verhindert einen zweiten aktiven Vorgang für dasselbe Fahrzeug', async () => {
    const p = await parties();
    await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await expectCode(createSale(p.dealer, p.orgId, saleInput({ vin: VIN, buyerEmail: p.buyer.email })), 'CONFLICT');
  });

  it('bestätigt Übergabe ausschliesslich einem Mitglied des verkaufenden Händlers', async () => {
    const p = await parties();
    const caseId = await confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
    await expectCode(confirmHandover(p.buyer, caseId), 'NOT_FOUND');
    const decision = handoverDecision(await db.$transaction((tx) => loadGateFacts(tx, caseId)));
    expect(decision.level).toBe('BLOCKED');
  });
});

async function createSaleAndInvite(p: Parties) {
  const { caseId } = await createSale(p.dealer, p.orgId, saleInput({ buyerEmail: p.buyer.email, vin: 'WBA8E9C56GK000099' }));
  const { url } = await createInvitation(p.dealer, caseId);
  return { caseId, url };
}

