import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Testumgebung: eigene Datenbank, Demo-Modus, feste Testgeheimnisse. Werte sind nie produktiv.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://autopass:autopass@localhost:5432/autopass_test?schema=public';
process.env.APP_ENV = 'development';
process.env.DEMO_MODE = 'true';
process.env.APP_BASE_URL = 'http://localhost:3000';
process.env.INSURANCE_DEMO_WEBHOOK_SECRET = 'test-secret-123456';
process.env.STORAGE_DIR = './storage-test';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/setup.ts', 'tests/integration/helpers.ts'],
    // Integrationstests wenden vorher die Migrationen auf die Testdatenbank an.
    globalSetup: process.env.AUTOPASS_INTEGRATION === '1' ? ['tests/integration/setup.ts'] : [],
    passWithNoTests: false,
  },
});
