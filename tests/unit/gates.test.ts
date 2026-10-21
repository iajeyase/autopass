import { describe, expect, it } from 'vitest';
import { handoverDecision, submissionBlockers, type GateFacts } from '@/domain/gates';

function facts(overrides: Partial<GateFacts> = {}): GateFacts {
  return {
    purchaseConfirmed: true,
    onHold: false,
    requirements: [
      { ruleKey: 'ID_PROOF', status: 'SATISFIED' },
      { ruleKey: 'PLATES_REUSE_CHECK', status: 'SATISFIED' },
    ],
    insurance: { status: 'CONFIRMED', source: 'OPERATOR' },
    registrationConfirmation: { source: 'OPERATOR' },
    temporaryAuthorization: null,
    openBlockingReviews: 0,
    ...overrides,
  };
}

describe('Übergabe-Gate', () => {
  it('gibt nur frei, wenn alle Bedingungen aus realen Quellen erfüllt sind', () => {
    const decision = handoverDecision(facts());
    expect(decision.level).toBe('RELEASED');
    expect(decision.blockers).toEqual([]);
  });

  it('blockiert, wenn der Versicherungsnachweis nicht bestätigt ist (Szenario 5)', () => {
    const decision = handoverDecision(facts({ insurance: { status: 'IN_PROGRESS', source: 'SIMULATION' } }));
    expect(decision.level).toBe('BLOCKED');
    expect(decision.blockers.map((b) => b.code)).toContain('INSURANCE_NOT_CONFIRMED');
  });

  it('blockiert, wenn keine behördliche Bestätigung vorliegt', () => {
    const decision = handoverDecision(facts({ registrationConfirmation: null }));
    expect(decision.level).toBe('BLOCKED');
    expect(decision.blockers.map((b) => b.code)).toContain('NO_AUTHORITY_CONFIRMATION');
  });

  it('stuft eine simulierte Behördenbestätigung als DEMO_SIMULATED ein, nie als RELEASED', () => {
    const decision = handoverDecision(facts({ registrationConfirmation: { source: 'SIMULATION' } }));
    expect(decision.level).toBe('DEMO_SIMULATED');
    expect(decision.simulatedSources).toContain('Behördenbestätigung');
  });

  it('stuft eine simulierte Versicherungsbestätigung als DEMO_SIMULATED ein', () => {
    const decision = handoverDecision(facts({ insurance: { status: 'CONFIRMED', source: 'SIMULATION' } }));
    expect(decision.level).toBe('DEMO_SIMULATED');
    expect(decision.simulatedSources).toContain('Versicherungsbestätigung');
  });

  it('blockiert eine Behördenquelle, die weder real noch Simulation ist', () => {
    const decision = handoverDecision(facts({ registrationConfirmation: { source: 'SYSTEM' } }));
    expect(decision.level).toBe('BLOCKED');
    expect(decision.blockers.map((b) => b.code)).toContain('AUTHORITY_SOURCE_NOT_REAL');
  });

  it('blockiert bei offenen Prüfungen und bei pausierten Fällen', () => {
    expect(handoverDecision(facts({ openBlockingReviews: 1 })).level).toBe('BLOCKED');
    expect(handoverDecision(facts({ onHold: true })).level).toBe('BLOCKED');
  });

  it('erkennt offene Anforderungen', () => {
    const blockers = submissionBlockers(
      facts({ requirements: [{ ruleKey: 'ID_PROOF', status: 'OPEN' }] }),
    );
    expect(blockers.map((b) => b.code)).toContain('REQUIREMENTS_OPEN');
  });

  it('verlangt eine Prozessbestätigung für die Einreichung', () => {
    const blockers = submissionBlockers(facts({ purchaseConfirmed: false }));
    expect(blockers.map((b) => b.code)).toContain('NO_PURCHASE_CONFIRMATION');
  });
});
