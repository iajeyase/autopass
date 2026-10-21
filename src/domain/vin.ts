// Fahrgestellnummer (VIN): 17 Zeichen, ohne I, O und Q (ISO 3779 / ISO 3779-konforme Schreibweise).
// Die Prüfziffer (Position 9) wird bewusst NICHT erzwungen: Europäische Fahrzeuge verwenden sie
// nicht verbindlich. Abweichungen werden als Datenkonflikt gemeldet, nicht stillschweigend korrigiert.

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidVin(raw: string): boolean {
  return VIN_PATTERN.test(normalizeVin(raw));
}

export function vinsMatch(a: string, b: string): boolean {
  return normalizeVin(a) === normalizeVin(b);
}
