import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, InvalidTransitionError, isTerminal } from '@/domain/case-state';

describe('Zustandsmaschine Zulassungsfall', () => {
  it('erlaubt den Hauptpfad vom Verkauf bis zur Übergabe', () => {
    expect(() => assertTransition('SALE_CREATED', 'INVITED', 'DEALER')).not.toThrow();
    expect(() => assertTransition('INVITED', 'PURCHASE_CONFIRMED', 'CUSTOMER')).not.toThrow();
    expect(() => assertTransition('PURCHASE_CONFIRMED', 'PREPARATION', 'SYSTEM')).not.toThrow();
    expect(() => assertTransition('PREPARATION', 'REVIEW', 'CUSTOMER')).not.toThrow();
    expect(() => assertTransition('REVIEW', 'READY_FOR_SUBMISSION', 'OPERATOR')).not.toThrow();
    expect(() => assertTransition('READY_FOR_SUBMISSION', 'SUBMITTED', 'OPERATOR')).not.toThrow();
    expect(() => assertTransition('SUBMITTED', 'AUTHORITY_PROCESSING', 'PARTNER_WEBHOOK')).not.toThrow();
    expect(() => assertTransition('AUTHORITY_PROCESSING', 'PLATES_AND_ORIGINALS', 'OPERATOR')).not.toThrow();
    expect(() => assertTransition('PLATES_AND_ORIGINALS', 'HANDOVER_RELEASABLE', 'SYSTEM')).not.toThrow();
    expect(() => assertTransition('HANDOVER_RELEASABLE', 'HANDED_OVER', 'DEALER')).not.toThrow();
    expect(() => assertTransition('HANDED_OVER', 'CLOSED', 'SYSTEM')).not.toThrow();
  });

  it('verbietet Sprünge, die nicht im Graphen stehen', () => {
    expect(canTransition('SALE_CREATED', 'HANDED_OVER')).toBe(false);
    expect(canTransition('PREPARATION', 'HANDED_OVER')).toBe(false);
    expect(() => assertTransition('PREPARATION', 'HANDOVER_RELEASABLE', 'OPERATOR')).toThrow(InvalidTransitionError);
  });

  it('verbietet Übergänge für Parteien, die nicht berechtigt sind', () => {
    // Ein Händler darf keine behördliche Zulassung bestätigen
    expect(() => assertTransition('SUBMITTED', 'AUTHORITY_PROCESSING', 'DEALER')).toThrow(/darf von dieser Partei/);
    // Der Kunde darf die Übergabe nicht freigeben
    expect(() => assertTransition('PLATES_AND_ORIGINALS', 'HANDOVER_RELEASABLE', 'CUSTOMER')).toThrow(InvalidTransitionError);
    // Der Kunde darf keine Einreichung auslösen
    expect(() => assertTransition('READY_FOR_SUBMISSION', 'SUBMITTED', 'CUSTOMER')).toThrow(InvalidTransitionError);
  });

  it('markiert CLOSED und CANCELLED als Endzustände', () => {
    expect(isTerminal('CLOSED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('REVIEW')).toBe(false);
    expect(canTransition('CLOSED', 'PREPARATION')).toBe(false);
  });

  it('erlaubt ON_HOLD nur aus aktiven Zuständen und verlässt es nicht über den Graphen', () => {
    expect(canTransition('PREPARATION', 'ON_HOLD')).toBe(true);
    expect(canTransition('ON_HOLD', 'PREPARATION')).toBe(false);
  });
});
