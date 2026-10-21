import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import type { ErrorCode } from '@/lib/errors';
import { uploadDocument } from '@/services/document-service';
import { retryDeadLetterTask, processDueTasks } from '@/services/worker';
import { recordManualSubmission } from '@/services/authority-service';
import { resolveReview } from '@/services/operations-service';
import { confirmedCase, demoPdf, resetDatabase } from './helpers';
import { parties, readyForSubmission, VIN, type Parties } from './scenarios';

async function expectCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ code });
}

async function caseWithPlanning(p: Parties): Promise<string> {
  return confirmedCase(p.dealer, p.orgId, p.buyer, { buyerEmail: p.buyer.email, vin: VIN });
}

describe('Dokumenten-Upload: Validierung', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lehnt Dateien ab, deren Inhalt nicht zum Typ passt', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    await expectCode(
      uploadDocument(p.buyer, {
        caseId,
        documentId: null,
        kind: 'IDENTITY',
        title: 'Fälschung',
        filename: 'ausweis.pdf',
        declaredMime: 'application/pdf',
        content: Buffer.from('dies ist kein PDF'),
      }),
      'VALIDATION',
    );
  });

  it('lehnt leere und zu grosse Dateien ab', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    await expectCode(
      uploadDocument(p.buyer, { caseId, documentId: null, kind: 'IDENTITY', title: 'leer', filename: 'x.pdf', declaredMime: 'application/pdf', content: Buffer.alloc(0) }),
      'VALIDATION',
    );
    const tooLarge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)]);
    await expectCode(
      uploadDocument(p.buyer, { caseId, documentId: null, kind: 'IDENTITY', title: 'gross', filename: 'x.pdf', declaredMime: 'application/pdf', content: tooLarge }),
      'VALIDATION',
    );
  });

  it('lehnt einen deklarierten MIME-Typ ab, der nicht zum Inhalt passt', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    await expectCode(
      uploadDocument(p.buyer, { caseId, documentId: null, kind: 'IDENTITY', title: 'Bild', filename: 'x.png', declaredMime: 'image/png', content: demoPdf(null) }),
      'VALIDATION',
    );
  });

  it('speichert Versionen fortlaufend und hält Extraktion als Vorschlag fest', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    const first = await uploadDocument(p.buyer, {
      caseId,
      documentId: null,
      kind: 'VEHICLE_REGISTRATION',
      title: 'Fahrzeugausweis',
      filename: 'a.pdf',
      declaredMime: 'application/pdf',
      content: demoPdf({ vin: { value: VIN, confidence: 0.9 } }),
    });
    await uploadDocument(p.buyer, {
      caseId,
      documentId: first.documentId,
      kind: 'VEHICLE_REGISTRATION',
      title: 'Fahrzeugausweis',
      filename: 'b.pdf',
      declaredMime: 'application/pdf',
      content: demoPdf({ vin: { value: VIN, confidence: 0.95 } }),
    });
    const versions = await db.documentVersion.findMany({ where: { documentId: first.documentId }, orderBy: { versionNumber: 'asc' }, include: { extraction: { include: { fields: true } } } });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(versions[1].extraction?.fields[0]).toMatchObject({ fieldKey: 'vin', status: 'SUGGESTED' });
  });
});

