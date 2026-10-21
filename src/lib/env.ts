import { z } from 'zod';

// Zentrale, validierte Konfiguration. Fehlende oder ungültige Werte brechen den Start früh ab.
const schema = z.object({
  // Betriebsart. "production" verbietet den Demo-Modus. NODE_ENV ist bei next build immer "production" und taugt dafür nicht.
  APP_ENV: z.enum(['development', 'demo', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  // Leer oder ungesetzt: auf Vercel wird die Produktions-URL genutzt (siehe env()).
  APP_BASE_URL: z.string().url().optional().or(z.literal('')),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  // Nur Prototyp: erlaubt lokalen Speicher auf Vercel (flüchtig, Dateien gehen bei Neustart verloren).
  ALLOW_LOCAL_STORAGE_ON_VERCEL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  // Leer lassen für AWS S3. Für R2 oder MinIO die Endpunkt-URL setzen.
  S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  INSURANCE_DEMO_WEBHOOK_SECRET: z.string().min(8).default('demo-only-change-me'),
  // Geheimnis für den Cron-Aufruf auf Vercel (Authorization: Bearer <CRON_SECRET>)
  CRON_SECRET: z.string().min(16).optional().or(z.literal('')),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    // Leere Variablen (z. B. in Vercel angelegt, aber ohne Wert) gelten als ungesetzt.
    const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '' && value !== undefined));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Ungültige Konfiguration: ${issues}`);
    }
    if (parsed.data.APP_ENV === 'production') {
      const problems: string[] = [];
      if (parsed.data.DEMO_MODE) {
        problems.push('DEMO_MODE darf in Produktion nicht aktiviert sein.');
      }
      if (parsed.data.INSURANCE_DEMO_WEBHOOK_SECRET === 'demo-only-change-me' || parsed.data.INSURANCE_DEMO_WEBHOOK_SECRET.length < 32) {
        problems.push('INSURANCE_DEMO_WEBHOOK_SECRET muss in Produktion mindestens 32 Zeichen lang und individuell sein.');
      }
      if (parsed.data.STORAGE_DRIVER === 'local' && process.env.VERCEL && !parsed.data.ALLOW_LOCAL_STORAGE_ON_VERCEL) {
        problems.push('STORAGE_DRIVER=local ist auf Vercel nicht zulässig.');
      }
      if (parsed.data.STORAGE_DRIVER === 's3' && (!parsed.data.S3_BUCKET || !parsed.data.S3_REGION || !parsed.data.S3_ACCESS_KEY_ID || !parsed.data.S3_SECRET_ACCESS_KEY)) {
        problems.push('S3-Speicher braucht S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY.');
      }
      if (problems.length > 0) {
        throw new Error('Produktionskonfiguration unvollständig: ' + problems.join(' '));
      }
    }
    const fallbackUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
    cached = { ...parsed.data, APP_BASE_URL: parsed.data.APP_BASE_URL || fallbackUrl, CRON_SECRET: parsed.data.CRON_SECRET || undefined };
  }
  return cached;
}

// Nur für Tests: erzwingt eine neue Auswertung der Umgebungsvariablen.
export function resetEnvForTests(): void {
  cached = null;
}
