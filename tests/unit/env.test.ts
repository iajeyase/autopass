import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env, resetEnvForTests } from '@/lib/env';

const BASE = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
  APP_ENV: 'production',
  DEMO_MODE: 'false',
  INSURANCE_DEMO_WEBHOOK_SECRET: 'a-very-long-and-individual-secret-value-123',
  STORAGE_DRIVER: 'local',
};

function withEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetEnvForTests();
}

describe('Produktionskonfiguration', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    withEnv({ ...BASE, VERCEL: undefined });
  });

  afterEach(() => {
    process.env = { ...saved };
    resetEnvForTests();
  });

  it('akzeptiert eine vollständige Produktionskonfiguration', () => {
    expect(env().APP_ENV).toBe('production');
  });

  it('verbietet den Demo-Modus in Produktion', () => {
    withEnv({ DEMO_MODE: 'true' });
    expect(() => env()).toThrow(/DEMO_MODE/);
  });

  it('verbietet den Standard-Webhook-Schlüssel in Produktion', () => {
    withEnv({ INSURANCE_DEMO_WEBHOOK_SECRET: 'demo-only-change-me' });
    expect(() => env()).toThrow(/INSURANCE_DEMO_WEBHOOK_SECRET/);
  });

  it('verbietet lokalen Speicher auf Vercel', () => {
    withEnv({ VERCEL: '1' });
    expect(() => env()).toThrow(/Vercel/);
  });

  it('verlangt vollständige S3-Zugangsdaten, wenn S3 gewählt ist', () => {
    withEnv({ STORAGE_DRIVER: 's3', VERCEL: '1' });
    expect(() => env()).toThrow(/S3-Speicher/);
    withEnv({ S3_BUCKET: 'b', S3_REGION: 'eu-central-2', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' });
    expect(env().STORAGE_DRIVER).toBe('s3');
  });
});
