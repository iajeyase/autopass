// Gemeinsame Ergebnisform aller externen Adapter.
// Jeder Adapter meldet ehrlich, ob er eine Antwort hat, nicht eingebunden ist oder vorübergehend ausfällt.

export type AdapterOutcome<T> =
  | { status: 'OK'; value: T }
  // Keine öffentlich dokumentierte oder verifizierte Schnittstelle vorhanden: manueller Weg nötig.
  | { status: 'NOT_INTEGRATED'; reason: string }
  // Vorübergehender Fehler: die Aufgabe wird mit Backoff erneut ausgeführt.
  | { status: 'TRANSIENT_ERROR'; reason: string };

// Kennzeichnet, ob ein Adapter eine echte Anbindung oder eine Simulation ist.
export type IntegrationKind = 'LIVE' | 'DEMO_SIMULATION' | 'NOT_INTEGRATED';
