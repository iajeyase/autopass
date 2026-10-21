import { describe, expect, it } from 'vitest';
import { classifyCase } from '@/domain/case-classification';
import { isCantonCode, PILOT_CANTONS } from '@/domain/cantons';
import { evaluateRequirements, matchesCondition } from '@/domain/rules/engine';
import { buildRuleset, GENERIC_CANTON, seedRulesets } from '@/domain/rules/seed-rulesets';
import type { CaseFacts } from '@/domain/rules/types';
import { isValidVin, normalizeVin, vinsMatch } from '@/domain/vin';

const baseFacts: CaseFacts = {
  caseType: 'VEHICLE_CHANGE_WITH_PLATES',
  plateSituation: 'EXISTING_PLATES_AVAILABLE',
  isNewVehicle: false,
  wasPreviouslyRegistered: true,
  isCompanyBuyer: false,
  isImport: false,
};

describe('Fallklassifikation', () => {
  it('erkennt den Fahrzeugwechsel mit bestehenden Kontrollschildern (Fall 1)', () => {
    const result = classifyCase({ isNewVehicle: false, plateSituation: 'EXISTING_PLATES_AVAILABLE' });
    expect(result.caseType).toBe('VEHICLE_CHANGE_WITH_PLATES');
    expect(result.requiresManualReview).toBe(false);
  });

  it('erkennt die Neuzulassung eines Neuwagens mit neuen Kontrollschildern (Fall 2)', () => {
    const result = classifyCase({ isNewVehicle: true, plateSituation: 'NEW_PLATES_REQUIRED' });
    expect(result.caseType).toBe('NEW_VEHICLE_NEW_PLATES');
  });

  it('erkennt den Occasion-Kauf ohne verwendbare Schilder (Fall 3)', () => {
    const result = classifyCase({ isNewVehicle: false, plateSituation: 'NEW_PLATES_REQUIRED' });
    expect(result.caseType).toBe('USED_VEHICLE_PURCHASE');
  });

  it('verlangt manuelle Klassifikation, wenn Schilderstatus unbekannt ist', () => {
    const result = classifyCase({ isNewVehicle: true, plateSituation: 'EXISTING_PLATES_UNKNOWN' });
    expect(result.caseType).toBe('MANUAL_CLASSIFICATION');
    expect(result.requiresManualReview).toBe(true);
  });
});

describe('VIN-Validierung', () => {
  it('akzeptiert eine gültige 17-stellige VIN ohne I, O, Q', () => {
    expect(isValidVin('WVWZZZ1JZXW000001')).toBe(true);
  });

  it('lehnt VIN mit verbotenen Zeichen oder falscher Länge ab', () => {
    expect(isValidVin('WVWZZZ1JZXW00000I')).toBe(false);
    expect(isValidVin('WVWZZZ1JZXW00000')).toBe(false);
  });

  it('normalisiert Leerzeichen und Bindestriche', () => {
    expect(normalizeVin('wvw-zzz 1jzxw000001')).toBe('WVWZZZ1JZXW000001');
    expect(vinsMatch('wvw zzz1jzxw000001', 'WVWZZZ1JZXW000001')).toBe(true);
  });
});

describe('Kantonale Regel-Engine', () => {
  it('nimmt nur Kantone aus der offiziellen Liste an', () => {
    expect(isCantonCode('LU')).toBe(true);
    expect(isCantonCode('DE')).toBe(false);
    expect(PILOT_CANTONS).toEqual(['LU', 'ZH']);
  });

  it('wertet Bedingungen korrekt aus', () => {
    expect(matchesCondition({ always: true }, baseFacts)).toBe(true);
    expect(matchesCondition({ plateSituations: ['NEW_PLATES_REQUIRED'] }, baseFacts)).toBe(false);
    expect(matchesCondition({}, baseFacts)).toBe(false);
  });

  it('liefert für den Wechsel mit Schildern die Schilderprüfung, nicht die Neuzuteilung', () => {
    const reqs = evaluateRequirements(buildRuleset('LU', 1), baseFacts);
    const keys = reqs.map((r) => r.ruleKey);
    expect(keys).toContain('PLATES_REUSE_CHECK');
    expect(keys).not.toContain('PLATES_NEW_ALLOCATION');
  });

  it('verlangt für Neuwagen keine Prüfung 13.20A', () => {
    const reqs = evaluateRequirements(buildRuleset('ZH', 1), {
      ...baseFacts,
      isNewVehicle: true,
      wasPreviouslyRegistered: false,
      plateSituation: 'NEW_PLATES_REQUIRED',
    });
    expect(reqs.map((r) => r.ruleKey)).not.toContain('INSPECTION_REPORT_13_20A');
    expect(reqs.map((r) => r.ruleKey)).toContain('PLATES_NEW_ALLOCATION');
  });

  it('markiert jede Regel im Seed-Stand als nicht verifiziert', () => {
    for (const ruleset of seedRulesets()) {
      expect(ruleset.status).toBe('UNVERIFIED');
      for (const rule of ruleset.rules) {
        expect(rule.verified).toBe(false);
        expect(rule.sourceRef).toMatch(/^https:\/\//);
      }
    }
  });

  it('erkennt doppelte Regelschlüssel', () => {
    const ruleset = buildRuleset('LU', 1);
    ruleset.rules.push({ ...ruleset.rules[0] });
    expect(() => evaluateRequirements(ruleset, baseFacts)).toThrow(/Doppelter Regelschlüssel/);
  });

  it('besitzt ein generisches Fallback-Regelwerk für übrige Kantone', () => {
    const generic = seedRulesets().find((r) => r.canton === GENERIC_CANTON);
    expect(generic).toBeDefined();
  });
});
