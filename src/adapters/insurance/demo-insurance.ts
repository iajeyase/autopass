import { env } from '@/lib/env';
import type { AdapterOutcome } from '../types';
import type { InsuranceAdapter, InsuranceCoverageRequest } from './insurance-adapter';

// DEMO-VERSICHERER. Keine echte Versicherung, keine echte Police, kein echter eVN.
// Antworten werden über die Demo-Simulation erzeugt und sind in der Oberfläche als "Simulation" gekennzeichnet.
export const demoInsuranceAdapter: InsuranceAdapter = {
  key: 'DEMO_INSURER',
  displayName: 'Demo-Versicherung (Simulation)',
  kind: 'DEMO_SIMULATION',

  async requestCoverage(request: InsuranceCoverageRequest): Promise<AdapterOutcome<{ externalReference: string }>> {
    if (!env().DEMO_MODE) {
      return {
        status: 'NOT_INTEGRATED',
        reason: 'Keine Versicherungsanbindung konfiguriert. Bitte manuell über den Versicherungspartner bearbeiten.',
      };
    }
    if (request.simulateTransientFailures > 0) {
      return {
        status: 'TRANSIENT_ERROR',
        reason: 'Demo: Versicherungsschnittstelle antwortet nicht (simulierter Fehler).',
      };
    }
    const suffix = request.idempotencyKey.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
    return { status: 'OK', value: { externalReference: `DEMO-INS-${suffix}` } };
  },
};
