import { z } from 'zod';

// Zentrale, validierte Konfiguration. Fehlende oder ungültige Werte brechen den Start früh ab.
const schema = z.object({
  // Betriebsart. "production" verbietet den Demo-Modus. NODE_ENV ist bei next build immer "production" und taugt dafür nicht.
  APP_ENV: z.enum(['development', 'demo', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  INSURANCE_DEMO_WEBHOOK_SECRET: z.string().min(8).default('demo-only-change-me'),
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
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Ungültige Konfiguration: ${issues}`);
    }
    if (parsed.data.APP_ENV === 'production' && parsed.data.DEMO_MODE) {
      throw new Error('DEMO_MODE darf in Produktion (APP_ENV=production) nicht aktiviert sein.');
    }
    cached = parsed.data;
  }
  return cached;
}

// Nur für Tests: erzwingt eine neue Auswertung der Umgebungsvariablen.
export function resetEnvForTests(): void {
  cached = null;
}
