// Alle 26 Kantone der Schweiz (Kürzel nach offizieller Liste).
export const CANTONS = {
  AG: 'Aargau',
  AI: 'Appenzell Innerrhoden',
  AR: 'Appenzell Ausserrhoden',
  BE: 'Bern',
  BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt',
  FR: 'Freiburg',
  GE: 'Genf',
  GL: 'Glarus',
  GR: 'Graubünden',
  JU: 'Jura',
  LU: 'Luzern',
  NE: 'Neuenburg',
  NW: 'Nidwalden',
  OW: 'Obwalden',
  SG: 'St. Gallen',
  SH: 'Schaffhausen',
  SO: 'Solothurn',
  SZ: 'Schwyz',
  TG: 'Thurgau',
  TI: 'Tessin',
  UR: 'Uri',
  VD: 'Waadt',
  VS: 'Wallis',
  ZG: 'Zug',
  ZH: 'Zürich',
} as const;

export type CantonCode = keyof typeof CANTONS;

export const CANTON_CODES = Object.keys(CANTONS) as CantonCode[];

// Kantone, für die ein verifiziertes Regelwerk in dieser Version eingespielt wird (Pilot).
// Die Regeln selbst sind derzeit NICHT verifiziert, siehe src/domain/rules/seed-rulesets.ts.
export const PILOT_CANTONS: readonly CantonCode[] = ['LU', 'ZH'];

export function isCantonCode(value: string): value is CantonCode {
  return Object.prototype.hasOwnProperty.call(CANTONS, value);
}
