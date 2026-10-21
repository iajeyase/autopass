// OCR-Adapter für den Demo-Betrieb.
//
// ACHTUNG: Dies ist KEINE echte Texterkennung. Der Adapter liest ausschliesslich eine Demo-Markierung
// im Dokument ("AUTOPASS-DEMO-FIELDS: {...}"), die die Demo-Dokumente selbst enthalten.
// Für echte OCR ist ein eigener Adapter (z. B. Tesseract im Container) vorgesehen; siehe docs/03-integrationen.md.
// Jede Extraktion bleibt ein Vorschlag mit Konfidenzwert und muss manuell bestätigt werden.

export interface ExtractedField {
  key: string;
  value: string;
  confidence: number;
}

export interface OcrResult {
  extractor: string;
  fields: ExtractedField[];
  note: string | null;
}

const MARKER = 'AUTOPASS-DEMO-FIELDS:';
const ALLOWED_KEYS = ['vin', 'plateNumber', 'make', 'model', 'firstRegistrationDate', 'holderName'] as const;

export function extractDemoFields(content: Buffer): OcrResult {
  // Die Markierung liegt als Klartext im Dokument (PDF-Kommentar oder Textblock).
  const text = content.toString('latin1');
  const index = text.indexOf(MARKER);
  if (index === -1) {
    return {
      extractor: 'DEMO_OCR',
      fields: [],
      note: 'Keine automatische Erkennung möglich. Bitte Werte manuell erfassen.',
    };
  }
  const start = index + MARKER.length;
  const end = text.indexOf('\n', start);
  const raw = text.slice(start, end === -1 ? undefined : end).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { extractor: 'DEMO_OCR', fields: [], note: 'Demo-Markierung ist kein gültiges JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { extractor: 'DEMO_OCR', fields: [], note: 'Demo-Markierung hat ein ungültiges Format.' };
  }
  const fields: ExtractedField[] = [];
  for (const key of ALLOWED_KEYS) {
    const entry = (parsed as Record<string, unknown>)[key];
    if (entry && typeof entry === 'object') {
      const value = String((entry as { value?: unknown }).value ?? '').trim();
      const confidence = Number((entry as { confidence?: unknown }).confidence ?? 0);
      if (value.length > 0 && confidence >= 0 && confidence <= 1) {
        fields.push({ key, value, confidence });
      }
    }
  }
  return { extractor: 'DEMO_OCR', fields, note: 'Demo-Extraktion. Keine echte Texterkennung.' };
}
