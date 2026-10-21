import { db } from '@/lib/db';
import { loadGateFacts } from './case-engine';

// Fakten für die Freigabe-Gates in einer Lese-Transaktion, damit Anzeige und Übergänge dieselbe Logik nutzen.
export function buildGateFactsForView(caseId: string) {
  return db.$transaction((tx) => loadGateFacts(tx, caseId));
}
