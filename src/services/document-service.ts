import { createHash } from 'node:crypto';
import { scanUpload } from '@/adapters/security/malware-scan';
import { extractDemoFields } from '@/adapters/ocr/demo-ocr';
import { getObject, putObject } from '@/adapters/storage/object-storage';
import { canAccessCase, type Actor } from '@/auth/policy';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { env } from '@/lib/env';
import { vinsMatch } from '@/domain/vin';
import { addReview, loadCase, syncRequirements, transitionCase } from './case-engine';
import { audit, notifyOrgMembers, notifyUsers, type Json } from './shared';
import type { DocumentKind } from '@prisma/client';

const UPLOAD_STATES = ['PURCHASE_CONFIRMED', 'PREPARATION', 'AUTHORITY_PROCESSING'] as const;

const DOCUMENT_KINDS: DocumentKind[] = [
  'IDENTITY',
  'VEHICLE_REGISTRATION',
  'INSPECTION_REPORT_13_20A',
  'PURCHASE_CONTRACT',
  'POWER_OF_ATTORNEY',
  'RESIDENCE_PROOF',
  'COMMERCIAL_REGISTER',
  'INSURANCE_EVIDENCE',
  'OTHER',
];

// Prüft Größe und Dateitypen anhand der Dateikennung (Magic Bytes), nicht nur anhand des Browser-MIME-Typs.
type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png';

export function detectMime(content: Buffer): AllowedMime | null {
  if (content.subarray(0, 4).toString('latin1') === '%PDF') {
    return 'application/pdf';
  }
  if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return 'image/jpeg';
  }
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  return null;
}

export interface UploadInput {
  caseId: string | null;
  documentId: string | null;
  kind: DocumentKind;
  title: string;
  filename: string;
  declaredMime: string;
  content: Buffer;
}

function safeFilename(name: string): string {
  return name.replace(/[\\/]/g, '_').replace(/[^\w.\- äöüÄÖÜ]/g, '_').slice(0, 180) || 'dokument';
}

function vinConflictTitle(documentTitle: string): string {
  return `VIN-Abweichung in Dokument "${documentTitle}"`;
}

export async function uploadDocument(actor: Actor, input: UploadInput): Promise<{ documentId: string; versionId: string }> {
  if (!DOCUMENT_KINDS.includes(input.kind)) {
    throw new DomainError('VALIDATION', 'Die Dokumentart ist ungültig.', { kind: 'Bitte wählen Sie eine Dokumentart.' });
  }
  if (input.content.length === 0) {
    throw new DomainError('VALIDATION', 'Die Datei ist leer.', { file: 'Die Datei ist leer.' });
  }
  if (input.content.length > env().MAX_UPLOAD_BYTES) {
    throw new DomainError('VALIDATION', 'Die Datei ist zu gross.', {
      file: `Die Datei darf höchstens ${Math.round(env().MAX_UPLOAD_BYTES / 1024 / 1024)} MB gross sein.`,
    });
  }
  const detected = detectMime(input.content);
  if (!detected) {
    throw new DomainError('VALIDATION', 'Der Dateityp wird nicht unterstützt.', {
      file: 'Erlaubt sind PDF, JPEG und PNG.',
    });
  }
  if (input.declaredMime && input.declaredMime !== detected) {
    throw new DomainError('VALIDATION', 'Der Dateityp stimmt nicht mit dem Inhalt überein.', {
      file: 'Bitte laden Sie die Datei erneut hoch.',
    });
  }

  const row = input.caseId ? await loadCase(db, input.caseId) : null;
  if (row) {
    if (!canAccessCase(actor, row)) {
      throw new DomainError('NOT_FOUND', 'Der Vorgang wurde nicht gefunden.');
    }
    if (!(UPLOAD_STATES as readonly string[]).includes(row.status)) {
      throw new DomainError('CONFLICT', 'In diesem Status können keine Dokumente hochgeladen werden.');
    }
  }

  const storageKey = await putObject(input.content);
  const scan = await scanUpload(input.content);
  const ocr = extractDemoFields(input.content);
  const sha256 = createHash('sha256').update(input.content).digest('hex');

  return db.$transaction(async (tx) => {
    let documentId = input.documentId;
    if (documentId) {
      const existing = await tx.document.findUnique({ where: { id: documentId }, select: { caseId: true, ownerUserId: true, kind: true, title: true } });
      if (!existing || existing.kind !== input.kind || existing.caseId !== (row?.id ?? null)) {
        throw new DomainError('NOT_FOUND', 'Das Dokument wurde nicht gefunden.');
      }
      await tx.document.update({ where: { id: documentId }, data: { status: 'UPLOADED', rejectionReason: null } });
    } else {
      const created = await tx.document.create({
        data: {
          ownerUserId: actor.userId,
          caseId: row?.id ?? null,
          vehicleId: row?.vehicleId ?? null,
          kind: input.kind,
          title: input.title.trim() || input.kind,
          scanStatus: scan.status,
        },
      });
      documentId = created.id;
    }

    const latest = await tx.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const version = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        storageKey,
        originalFilename: safeFilename(input.filename),
        mimeType: detected,
        sizeBytes: input.content.length,
        sha256,
        uploadedById: actor.userId,
      },
    });

    if (ocr.fields.length > 0 || ocr.extractor) {
      await tx.documentExtraction.create({
        data: {
          documentVersionId: version.id,
          extractor: ocr.extractor,
          fields: {
            create: ocr.fields.map((f) => ({
              fieldKey: f.key,
              suggestedValue: f.value,
              confidence: f.confidence,
            })),
          },
        },
      });
    }

    const docTitle = input.title.trim() || input.kind;
    const vinField = ocr.fields.find((f) => f.key === 'vin');
    if (vinField && row) {
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId }, select: { vin: true } });
      if (!vinsMatch(vinField.value, vehicle.vin)) {
        await addReview(tx, {
          caseId: row.id,
          kind: 'DATA_CONFLICT',
          title: vinConflictTitle(docTitle),
          detail: `Im Dokument erkannt: ${vinField.value}. Im Fall erfasst: ${vehicle.vin}. Dokument ablehnen oder korrigierte Angaben prüfen.`,
          openedBy: 'SYSTEM',
        });
      }
    }

    if (row) {
      await tx.workflowEvent.create({
        data: {
          caseId: row.id,
          type: 'DOCUMENT_UPLOADED',
          source: row.customerUserId === actor.userId ? 'CUSTOMER' : 'DEALER',
          actorUserId: actor.userId,
          message: `Dokument hochgeladen: ${docTitle} (Version ${version.versionNumber}).`,
          data: { documentId, kind: input.kind } as Json,
        },
      });
      await syncRequirements(tx, row.id);
    }

    await audit(tx, {
      actorUserId: actor.userId,
      organizationId: row?.organizationId ?? null,
      action: 'document.uploaded',
      entityType: 'Document',
      entityId: documentId,
      metadata: { versionId: version.id, sha256, scanStatus: scan.status, extractor: ocr.extractor },
    });

    return { documentId, versionId: version.id };
  });
}

