import type { AdapterOutcome, IntegrationKind } from '../types';

export interface InsuranceCoverageRequest {
  caseId: string;
  vin: string;
  plateNumber: string | null;
  holderName: string;
  // Schutz vor doppelten Anfragen beim Partner
  idempotencyKey: string;
  // Nur im Demo-Modus ausgewertet: simuliert N fehlgeschlagene Versuche vor dem Erfolg
  simulateTransientFailures: number;
}

export interface InsuranceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly kind: IntegrationKind;
  requestCoverage(request: InsuranceCoverageRequest): Promise<AdapterOutcome<{ externalReference: string }>>;
}
