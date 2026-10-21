// Datenmodell der kantonalen Regel-Engine. Regeln sind reine Daten (JSON in der Datenbank),
// damit sie versioniert, geprüft und ersetzt werden können, ohne Code zu ändern.

export type RequirementCategoryValue =
  | 'DOCUMENT'
  | 'DATA'
  | 'INSURANCE'
  | 'PLATE'
  | 'ORIGINAL'
  | 'INSPECTION'
  | 'AUTHORITY'
  | 'CONSENT';

export interface RuleCondition {
  // Gilt die Regel für alle Fälle? (Standard: false, wenn keine Bedingung gesetzt ist)
  always?: boolean;
  caseTypes?: string[];
  plateSituations?: string[];
  isNewVehicle?: boolean;
  wasPreviouslyRegistered?: boolean;
  isCompanyBuyer?: boolean;
  isImport?: boolean;
}

export interface RuleDefinition {
  key: string;
  title: string;
  category: RequirementCategoryValue;
  // Dokumentart, mit der diese Anforderung durch einen verifizierten Upload erfüllt wird
  documentKind?: string;
  when: RuleCondition;
  // Ist die Regel gegen eine amtliche Quelle geprüft worden? Bei false wird sie als "nicht verifiziert" ausgegeben.
  verified: boolean;
  sourceRef: string;
  note?: string;
}

export interface RulesetDefinition {
  canton: string;
  version: number;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED';
  sourceUrls: string[];
  sourceCheckedAt: string | null;
  rules: RuleDefinition[];
}

// Fallmerkmale, die die Regeln auswerten.
export interface CaseFacts {
  caseType: string;
  plateSituation: string;
  isNewVehicle: boolean;
  wasPreviouslyRegistered: boolean;
  isCompanyBuyer: boolean;
  isImport: boolean;
}

export interface EvaluatedRequirement {
  ruleKey: string;
  title: string;
  category: RequirementCategoryValue;
  documentKind?: string;
  verified: boolean;
  sourceRef: string;
  note?: string;
}
