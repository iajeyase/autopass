import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/session', () => ({
  createSession: vi.fn(async () => undefined),
  destroySession: vi.fn(async () => undefined),
}));

import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { createSession } from '@/auth/session';
import { loginWithPassword, registerAccount } from '@/services/auth-service';
import { getCaseView, listDealerCases } from '@/services/query-service';
import { createInvitation } from '@/services/sale-service';
import { getDocumentVersionForDownload, uploadDocument } from '@/services/document-service';
import { recordAuthorityResponse } from '@/services/authority-service';
import { createDealer, createUser, actorFor, invitedSale, confirmedCase, resetDatabase, demoPdf } from './helpers';

describe('Registrierung und Login', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.mocked(createSession).mockClear();
  });

  it('registriert einen Händler mit Organisation und Admin-Rolle', async () => {
    const { userId } = await registerAccount({
      accountType: 'DEALER',
      fullName: 'Hanna Händler',
      email: 'hanna@example.test',
      password: 'sehr-sicheres-passwort',
      organizationName: 'Autohaus Test AG',
      street: 'Testweg 2',
      zip: '8001',
      city: 'Zürich',
      canton: 'ZH',
    });
    const membership = await db.organizationMember.findFirst({ where: { userId }, include: { organization: true } });
    expect(membership?.role).toBe('ORG_ADMIN');
    expect(membership?.organization.name).toBe('Autohaus Test AG');
    expect(createSession).toHaveBeenCalledWith(userId);
  });

  it('speichert das Passwort nur als scrypt-Hash', async () => {
    await createUser('hash@example.test', 'Hash Test');
    const user = await db.user.findUniqueOrThrow({ where: { email: 'hash@example.test' } });
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(user.passwordHash).not.toContain('Test-Passwort-2026');
  });

  it('lehnt falsches Passwort mit neutraler Meldung ab', async () => {
    await createUser('login@example.test', 'Login Test');
    await expect(loginWithPassword({ email: 'login@example.test', password: 'falsch-falsch' }, 'test-ip')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(loginWithPassword({ email: 'unbekannt@example.test', password: 'falsch-falsch' }, 'test-ip')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
    });
  });

  it('begrenzt Anmeldeversuche (Rate Limit)', async () => {
    await createUser('limit@example.test', 'Limit Test');
    const attempt = () => loginWithPassword({ email: 'limit@example.test', password: 'falsch-falsch' }, 'rate-ip');
    for (let i = 0; i < 10; i += 1) {
      await attempt().catch(() => undefined);
    }
    await expect(attempt()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('Mandantentrennung und Objektberechtigung', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('verhindert, dass ein Händler den Fall eines anderen Händlers sieht', async () => {
    const a = await createDealer('Garage A', 'LU', 'a@example.test');
    const b = await createDealer('Garage B', 'ZH', 'b@example.test');
    const buyer = await createUser('buyer-a@example.test', 'Käufer A');
    const caseId = await confirmedCase(a.admin, a.org.id, await actorFor(buyer.id), { buyerEmail: 'buyer-a@example.test' });

    await expect(getCaseView(b.admin, caseId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(listDealerCases(b.admin, a.org.id)).rejects.toBeInstanceOf(DomainError);
    await expect(createInvitation(b.admin, caseId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('erlaubt einem Kunden nur den eigenen Vorgang', async () => {
    const a = await createDealer('Garage C', 'LU', 'c@example.test');
    const owner = await createUser('owner@example.test', 'Owner');
    const stranger = await createUser('stranger@example.test', 'Fremde Person');
    const caseId = await confirmedCase(a.admin, a.org.id, await actorFor(owner.id), { buyerEmail: 'owner@example.test' });

    await expect(getCaseView(await actorFor(owner.id), caseId)).resolves.toMatchObject({ viewerRole: 'CUSTOMER' });
    await expect(getCaseView(await actorFor(stranger.id), caseId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lässt Operatoren alle Fälle sehen, Händler aber nie Behördenaktionen ausführen', async () => {
    const a = await createDealer('Garage D', 'LU', 'd@example.test');
    const buyer = await createUser('buyer-d@example.test', 'Käufer D');
    const operator = await createUser('op@example.test', 'Operator', 'OPERATOR');
    const caseId = await confirmedCase(a.admin, a.org.id, await actorFor(buyer.id), { buyerEmail: 'buyer-d@example.test' });

    await expect(getCaseView(await actorFor(operator.id), caseId)).resolves.toMatchObject({ viewerRole: 'OPERATOR' });
    await expect(
      recordAuthorityResponse(a.admin, {
        caseId,
        kind: 'REGISTRATION_CONFIRMED',
        source: 'OPERATOR',
        reference: 'BEH-123',
        note: null,
        externalEventId: null,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('verweigert den Dokumentdownload an Fremde', async () => {
    const a = await createDealer('Garage E', 'LU', 'e@example.test');
    const owner = await createUser('owner-e@example.test', 'Owner E');
    const stranger = await createUser('stranger-e@example.test', 'Fremd E');
    const caseId = await confirmedCase(a.admin, a.org.id, await actorFor(owner.id), { buyerEmail: 'owner-e@example.test' });
    const { documentId, versionId } = await uploadDocument(await actorFor(owner.id), {
      caseId,
      documentId: null,
      kind: 'IDENTITY',
      title: 'Ausweis',
      filename: 'ausweis.pdf',
      declaredMime: 'application/pdf',
      content: demoPdf(null),
    });
    expect(documentId).toBeTruthy();

    await expect(getDocumentVersionForDownload(await actorFor(owner.id), versionId)).resolves.toMatchObject({ mimeType: 'application/pdf' });
    await expect(getDocumentVersionForDownload(await actorFor(stranger.id), versionId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('verhindert, dass ein Einladungslink von einer anderen E-Mail-Adresse angenommen wird', async () => {
    const a = await createDealer('Garage F', 'LU', 'f@example.test');
    await createUser('intended@example.test', 'Vorgesehen');
    const intruder = await createUser('intruder@example.test', 'Eindringling');
    const { token } = await invitedSale(a.admin, a.org.id, { buyerEmail: 'intended@example.test' });
    const { acceptInvitation } = await import('@/services/sale-service');
    await expect(acceptInvitation(await actorFor(intruder.id), token)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
