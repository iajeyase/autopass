// Auswahllisten für Formulare. Bezeichnungen in Schweizer Hochdeutsch.

export const DOCUMENT_KIND_OPTIONS = [
  { value: 'IDENTITY', label: 'Identitätsdokument' },
  { value: 'VEHICLE_REGISTRATION', label: 'Fahrzeugausweis' },
  { value: 'INSPECTION_REPORT_13_20A', label: 'Prüfungsbericht 13.20A' },
  { value: 'PURCHASE_CONTRACT', label: 'Kaufvertrag' },
  { value: 'POWER_OF_ATTORNEY', label: 'Vollmacht' },
  { value: 'RESIDENCE_PROOF', label: 'Wohnsitznachweis' },
  { value: 'COMMERCIAL_REGISTER', label: 'Handelsregisterauszug' },
  { value: 'INSURANCE_EVIDENCE', label: 'Versicherungsnachweis' },
  { value: 'OTHER', label: 'Sonstiges' },
];

export const AUTHORITY_KIND_OPTIONS = [
  { value: 'ACKNOWLEDGED', label: 'Eingangsbestätigung' },
  { value: 'MORE_DOCUMENTS_REQUESTED', label: 'Nachforderung von Unterlagen' },
  { value: 'REGISTRATION_CONFIRMED', label: 'Zulassung bestätigt' },
  { value: 'REJECTED', label: 'Ablehnung' },
];

export const INSURANCE_SIMULATION_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Versicherung: in Bearbeitung' },
  { value: 'CONFIRMED', label: 'Versicherung: bestätigt' },
  { value: 'PROBLEM', label: 'Versicherung: Problem' },
];