// Benutzer korrigiert einen erkannten Wert. Jede Änderung landet im Audit-Protokoll.
export async function correctExtractionField(actor: Actor, versionId: string, fieldKey: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new DomainError('VALIDATION', 'Bitte geben Sie einen gültigen Wert ein.', { value: 'Der Wert ist ungültig.' });
  }
  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: true, extraction: { include: { fields: true } } },
  });
  if (!version || !version.extraction) {
    throw new DomainError('NOT_FOUND', 'Die Extraktion wurde nicht gefunden.');
  }
  await assertDocumentAccess(actor, version.document.ownerUserId, version.document.caseId);
  const field = version.extraction.fields.find((f) => f.fieldKey === fieldKey);
  if (!field) {
    throw new DomainError('NOT_FOUND', 'Das Feld wurde nicht gefunden.');
  }

  await db.$transaction(async (tx) => {
    await tx.documentExtractionField.update({
      where: { id: field.id },
      data: {
        confirmedValue: trimmed,
        status: trimmed === field.suggestedValue ? 'CONFIRMED' : 'CORRECTED',
        updatedById: actor.userId,
      },
    });
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'document.field.updated',
      entityType: 'DocumentExtractionField',
      entityId: field.id,
      metadata: { fieldKey, suggested: field.suggestedValue, confirmed: trimmed, documentId: version.documentId },
    });
  });
}

async function assertDocumentAccess(actor: Actor, ownerUserId: string, caseId: string | null): Promise<void> {
  if (ownerUserId === actor.userId) {
    return;
  }
  if (caseId) {
    const row = await db.registrationCase.findUnique({ where: { id: caseId }, select: { organizationId: true, customerUserId: true } });
    if (row && canAccessCase(actor, row)) {
      return;
    }
  }
  throw new DomainError('NOT_FOUND', 'Das Dokument wurde nicht gefunden.');
}

