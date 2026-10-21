// Freigabe-Gates. Reine Funktionen: entscheiden anhand der gesammelten Fakten, ob ein Übergang
// zulässig ist. Die Datenbankschicht lädt die Fakten und ruft diese Funktionen auf.
//
// Grundsatz: Simulierte Ereignisse werden nie als reale Bestätigung gewertet.

export type RequirementStateValue = 'OPEN' | 'SATISFIED' | 'NOT_APPLICABLE';
export type EvidenceSource = 'SYSTEM' | 'CUSTOMER' | 'DEALER' | 'OPERATOR' | 'PARTNER_WEBHOOK' | 'SIMULATION';
export type InsuranceStateValue =
  | 'NOT_STARTED'
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'CONFIRMED'
  | 'NOT_VERIFIED'
  | 'PROBLEM';

export interface GateFacts {
  purchaseConfirmed: boolean;
  onHold: boolean;
  // Nicht verifizierte Regeln erzeugen beim Planen einen offenen Prüfauftrag (openBlockingReviews).
  requirements: { ruleKey: string; status: RequirementStateValue }[];
  insurance: { status: InsuranceStateValue; source: EvidenceSource | null };
  // letzte behördliche Bestätigung der Zulassung
  registrationConfirmation: { source: EvidenceSource } | null;
  // nur von der Behörde ausgestellte, manuell erfasste vorläufige Berechtigung
  temporaryAuthorization: { source: EvidenceSource } | null;
  openBlockingReviews: number;
}

export interface Blocker {
  code: string;
  message: string;
}

// Quellen, die als reale Partner- oder Mitarbeiterbestätigung gelten.
export function isRealSource(source: EvidenceSource | null): boolean {
  return source === 'PARTNER_WEBHOOK' || source === 'OPERATOR';
}

// Blocker für den Übergang nach READY_FOR_SUBMISSION (Fall ist bereit zur Einreichung).
export function submissionBlockers(facts: GateFacts): Blocker[] {
  const blockers: Blocker[] = [];
  if (facts.onHold) {
    blockers.push({ code: 'ON_HOLD', message: 'Der Fall ist pausiert.' });
  }
  if (!facts.purchaseConfirmed) {
    blockers.push({ code: 'NO_PURCHASE_CONFIRMATION', message: 'Die Prozessbestätigung des Käufers fehlt.' });
  }
  const open = facts.requirements.filter((r) => r.status === 'OPEN');
  if (open.length > 0) {
    blockers.push({
      code: 'REQUIREMENTS_OPEN',
      message: `${open.length} Anforderung(en) sind noch offen.`,
    });
  }
  if (facts.insurance.status !== 'CONFIRMED') {
    blockers.push({
      code: 'INSURANCE_NOT_CONFIRMED',
      message: 'Der Versicherungsnachweis ist nicht bestätigt.',
    });
  }
  if (facts.openBlockingReviews > 0) {
    blockers.push({
      code: 'OPEN_REVIEW',
      message: `${facts.openBlockingReviews} offene manuelle Prüfung(en).`,
    });
  }
  return blockers;
}

export type HandoverLevel = 'BLOCKED' | 'DEMO_SIMULATED' | 'RELEASED';

export interface HandoverDecision {
  level: HandoverLevel;
  blockers: Blocker[];
  // Hinweise, warum eine Freigabe nur simuliert ist
  simulatedSources: string[];
}

// Entscheidet, ob die Fahrzeugübergabe freigegeben werden darf.
//  - BLOCKED: mindestens eine Bedingung fehlt. Übergabe ist nicht zulässig.
//  - DEMO_SIMULATED: alle Bedingungen erfüllt, aber eine Bestätigung stammt aus einer Simulation.
//    Die Oberfläche darf dann NICHT "Ihr Fahrzeug kann übergeben werden" anzeigen.
//  - RELEASED: alle Bedingungen erfüllt, alle Bestätigungen stammen aus realen Quellen.
export function handoverDecision(facts: GateFacts): HandoverDecision {
  const blockers = submissionBlockers(facts);

  if (!facts.registrationConfirmation && !facts.temporaryAuthorization) {
    blockers.push({
      code: 'NO_AUTHORITY_CONFIRMATION',
      message: 'Keine behördliche Bestätigung der Zulassung oder vorläufigen Berechtigung erfasst.',
    });
  }

  const authoritySource = facts.registrationConfirmation?.source ?? facts.temporaryAuthorization?.source ?? null;

  const simulatedSources: string[] = [];
  if (facts.insurance.source === 'SIMULATION') {
    simulatedSources.push('Versicherungsbestätigung');
  }
  if (facts.registrationConfirmation?.source === 'SIMULATION') {
    simulatedSources.push('Behördenbestätigung');
  }
  if (facts.temporaryAuthorization?.source === 'SIMULATION') {
    simulatedSources.push('vorläufige Verkehrsberechtigung');
  }

  if (blockers.length > 0) {
    return { level: 'BLOCKED', blockers, simulatedSources };
  }
  if (simulatedSources.length > 0) {
    return { level: 'DEMO_SIMULATED', blockers: [], simulatedSources };
  }
  if (authoritySource && !isRealSource(authoritySource)) {
    // Ein Sonderfall: Behördenquelle ohne reale Zuordnung (z. B. SYSTEM). Nicht freigeben.
    return {
      level: 'BLOCKED',
      blockers: [
        {
          code: 'AUTHORITY_SOURCE_NOT_REAL',
          message: 'Die behördliche Bestätigung ist nicht aus einer belegbaren Quelle erfasst.',
        },
      ],
      simulatedSources,
    };
  }
  return { level: 'RELEASED', blockers: [], simulatedSources };
}
