import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const chromiumPath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// End-to-End-Tests laufen gegen einen Produktionsbuild mit Demo-Daten.
// Vorher: npm run db:deploy && npm run db:seed (Datenbank mit DATABASE_URL aus .env).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: chromiumPath } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath: chromiumPath } },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      APP_ENV: 'development',
      DEMO_MODE: 'true',
      APP_BASE_URL: `http://localhost:${PORT}`,
    },
  },
});