// Operator verifiziert ein Dokument. Blockiert bei VIN-Abweichung, bis das Dokument abgelehnt oder korrigiert ist.
export async function verifyDocument(actor: Actor, documentId: string): Promise<void> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { extraction: { include: { fields: true } } } } },
  });
  if (!document) {
    throw new DomainError('NOT_FOUND', 'Das Dokument wurde nicht gefunden.');
  }
  const latest = document.versions[0];
  if (!latest) {
    throw new DomainError('CONFLICT', 'Das Dokument hat keine hochgeladene Datei.');
  }

  if (document.caseId) {
    const row = await db.registrationCase.findUniqueOrThrow({ where: { id: document.caseId }, select: { vehicleId: true } });
    const vehicle = await db.vehicle.findUniqueOrThrow({ where: { id: row.vehicleId }, select: { vin: true } });
    const vinField = latest.extraction?.fields.find((f) => f.fieldKey === 'vin');
    if (vinField) {
      const value = vinField.confirmedValue ?? vinField.suggestedValue;
      if (!vinsMatch(value, vehicle.vin)) {
        throw new DomainError('CONFLICT', 'VIN-Abweichung: Das Dokument kann nicht verifiziert werden. Bitte lehnen Sie es ab oder prüfen Sie die Angaben.');
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { status: 'VERIFIED', verifiedById: actor.userId, verifiedAt: new Date(), rejectionReason: null },
    });
    if (document.caseId) {
      await syncRequirements(tx, document.caseId);
      await tx.workflowEvent.create({
        data: {
          caseId: document.caseId,
          type: 'DOCUMENT_VERIFIED',
          source: 'OPERATOR',
          actorUserId: actor.userId,
          message: `Dokument verifiziert: ${document.title}`,
        },
      });
    }
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'document.verified',
      entityType: 'Document',
      entityId: documentId,
      metadata: { caseId: document.caseId },
    });
  });
}

// Operator lehnt ein Dokument ab. Schliesst zugehörige VIN-Konflikte und fordert Nachreichung an.
export async function rejectDocument(actor: Actor, documentId: string, reason: string): Promise<void> {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new DomainError('NOT_FOUND', 'Das Dokument wurde nicht gefunden.');
  }
  await db.$transaction(async (tx: Tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { status: 'REJECTED', rejectionReason: reason, verifiedById: null, verifiedAt: null },
    });
    if (document.caseId) {
      const caseRow = await loadCase(tx, document.caseId);
      await tx.reviewItem.updateMany({
        where: { caseId: document.caseId, status: 'OPEN', title: vinConflictTitle(document.title) },
        data: { status: 'RESOLVED', resolution: 'Dokument abgelehnt.', resolvedById: actor.userId, resolvedAt: new Date() },
      });
      await syncRequirements(tx, document.caseId);
      if (caseRow.status === 'REVIEW') {
        await transitionCase(tx, {
          caseId: document.caseId,
          to: 'PREPARATION',
          source: 'OPERATOR',
          actorUserId: actor.userId,
          message: `Dokument "${document.title}" wurde abgelehnt. Bitte reichen Sie es erneut ein.`,
          data: { reason },
        });
      }
      await notifyUsers(tx, document.ownerUserId ? [document.ownerUserId] : [], {
        caseId: document.caseId,
        kind: 'DOCUMENT_REJECTED',
        title: 'Dokument zurückgewiesen',
        body: `${document.title}: ${reason}`,
      });
      await notifyOrgMembers(tx, caseRow.organizationId, {
        caseId: document.caseId,
        kind: 'DOCUMENT_REJECTED',
        title: 'Dokument zurückgewiesen',
        body: `${document.title}: ${reason}`,
      });
    }
    await audit(tx, {
      actorUserId: actor.userId,
      action: 'document.rejected',
      entityType: 'Document',
      entityId: documentId,
      metadata: { reason },
    });
  });
}

export async function getDocumentVersionForDownload(
  actor: Actor,
  versionId: string,
): Promise<{ content: Buffer; mimeType: string; filename: string }> {
  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { select: { ownerUserId: true, caseId: true } } },
  });
  if (!version) {
    throw new DomainError('NOT_FOUND', 'Das Dokument wurde nicht gefunden.');
  }
  await assertDocumentAccess(actor, version.document.ownerUserId, version.document.caseId);
  const content = await getObject(version.storageKey);
  return { content, mimeType: version.mimeType, filename: version.originalFilename };
}

export function documentKindLabel(kind: DocumentKind): string {
  const labels: Record<DocumentKind, string> = {
    IDENTITY: 'Identitätsdokument',
    VEHICLE_REGISTRATION: 'Fahrzeugausweis',
    INSPECTION_REPORT_13_20A: 'Prüfungsbericht 13.20A',
    PURCHASE_CONTRACT: 'Kaufvertrag',
    POWER_OF_ATTORNEY: 'Vollmacht',
    RESIDENCE_PROOF: 'Wohnsitznachweis',
    COMMERCIAL_REGISTER: 'Handelsregisterauszug',
    INSURANCE_EVIDENCE: 'Versicherungsnachweis',
    OTHER: 'Sonstiges Dokument',
  };
  return labels[kind];
}

export { DOCUMENT_KINDS };
