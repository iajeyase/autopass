// Zustandsmodell des Versicherungsnachweises. Getrennt vom Fallstatus, damit Versicherung
// und Dokumente parallel laufen können.

export const INSURANCE_STATES = [
  'NOT_STARTED',
  'REQUESTED',
  'IN_PROGRESS',
  'CONFIRMED',
  'NOT_VERIFIED',
  'PROBLEM',
] as const;

export type InsuranceState = (typeof INSURANCE_STATES)[number];

const INSURANCE_GRAPH: Record<InsuranceState, readonly InsuranceState[]> = {
  NOT_STARTED: ['REQUESTED'],
  REQUESTED: ['IN_PROGRESS', 'CONFIRMED', 'NOT_VERIFIED', 'PROBLEM'],
  IN_PROGRESS: ['CONFIRMED', 'NOT_VERIFIED', 'PROBLEM'],
  CONFIRMED: ['PROBLEM'],
  NOT_VERIFIED: ['IN_PROGRESS', 'CONFIRMED', 'PROBLEM'],
  PROBLEM: ['IN_PROGRESS', 'CONFIRMED', 'NOT_VERIFIED'],
};

export function canMoveInsurance(from: InsuranceState, to: InsuranceState): boolean {
  return INSURANCE_GRAPH[from].includes(to);
}

export const INSURANCE_LABELS: Record<InsuranceState, string> = {
  NOT_STARTED: 'Noch nicht angefragt',
  REQUESTED: 'Versicherung angefragt',
  IN_PROGRESS: 'Versicherung in Bearbeitung',
  CONFIRMED: 'Versicherungsnachweis bestätigt',
  NOT_VERIFIED: 'Versicherungsstatus nicht verifiziert',
  PROBLEM: 'Versicherungsproblem',
};
