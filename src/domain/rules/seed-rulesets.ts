// Regelwerke für den Pilot (LU, ZH) und den generischen Fallback.
//
// WICHTIG – Verifizierungsstatus:
// Die amtlichen Quellen konnten bei der Erstellung dieses Stands NICHT abgerufen werden
// (keine Verbindung aus der Entwicklungsumgebung). Daher ist jede Regel mit verified: false markiert.
// Kantonsspezifische Abweichungen (z. B. genaue Dokumentenlisten, Wiederverwendung von Kontrollschildern,
// Einreichungswege) sind NICHT erfasst und dürfen nicht aus Vermutungen ergänzt werden.
// Ein Mensch aus dem Operations-Team muss jede Regel gegen die Quelle prüfen und verified: true setzen,
// bevor die Regel ausserhalb der Demo wirkt.

import type { RuleDefinition, RulesetDefinition } from './types';

interface CantonSource {
  canton: string;
  urls: string[];
}

const CH_CH_VEHICLE_PAGE = 'https://www.ch.ch/de/fahrzeuge-und-verkehr/autos-und-andere-fahrzeuge/fahrzeug-einlosen/';
const ASTRA_DIGITAL_PAGE = 'https://www.astra.admin.ch/de/digitale-fahrzeugzulassung';
// Fedlex-Adresse aus der Projektspezifikation. Die Zuordnung zu einem konkreten Erlass ist nicht verifiziert.
const FEDLEX_REFERENCE = 'https://www.fedlex.admin.ch/eli/cc/2018/783/de';

const CANTON_SOURCES: Record<string, CantonSource> = {
  LU: {
    canton: 'LU',
    urls: ['https://strassenverkehrsamt.lu.ch/Digitale_Dienstleistungen/eFahrzeugzulassung'],
  },
  ZH: {
    canton: 'ZH',
    urls: ['https://www.zh.ch/de/mobilitaet/fahrzeuge-kontrollschilder.html'],
  },
};

// Bundesweite Regeln, die für jeden Kanton gelten und mit der Quelle zu prüfen sind.
function baseRules(): RuleDefinition[] {
  return [
    {
      key: 'ID_PROOF',
      title: 'Identitätsnachweis des Halters',
      category: 'DOCUMENT',
      documentKind: 'IDENTITY',
      when: { always: true },
      verified: false,
      sourceRef: CH_CH_VEHICLE_PAGE,
      note: 'Art des Nachweises und Kopie- beziehungsweise Originalpflicht nicht verifiziert.',
    },
    {
      key: 'VEHICLE_REGISTRATION',
      title: 'Fahrzeugausweis',
      category: 'DOCUMENT',
      documentKind: 'VEHICLE_REGISTRATION',
      when: { wasPreviouslyRegistered: true },
      verified: false,
      sourceRef: CH_CH_VEHICLE_PAGE,
      note: 'Ob Original oder digitale Fassung genügt, ist nicht verifiziert.',
    },
    {
      key: 'INSPECTION_REPORT_13_20A',
      title: 'Prüfungsbericht 13.20A',
      category: 'DOCUMENT',
      documentKind: 'INSPECTION_REPORT_13_20A',
      when: { isNewVehicle: false },
      verified: false,
      sourceRef: FEDLEX_REFERENCE,
      note: 'Erforderlichkeit je Fallart und Kanton nicht verifiziert.',
    },
    {
      key: 'INSURANCE_EVN',
      title: 'Gültige Motorfahrzeug-Haftpflichtversicherung (eVN durch Versicherung übermittelt)',
      category: 'INSURANCE',
      when: { always: true },
      verified: false,
      sourceRef: CH_CH_VEHICLE_PAGE,
      note: 'Der Versicherungsnachweis wird durch die Versicherung an die Behörde übermittelt. AutoPass erstellt keinen eVN.',
    },
    {
      key: 'PLATES_REUSE_CHECK',
      title: 'Bestehende Kontrollschilder prüfen und für den Fahrzeugwechsel verwenden',
      category: 'PLATE',
      when: { plateSituations: ['EXISTING_PLATES_AVAILABLE'] },
      verified: false,
      sourceRef: ASTRA_DIGITAL_PAGE,
      note: 'Wiederverwendung ist kantonal zu prüfen. Die Behörde entscheidet.',
    },
    {
      key: 'PLATES_NEW_ALLOCATION',
      title: 'Neue Kontrollschilder: Zuteilung durch die zuständige Stelle',
      category: 'PLATE',
      when: { plateSituations: ['NEW_PLATES_REQUIRED', 'EXISTING_PLATES_UNKNOWN'] },
      verified: false,
      sourceRef: ASTRA_DIGITAL_PAGE,
      note: 'Eine Zuteilung kann nicht durch den Kontrollschildhersteller ersetzt werden.',
    },
    {
      key: 'ORIGINALS_CHECK',
      title: 'Prüfung, ob Originaldokumente erforderlich sind',
      category: 'ORIGINAL',
      when: { always: true },
      verified: false,
      sourceRef: CH_CH_VEHICLE_PAGE,
      note: 'Digitale Kopie ersetzt kein vorgeschriebenes Originaldokument. Pflicht je Dokument nicht verifiziert.',
    },
    {
      key: 'COMPANY_REPRESENTATION',
      title: 'Vertretungsnachweis für Unternehmen (Handelsregisterauszug oder Vollmacht)',
      category: 'DOCUMENT',
      documentKind: 'COMMERCIAL_REGISTER',
      when: { isCompanyBuyer: true },
      verified: false,
      sourceRef: CH_CH_VEHICLE_PAGE,
      note: 'Welcher Nachweis genügt, ist nicht verifiziert.',
    },
    {
      key: 'IMPORT_CHECK',
      title: 'Importfahrzeug: zoll- und technische Nachweise prüfen',
      category: 'INSPECTION',
      when: { isImport: true },
      verified: false,
      sourceRef: ASTRA_DIGITAL_PAGE,
      note: 'Zollnachweise und Prüfpflichten für Importfahrzeuge sind nicht erfasst.',
    },
  ];
}

export function buildRuleset(canton: string, version: number): RulesetDefinition {
  const source = CANTON_SOURCES[canton];
  return {
    canton,
    version,
    status: 'UNVERIFIED',
    sourceUrls: source ? source.urls : [CH_CH_VEHICLE_PAGE],
    sourceCheckedAt: null,
    rules: baseRules(),
  };
}

export const GENERIC_CANTON = 'XX';

// Alle Regelwerke, die beim Seeding angelegt werden. Kantone ohne Pilot erhalten das generische
// Fallback-Regelwerk und einen manuellen Prüfauftrag.
export function seedRulesets(): RulesetDefinition[] {
  return [buildRuleset('LU', 1), buildRuleset('ZH', 1), buildRuleset(GENERIC_CANTON, 1)];
}
