// Ableitung der Fall-Zeitleiste für Kunden- und Händlerportal.
// Jeder Schritt zeigt: Bedeutung, zuständige Partei, Datenquelle, Verifizierungsstatus und nächste Aktion.
// Ein interner Systemstatus wird nie als behördliche Bestätigung dargestellt.

import type { CaseState } from './case-state';
import type { InsuranceState } from './insurance-state';

export type StepState = 'done' | 'current' | 'open' | 'blocked';

export type Verification = 'VERIFIED_BY_TEAM' | 'SYSTEM_SUGGESTION' | 'SIMULATION' | 'NOT_VERIFIED' | 'PARTNER_CONFIRMED';

export const VERIFICATION_LABELS: Record<Verification, string> = {
  VERIFIED_BY_TEAM: 'Vom AutoPass-Team geprüft',
  SYSTEM_SUGGESTION: 'Automatischer Vorschlag, nicht geprüft',
  SIMULATION: 'Simulation (Demo), keine reale Bestätigung',
  NOT_VERIFIED: 'Nicht verifiziert',
  PARTNER_CONFIRMED: 'Von Partner übermittelt',
};

export interface TimelineStep {
  key: string;
  title: string;
  state: StepState;
  responsibleParty: string;
  dataSource: string;
  verification: Verification;
  nextAction: string | null;
}

export interface TimelineInput {
  status: CaseState;
  onHold: boolean;
  insurance: InsuranceState;
  insuranceFromSimulation: boolean;
  documentsSubmitted: boolean;
  authorityConfirmed: boolean;
  authorityFromSimulation: boolean;
  plateAndOriginalsDone: boolean;
}

const ORDER: CaseState[] = [
  'PURCHASE_CONFIRMED',
  'PREPARATION',
  'REVIEW',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'AUTHORITY_PROCESSING',
  'PLATES_AND_ORIGINALS',
  'HANDOVER_RELEASABLE',
  'HANDED_OVER',
  'CLOSED',
];

function reachedStatus(status: CaseState, target: CaseState): boolean {
  const current = ORDER.indexOf(status);
  const wanted = ORDER.indexOf(target);
  if (current === -1) {
    // Frühe Zustände (SALE_CREATED, INVITED) liegen vor dem Kaufbestätigungsschritt.
    return false;
  }
  return current >= wanted;
}

export function buildTimeline(input: TimelineInput): TimelineStep[] {
  const steps: Omit<TimelineStep, 'state'>[] = [
    {
      key: 'purchase',
      title: 'Fahrzeugkauf bestätigt',
      responsibleParty: 'Käufer',
      dataSource: 'Prozessbestätigung des Käufers (kein Kaufvertrag)',
      verification: 'VERIFIED_BY_TEAM',
      nextAction: 'Kaufangaben prüfen und bestätigen',
    },
    {
      key: 'documents',
      title: 'Dokumente eingereicht',
      responsibleParty: 'Käufer',
      dataSource: 'Hochgeladene Dokumente',
      verification: 'SYSTEM_SUGGESTION',
      nextAction: 'Fehlende Dokumente hochladen',
    },
    {
      key: 'insurance',
      title: 'Versicherungsnachweis',
      responsibleParty: 'Versicherung über AutoPass-Partner',
      dataSource: input.insuranceFromSimulation ? 'Simulation (Demo)' : 'Versicherungspartner',
      verification: input.insuranceFromSimulation ? 'SIMULATION' : input.insurance === 'CONFIRMED' ? 'PARTNER_CONFIRMED' : 'NOT_VERIFIED',
      nextAction: input.insurance === 'CONFIRMED' ? null : 'Versicherungsstatus abwarten',
    },
    {
      key: 'complete',
      title: 'Zulassungsunterlagen vollständig',
      responsibleParty: 'AutoPass-Team',
      dataSource: 'Prüfung der Dokumente und Angaben',
      verification: 'VERIFIED_BY_TEAM',
      nextAction: 'Unterlagen werden geprüft',
    },
    {
      key: 'submission',
      title: 'Einreichung bei zuständiger Stelle',
      responsibleParty: 'AutoPass-Team (manuelle Einreichung)',
      dataSource: 'Einreichungsprotokoll',
      verification: 'VERIFIED_BY_TEAM',
      nextAction: null,
    },
    {
      key: 'authority',
      title: 'Behördliche Bearbeitung',
      responsibleParty: 'Zuständiges Strassenverkehrsamt',
      dataSource: input.authorityFromSimulation ? 'Simulation (Demo)' : 'Behördenantwort, manuell erfasst',
      verification: input.authorityFromSimulation ? 'SIMULATION' : input.authorityConfirmed ? 'PARTNER_CONFIRMED' : 'NOT_VERIFIED',
      nextAction: null,
    },
    {
      key: 'plates',
      title: 'Kontrollschilder und Originaldokumente',
      responsibleParty: 'AutoPass-Team und Logistikpartner',
      dataSource: 'Operations-Erfassung',
      verification: 'VERIFIED_BY_TEAM',
      nextAction: null,
    },
    {
      key: 'handover',
      title: 'Fahrzeugübergabe möglich',
      responsibleParty: 'Händler',
      dataSource: 'Übergabe-Gate (alle Bedingungen)',
      verification: 'VERIFIED_BY_TEAM',
      nextAction: null,
    },
  ];

  const doneFlags: boolean[] = [
    reachedStatus(input.status, 'PURCHASE_CONFIRMED'),
    input.documentsSubmitted || reachedStatus(input.status, 'REVIEW'),
    input.insurance === 'CONFIRMED',
    reachedStatus(input.status, 'READY_FOR_SUBMISSION'),
    reachedStatus(input.status, 'SUBMITTED'),
    input.authorityConfirmed || reachedStatus(input.status, 'PLATES_AND_ORIGINALS'),
    input.plateAndOriginalsDone || reachedStatus(input.status, 'HANDOVER_RELEASABLE'),
    reachedStatus(input.status, 'HANDED_OVER'),
  ];

  const currentIndex = doneFlags.findIndex((done) => !done);

  return steps.map((step, index) => {
    let state: StepState;
    if (doneFlags[index]) {
      state = 'done';
    } else if (input.onHold && index === currentIndex) {
      state = 'blocked';
    } else if (index === currentIndex) {
      state = 'current';
    } else {
      state = 'open';
    }
    return { ...step, state };
  });
}
