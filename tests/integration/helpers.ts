import { execSync } from 'node:child_process';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/security';
import { seedRulesets } from '@/domain/rules/seed-rulesets';
import { loadActor, type Actor } from '@/auth/policy';
import { createSale, createInvitation, acceptInvitation, confirmPurchase, submitDocumentsForReview } from '@/services/sale-service';
import type { SaleInput } from '@/domain/schemas';

// Leert alle Fachtabellen und lädt die Regelwerke neu. Jede Testdatei startet so auf sauberem Stand.
export async function resetDatabase(): Promise<void> {
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  for (const ruleset of seedRulesets()) {
    await db.cantonRuleset.create({
      data: {
        canton: ruleset.canton,
        version: ruleset.version,
        status: ruleset.status,
        sourceUrls: ruleset.sourceUrls,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        rules: JSON.parse(JSON.stringify(ruleset.rules)),
      },
    });
  }
}

export async function applyMigrations(): Promise<void> {
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
}

export async function createUser(email: string, fullName: string, platformRole: 'NONE' | 'OPERATOR' | 'ADMIN' = 'NONE') {
  return db.user.create({
    data: { email, fullName, platformRole, passwordHash: await hashPassword('Test-Passwort-2026') },
  });
}

export async function createDealer(name: string, canton: string, adminEmail: string): Promise<{ org: { id: string }; admin: Actor }> {
  const org = await db.organization.create({
    data: { type: 'DEALER', name, street: 'Teststrasse 1', zip: '6000', city: 'Luzern', canton },
  });
  const user = await createUser(adminEmail, `Admin ${name}`);
  await db.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: 'ORG_ADMIN' } });
  return { org, admin: (await loadActor(user.id))! };
}

export async function actorFor(userId: string): Promise<Actor> {
  const actor = await loadActor(userId);
  if (!actor) {
    throw new Error('Testbenutzer fehlt.');
  }
  return actor;
}

export function saleInput(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    vin: 'WVWZZZ1KZAW100001',
    make: 'Volkswagen',
    model: 'Golf',
    variant: '',
    vehicleKind: 'USED',
    isImport: false,
    firstRegistrationDate: '2019-03-14',
    mileageKm: 48200,
    previousRegistration: 'SWISS_CANTON',
    previousCanton: 'LU',
    plateSituation: 'EXISTING_PLATES_AVAILABLE',
    buyerName: 'Anna Beispiel',
    buyerEmail: 'anna@example.test',
    isCompanyBuyer: false,
    canton: 'LU',
    saleDate: '2026-10-02',
    plannedHandoverDate: undefined,
    priceChf: 18900,
    ...overrides,
  } as SaleInput;
}

// Verkauf erfassen und Einladung erzeugen. Gibt den Klartext-Token zurück (nur für Tests).
export async function invitedSale(dealer: Actor, orgId: string, input: Partial<SaleInput> = {}) {
  const { caseId } = await createSale(dealer, orgId, saleInput(input));
  const { url } = await createInvitation(dealer, caseId);
  return { caseId, token: url.split('/einladung/')[1] };
}

export async function confirmedCase(dealer: Actor, orgId: string, buyer: Actor, input: Partial<SaleInput> = {}) {
  const { caseId, token } = await invitedSale(dealer, orgId, { buyerEmail: buyer.email, ...input });
  await acceptInvitation(buyer, token);
  await confirmPurchase(buyer, caseId, { acceptProcessConfirmation: true, acceptDataProcessing: true });
  return caseId;
}

export async function submitAll(buyer: Actor, caseId: string) {
  await submitDocumentsForReview(buyer, caseId);
}

// Erzeugt ein Demo-PDF mit optionaler Extraktions-Markierung. Gleiche Form wie im Seed.
export function demoPdf(fields: Record<string, { value: string; confidence: number }> | null): Buffer {
  const marker = fields ? `\nAUTOPASS-DEMO-FIELDS: ${JSON.stringify(fields)}` : '';
  return Buffer.from(`%PDF-1.4\n% Testdokument\n${marker}\n%%EOF\n`, 'latin1');
}