describe('Worker: Wiederholung, Dead Letter, erneute Ausführung', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('verschiebt eine wiederholt fehlschlagende Versicherungsanfrage in die Fehlerwarteschlange', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    const task = await db.workflowTask.findFirstOrThrow({ where: { caseId, type: 'REQUEST_INSURANCE' } });
    await db.workflowTask.update({ where: { id: task.id }, data: { payload: { simulateTransientFailures: 3 } } });

    for (let run = 0; run < 3; run += 1) {
      await processDueTasks({ retryBaseMs: 0, now: new Date(Date.now() + run * 1000) });
    }

    const after = await db.workflowTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.status).toBe('DEAD_LETTER');
    expect(after.attempts).toBe(3);
    expect(after.lastError).toContain('simulierter Fehler');
    const review = await db.reviewItem.findFirst({ where: { caseId, kind: 'DEAD_LETTER', status: 'OPEN' } });
    expect(review?.detail).toContain(task.id);
  });

  it('führt eine fehlgeschlagene Aufgabe nach Begründung erneut aus und schliesst die Prüfung', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    const task = await db.workflowTask.findFirstOrThrow({ where: { caseId, type: 'REQUEST_INSURANCE' } });
    await db.workflowTask.update({ where: { id: task.id }, data: { payload: { simulateTransientFailures: 3 } } });
    for (let run = 0; run < 3; run += 1) {
      await processDueTasks({ retryBaseMs: 0, now: new Date(Date.now() + run * 1000) });
    }

    await db.workflowTask.update({ where: { id: task.id }, data: { payload: { simulateTransientFailures: 0 } } });
    await expectCode(retryDeadLetterTask(p.buyer, task.id, 'Versuch durch Käufer'), 'FORBIDDEN');
    await retryDeadLetterTask(p.operator, task.id, 'Störung der Schnittstelle behoben.');
    await processDueTasks({ retryBaseMs: 0 });

    const done = await db.workflowTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(done.status).toBe('DONE');
    const insurance = await db.insuranceRequest.findUniqueOrThrow({ where: { caseId } });
    expect(insurance.externalReference).toMatch(/^DEMO-INS-/);
    expect(await db.reviewItem.count({ where: { caseId, kind: 'DEAD_LETTER', status: 'OPEN' } })).toBe(0);
  });

  it('führt eine Aufgabe bei parallelen Workern nur einmal aus', async () => {
    const p = await parties();
    await caseWithPlanning(p);
    await Promise.all([processDueTasks({ retryBaseMs: 0 }), processDueTasks({ retryBaseMs: 0 })]);
    const tasks = await db.workflowTask.findMany({ where: { type: 'REQUEST_INSURANCE' } });
    expect(tasks.every((t) => t.status === 'DONE')).toBe(true);
    expect(tasks.every((t) => t.attempts === 1)).toBe(true);
  });
});

describe('Behördenschnittstelle nicht verfügbar (Szenario 6)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('stellt auf manuelle Einreichung um und verliert keine Daten', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    await readyForSubmission(p, caseId);
    const { startSubmission } = await import('@/services/authority-service');
    const { submissionId } = await startSubmission(p.operator, caseId);
    await processDueTasks({ retryBaseMs: 0 });

    const submission = await db.authoritySubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.status).toBe('QUEUED_MANUAL');
    const snapshot = submission.payload as { vin: string; holderName: string; requirements: unknown[] };
    expect(snapshot.vin).toBe(VIN);
    expect(snapshot.holderName).toBe('Anna Beispiel');
    expect(snapshot.requirements.length).toBeGreaterThan(0);
    const exception = await db.reviewItem.findFirst({ where: { caseId, kind: 'EXCEPTION', status: 'OPEN' } });
    expect(exception?.title).toBe('Manuelle Einreichung erforderlich');

    await resolveReview(p.operator, exception!.id, 'Manuell eingereicht.');
    await recordManualSubmission(p.operator, submissionId, 'SEND-2026-0009');
    const recorded = await db.authoritySubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(recorded.status).toBe('SUBMITTED');
    expect(recorded.channelReference).toBe('SEND-2026-0009');
  });

  it('wiederholt eine vorübergehend nicht erreichbare Behörde und stellt danach auf manuell um', async () => {
    const p = await parties();
    const caseId = await caseWithPlanning(p);
    await readyForSubmission(p, caseId);
    const { startSubmission } = await import('@/services/authority-service');
    const { submissionId } = await startSubmission(p.operator, caseId);
    const task = await db.workflowTask.findFirstOrThrow({ where: { caseId, type: 'PREPARE_AUTHORITY_SUBMISSION' } });
    await db.workflowTask.update({ where: { id: task.id }, data: { payload: { submissionId, simulateTransientFailures: 9 } } });
    for (let run = 0; run < 3; run += 1) {
      await processDueTasks({ retryBaseMs: 0, now: new Date(Date.now() + run * 1000) });
    }
    expect((await db.workflowTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('DEAD_LETTER');
    expect((await db.authoritySubmission.findUniqueOrThrow({ where: { id: submissionId } })).status).toBe('QUEUED_MANUAL');
  });
});

