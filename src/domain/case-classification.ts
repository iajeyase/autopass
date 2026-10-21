// Klassifikation des Zulassungsfalls. Reine Funktion, ohne Datenbankzugriff.
// Die drei priorisierten MVP-Fälle entsprechen den Vorgaben der Produktspezifikation.

export type PlateSituationValue = 'EXISTING_PLATES_AVAILABLE' | 'EXISTING_PLATES_UNKNOWN' | 'NEW_PLATES_REQUIRED';

export type CaseTypeValue =
  | 'VEHICLE_CHANGE_WITH_PLATES'
  | 'NEW_VEHICLE_NEW_PLATES'
  | 'USED_VEHICLE_PURCHASE'
  | 'MANUAL_CLASSIFICATION';

export interface ClassificationInput {
  isNewVehicle: boolean;
  plateSituation: PlateSituationValue;
}

export interface ClassificationResult {
  caseType: CaseTypeValue;
  // true, wenn ein Mensch den Fall prüfen muss, bevor die Regeln als belastbar gelten
  requiresManualReview: boolean;
  reason: string;
}

export function classifyCase(input: ClassificationInput): ClassificationResult {
  const { isNewVehicle, plateSituation } = input;

  if (plateSituation === 'EXISTING_PLATES_AVAILABLE') {
    return {
      caseType: 'VEHICLE_CHANGE_WITH_PLATES',
      requiresManualReview: false,
      reason: 'Vorhandene Kontrollschilder werden für den Fahrzeugwechsel verwendet.',
    };
  }

  if (isNewVehicle && plateSituation === 'NEW_PLATES_REQUIRED') {
    return {
      caseType: 'NEW_VEHICLE_NEW_PLATES',
      requiresManualReview: false,
      reason: 'Neufahrzeug ohne Kontrollschilder: Neuzuteilung erforderlich.',
    };
  }

  if (!isNewVehicle && plateSituation === 'NEW_PLATES_REQUIRED') {
    return {
      caseType: 'USED_VEHICLE_PURCHASE',
      requiresManualReview: false,
      reason: 'Occasion ohne verwendbare Kontrollschilder: Neuzuteilung erforderlich.',
    };
  }

  return {
    caseType: 'MANUAL_CLASSIFICATION',
    requiresManualReview: true,
    reason: 'Die Kombination aus Fahrzeugstatus und Kontrollschildsituation ist unklar. Manuelle Klassifikation nötig.',
  };
}
