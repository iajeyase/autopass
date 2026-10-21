// Formatierung nach Schweizer Konvention (de-CH): Datum TT.MM.JJJJ, Franken mit Apostroph als Tausendertrenner.

const DATE = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' });
const DATE_TIME = new Intl.DateTimeFormat('de-CH', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Zurich',
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '–';
  }
  return DATE.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return '–';
  }
  return DATE_TIME.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatChf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '–';
  }
  return `CHF ${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(amount).replace(/’/g, '’')}`;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)} %`;
}
