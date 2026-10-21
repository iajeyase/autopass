import type { CaseFacts, EvaluatedRequirement, RuleCondition, RuleDefinition, RulesetDefinition } from './types';

// Prüft eine einzelne Bedingung. Leere Bedingungen gelten nicht, außer always ist gesetzt.
export function matchesCondition(condition: RuleCondition, facts: CaseFacts): boolean {
  if (condition.always) {
    return true;
  }
  const checks: boolean[] = [];
  if (condition.caseTypes) {
    checks.push(condition.caseTypes.includes(facts.caseType));
  }
  if (condition.plateSituations) {
    checks.push(condition.plateSituations.includes(facts.plateSituation));
  }
  if (condition.isNewVehicle !== undefined) {
    checks.push(condition.isNewVehicle === facts.isNewVehicle);
  }
  if (condition.wasPreviouslyRegistered !== undefined) {
    checks.push(condition.wasPreviouslyRegistered === facts.wasPreviouslyRegistered);
  }
  if (condition.isCompanyBuyer !== undefined) {
    checks.push(condition.isCompanyBuyer === facts.isCompanyBuyer);
  }
  if (condition.isImport !== undefined) {
    checks.push(condition.isImport === facts.isImport);
  }
  // Eine Regel ohne jede Bedingung gilt nie; so bleiben fehlerhafte Regeldaten wirkungslos.
  return checks.length > 0 && checks.every(Boolean);
}

function toRequirement(rule: RuleDefinition): EvaluatedRequirement {
  return {
    ruleKey: rule.key,
    title: rule.title,
    category: rule.category,
    documentKind: rule.documentKind,
    verified: rule.verified,
    sourceRef: rule.sourceRef,
    note: rule.note,
  };
}

// Ermittelt alle Anforderungen eines Falls aus einem Regelwerk.
// Ergebnis ist deterministisch: gleiche Eingabe -> gleiche Anforderungsliste, Reihenfolge wie im Regelwerk.
export function evaluateRequirements(ruleset: RulesetDefinition, facts: CaseFacts): EvaluatedRequirement[] {
  const seen = new Set<string>();
  const result: EvaluatedRequirement[] = [];
  for (const rule of ruleset.rules) {
    if (seen.has(rule.key)) {
      throw new Error(`Doppelter Regelschlüssel "${rule.key}" im Regelwerk ${ruleset.canton} v${ruleset.version}.`);
    }
    seen.add(rule.key);
    if (matchesCondition(rule.when, facts)) {
      result.push(toRequirement(rule));
    }
  }
  return result;
}
