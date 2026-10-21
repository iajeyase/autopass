import { env } from '@/lib/env';
import type { AdapterOutcome, IntegrationKind } from '../types';

export interface AuthoritySubmissionPayload {
  caseId: string;
  canton: string;
  caseType: string;
  vin: string;
  holderName: string;
  // Vollständiger Snapshot der eingereichten Daten, damit bei Ausfall nichts verloren geht
  snapshot: Record<string, unknown>;
  simulateTransientFailures: number;
}

export interface AuthoritySubmissionAdapter {
  readonly canton: string;
  readonly kind: IntegrationKind;
  submit(payload: AuthoritySubmissionPayload): Promise<AdapterOutcome<{ reference: string }>>;
}

// Für kein Kantonsamt besteht eine verifizierte, zugängliche Schnittstelle.
// Einreichungen laufen deshalb über den manuellen Weg. Die Demo kann einen vorübergehenden Ausfall simulieren.
function manualOnlyAdapter(canton: string): AuthoritySubmissionAdapter {
  return {
    canton,
    kind: 'NOT_INTEGRATED',
    async submit(payload) {
      if (env().DEMO_MODE && payload.simulateTransientFailures > 0) {
        return { status: 'TRANSIENT_ERROR', reason: 'Demo: Behördenschnittstelle nicht erreichbar (simulierter Fehler).' };
      }
      return {
        status: 'NOT_INTEGRATED',
        reason: `Für den Kanton ${canton} besteht keine verifizierte elektronische Einreichungsschnittstelle. Manuelle Einreichung erforderlich.`,
      };
    },
  };
}

export function getAuthorityAdapter(canton: string): AuthoritySubmissionAdapter {
  return manualOnlyAdapter(canton);
}
