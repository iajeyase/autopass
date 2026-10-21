// Demo-Daten für lokale Entwicklung und Tests. Alle Personen, Organisationen und Adressen sind fiktiv.
// Die Domains "*.example" sind reserviert. Das Passwort ist ausschliesslich für Demo-Umgebungen bestimmt.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/security';
import { seedRulesets } from '../src/domain/rules/seed-rulesets';
import { loadActor, type Actor } from '../src/auth/policy';
import { createSale, createInvitation, acceptInvitation, confirmPurchase, submitDocumentsForReview } from '../src/services/sale-service';
import { uploadDocument, verifyDocument } from '../src/services/document-service';
import { simulateInsuranceEvent } from '../src/services/insurance-service';

const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-Passwort-2026';
const DEMO_DIR = path.resolve(process.cwd(), 'demo', 'documents');

const VIN_ANNA = 'WVWZZZ1KZAW100001';
const VIN_ANNA_SECOND = 'WBA8E9C56GK000002';
const VIN_BRUNO = 'WDD2050061A100003';
const VIN_FLOTTE_A = 'WVWZZZ7NZBW100004';
const VIN_FLOTTE_B = 'WV1ZZZ70ZBH100005';

function demoPdf(title: string, fields: Record<string, { value: string; confidence: number }> | null): Buffer {
  const marker = fields ? `\nAUTOPASS-DEMO-FIELDS: ${JSON.stringify(fields)}` : '';
  const body = `%PDF-1.4\n% ${title} – Demo-Dokument, keine echte Urkunde\n% Fiktive Angaben${marker}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

async function ensureUser(email: string, fullName: string, platformRole: 'NONE' | 'OPERATOR' | 'ADMIN' = 'NONE') {
  const passwordHash = await hashPassword(PASSWORD);
  return db.user.upsert({
    where: { email },
    create: { email, fullName, passwordHash, platformRole },
    update: { fullName, platformRole },
  });
}

async function ensureDealer(name: string, canton: string, street: string, city: string, zip: string) {
  const existing = await db.organization.findFirst({ where: { name, type: 'DEALER' } });
  if (existing) {
    return existing;
  }
  return db.organization.create({ data: { type: 'DEALER', name, street, zip, city, canton } });
}

async function membership(organizationId: string, userId: string, role: 'ORG_ADMIN' | 'ORG_STAFF') {
  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, role },
    update: { role },
  });
}

async function actorFor(userId: string): Promise<Actor> {
  const actor = await loadActor(userId);
  if (!actor) {
    throw new Error(`Benutzer ${userId} nicht gefunden.`);
  }
  return actor;
}

// Verkauf erstellen, Einladung erzeugen und optional direkt annehmen.
async function createInvitedSale(dealer: Actor, organizationId: string, input: Parameters<typeof createSale>[2]) {
  const { caseId } = await createSale(dealer, organizationId, input);
  const { url } = await createInvitation(dealer, caseId);
  const token = url.split('/einladung/')[1];
  return { caseId, token, url };
}

async function main() {
  const existing = await db.user.findUnique({ where: { email: 'operator@demo.autopass.example' }, select: { id: true } });
  if (existing) {
    console.info('Demo-Daten sind bereits vorhanden. Für einen Neustart die Datenbank zurücksetzen: npx prisma migrate reset --force');
    return;
  }
  console.info('AutoPass-Demo-Daten werden angelegt …');

  // Regelwerke (versioniert, nicht verifiziert)
  for (const ruleset of seedRulesets()) {
    await db.cantonRuleset.upsert({
      where: { canton_version: { canton: ruleset.canton, version: ruleset.version } },
      create: {
        canton: ruleset.canton,
        version: ruleset.version,
        status: ruleset.status,
        sourceUrls: ruleset.sourceUrls,
        sourceCheckedAt: ruleset.sourceCheckedAt ? new Date(ruleset.sourceCheckedAt) : null,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        rules: JSON.parse(JSON.stringify(ruleset.rules)),
      },
      update: {},
    });
  }

  await db.insuranceProvider.upsert({
    where: { adapterKey: 'DEMO_INSURER' },
    create: { name: 'Demo-Versicherung (Simulation)', adapterKey: 'DEMO_INSURER', isDemo: true },
    update: {},
  });

  // Personal
  const operator = await ensureUser('operator@demo.autopass.example', 'Olivia Operator (Demo)', 'OPERATOR');
  await ensureUser('admin@demo.autopass.example', 'Adrian Admin (Demo)', 'ADMIN');
  const dealerLuAdmin = await ensureUser('haendler.lu@demo.autopass.example', 'Marco Muster (Demo)');
  const dealerLuStaff = await ensureUser('mitarbeiterin.lu@demo.autopass.example', 'Sara Staff (Demo)');
  const dealerZhAdmin = await ensureUser('haendler.zh@demo.autopass.example', 'Ruth Richter (Demo)');
  const anna = await ensureUser('anna.lu@demo.autopass.example', 'Anna Beispiel (Demo)');
  await ensureUser('bruno.zh@demo.autopass.example', 'Bruno Probe (Demo)');
  const carla = await ensureUser('carla.flotte@demo.autopass.example', 'Carla Flotte (Demo)');

  const garageLu = await ensureDealer('Garage Muster AG (Demo)', 'LU', 'Musterweg 1', 'Luzern', '6000');
  const autohausZh = await ensureDealer('Autohaus Beispiel ZH (Demo)', 'ZH', 'Beispielstrasse 9', 'Zürich', '8000');
  await membership(garageLu.id, dealerLuAdmin.id, 'ORG_ADMIN');
  await membership(garageLu.id, dealerLuStaff.id, 'ORG_STAFF');
  await membership(autohausZh.id, dealerZhAdmin.id, 'ORG_ADMIN');

  const dealerLu = await actorFor(dealerLuAdmin.id);
  const dealerZh = await actorFor(dealerZhAdmin.id);
  const operatorActor = await actorFor(operator.id);
  void operatorActor;

  // Szenario 1: Occasion im Kanton Luzern, Fahrzeugwechsel mit bestehenden Kontrollschildern.
  const s1 = await createInvitedSale(dealerLu, garageLu.id, {
    vin: VIN_ANNA,
    make: 'Volkswagen',
    model: 'Golf',
    variant: 'Comfortline 1.5 TSI',
    vehicleKind: 'USED',
    isImport: false,
    firstRegistrationDate: '2019-03-14',
    mileageKm: 48200,
    previousRegistration: 'SWISS_CANTON',
    previousCanton: 'LU',
    plateSituation: 'EXISTING_PLATES_AVAILABLE',
    buyerName: 'Anna Beispiel',
    buyerEmail: 'anna.lu@demo.autopass.example',
    isCompanyBuyer: false,
    canton: 'LU',
    saleDate: '2026-10-02',
    plannedHandoverDate: '2026-11-05',
    priceChf: 18900,
  });
  const annaActor = await actorFor(anna.id);
  await acceptInvitation(annaActor, s1.token);
  await confirmPurchase(annaActor, s1.caseId, { acceptProcessConfirmation: true, acceptDataProcessing: true });
  await db.customerProfile.upsert({
    where: { userId: anna.id },
    create: { userId: anna.id, street: 'Seeweg 4', zip: '6003', city: 'Luzern', canton: 'LU', phone: '+41 41 000 00 01' },
    update: {},
  });

  const annaId = (await actorFor(anna.id));
  const idDoc = await uploadDocument(annaId, {
    caseId: s1.caseId,
    documentId: null,
    kind: 'IDENTITY',
    title: 'Identitätskarte Anna Beispiel',
    filename: 'identitaet-anna.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf('Identität', { holderName: { value: 'Anna Beispiel', confidence: 0.91 } }),
  });
  const registrationDoc = await uploadDocument(annaId, {
    caseId: s1.caseId,
    documentId: null,
    kind: 'VEHICLE_REGISTRATION',
    title: 'Fahrzeugausweis Golf',
    filename: 'fahrzeugausweis-golf.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf('Fahrzeugausweis', {
      vin: { value: VIN_ANNA, confidence: 0.97 },
      make: { value: 'Volkswagen', confidence: 0.99 },
      model: { value: 'Golf', confidence: 0.98 },
      firstRegistrationDate: { value: '14.03.2019', confidence: 0.9 },
    }),
  });
  const inspectionDoc = await uploadDocument(annaId, {
    caseId: s1.caseId,
    documentId: null,
    kind: 'INSPECTION_REPORT_13_20A',
    title: 'Prüfungsbericht 13.20A',
    filename: 'pruefbericht-13-20a.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf('Prüfungsbericht 13.20A', null),
  });
  await submitDocumentsForReview(annaId, s1.caseId);

  const operatorUser = await actorFor(operator.id);
  await verifyDocument(operatorUser, idDoc.documentId);
  await verifyDocument(operatorUser, registrationDoc.documentId);
  await verifyDocument(operatorUser, inspectionDoc.documentId);
  await simulateInsuranceEvent(operator.id, s1.caseId, 'IN_PROGRESS');

  // Szenario 4: falsch erkannte VIN auf dem Fahrzeugausweis eines zweiten Fahrzeugs von Anna.
  const s4 = await createInvitedSale(dealerLu, garageLu.id, {
    vin: VIN_ANNA_SECOND,
    make: 'BMW',
    model: '320d',
    vehicleKind: 'USED',
    isImport: false,
    firstRegistrationDate: '2018-06-01',
    previousRegistration: 'SWISS_CANTON',
    previousCanton: 'LU',
    plateSituation: 'NEW_PLATES_REQUIRED',
    buyerName: 'Anna Beispiel',
    buyerEmail: 'anna.lu@demo.autopass.example',
    isCompanyBuyer: false,
    canton: 'LU',
    saleDate: '2026-10-10',
    priceChf: 14500,
  });
  await acceptInvitation(annaActor, s4.token);
  await confirmPurchase(annaActor, s4.caseId, { acceptProcessConfirmation: true, acceptDataProcessing: true });
  await uploadDocument(annaId, {
    caseId: s4.caseId,
    documentId: null,
    kind: 'VEHICLE_REGISTRATION',
    title: 'Fahrzeugausweis BMW (Scan)',
    filename: 'fahrzeugausweis-bmw.pdf',
    declaredMime: 'application/pdf',
    content: demoPdf('Fahrzeugausweis BMW', {
      vin: { value: 'WBA8E9C56GK000020', confidence: 0.62 },
      make: { value: 'BMW', confidence: 0.95 },
    }),
  });

  // Szenario 2: Neuwagen im Kanton Zürich mit neuen Kontrollschildern. Einladung offen.
  const s2 = await createInvitedSale(dealerZh, autohausZh.id, {
    vin: VIN_BRUNO,
    make: 'Mercedes-Benz',
    model: 'A 200',
    variant: 'Progressive',
    vehicleKind: 'NEW',
    isImport: false,
    previousRegistration: 'NEVER_REGISTERED',
    plateSituation: 'NEW_PLATES_REQUIRED',
    buyerName: 'Bruno Probe',
    buyerEmail: 'bruno.zh@demo.autopass.example',
    isCompanyBuyer: false,
    canton: 'ZH',
    saleDate: '2026-10-15',
    plannedHandoverDate: '2026-11-20',
    priceChf: 42900,
  });

  // Szenario 3: Firmenkauf mehrerer Fahrzeuge. Carla prüft und bestätigt, Freigabe durch das Team.
  const s3a = await createInvitedSale(dealerZh, autohausZh.id, {
    vin: VIN_FLOTTE_A,
    make: 'Volkswagen',
    model: 'Passat Variant',
    vehicleKind: 'USED',
    isImport: false,
    firstRegistrationDate: '2021-09-01',
    previousRegistration: 'SWISS_CANTON',
    previousCanton: 'ZH',
    plateSituation: 'NEW_PLATES_REQUIRED',
    buyerName: 'Muster Logistik AG (Demo)',
    buyerEmail: 'carla.flotte@demo.autopass.example',
    isCompanyBuyer: true,
    canton: 'ZH',
    saleDate: '2026-10-12',
    priceChf: 24800,
  });
  await createInvitedSale(dealerZh, autohausZh.id, {
    vin: VIN_FLOTTE_B,
    make: 'Volkswagen',
    model: 'Transporter',
    vehicleKind: 'USED',
    isImport: false,
    firstRegistrationDate: '2020-02-01',
    previousRegistration: 'SWISS_CANTON',
    previousCanton: 'ZH',
    plateSituation: 'EXISTING_PLATES_AVAILABLE',
    buyerName: 'Muster Logistik AG (Demo)',
    buyerEmail: 'carla.flotte@demo.autopass.example',
    isCompanyBuyer: true,
    canton: 'ZH',
    saleDate: '2026-10-12',
    priceChf: 31200,
  });
  void carla;

  await mkdir(DEMO_DIR, { recursive: true });
  const files: Record<string, Buffer> = {
    'identitaet-anna.pdf': demoPdf('Identität', { holderName: { value: 'Anna Beispiel', confidence: 0.91 } }),
    'fahrzeugausweis-golf.pdf': demoPdf('Fahrzeugausweis', { vin: { value: VIN_ANNA, confidence: 0.97 } }),
    'fahrzeugausweis-bmw-falsche-vin.pdf': demoPdf('Fahrzeugausweis BMW', { vin: { value: 'WBA8E9C56GK000020', confidence: 0.62 } }),
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(DEMO_DIR, name), content);
  }

  console.info('\nDemo-Zugänge (Passwort für alle: ' + PASSWORD + ')');
  console.info('  Operations : operator@demo.autopass.example');
  console.info('  Admin      : admin@demo.autopass.example');
  console.info('  Händler LU : haendler.lu@demo.autopass.example (Admin), mitarbeiterin.lu@demo.autopass.example');
  console.info('  Händler ZH : haendler.zh@demo.autopass.example');
  console.info('  Kundin LU  : anna.lu@demo.autopass.example (Szenarien 1, 4)');
  console.info('  Kunde ZH   : bruno.zh@demo.autopass.example (Szenario 2, Einladung offen)');
  console.info('  Firma      : carla.flotte@demo.autopass.example (Szenario 3)');
  console.info('\nEinladungslinks, die noch offen sind:');
  console.info(`  Szenario 2: ${s2.url}`);
  console.info(`  Szenario 3: ${s3a.url}`);
  console.info(`\nDemo-Dokumente zum Hochladen: ${DEMO_DIR}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
