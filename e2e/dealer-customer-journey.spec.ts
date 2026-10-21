import { expect, test, type Browser } from '@playwright/test';

// Einzigartige, gültige VIN je Testlauf (ohne I, O, Q).
const ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
function randomVin(): string {
  const chars = Array.from({ length: 17 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  return `WVW${chars.join('').slice(3)}`;
}

test.describe.configure({ mode: 'serial' });

test.describe('Händler erfasst Verkauf, Käufer bestätigt', () => {
  const vin = randomVin();
  const buyerEmail = `kunde.${Date.now()}@example.test`;
  let inviteUrl = '';
  let caseUrl = '';

  test('Händler erfasst Verkauf und erzeugt Einladungslink', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('haendler.lu@demo.autopass.example');
    await page.getByLabel('Passwort').fill('Demo-Passwort-2026');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/haendler$/);

    await page.getByRole('link', { name: 'Neuer Verkauf' }).first().click();
    await expect(page.getByRole('heading', { name: 'Neuer Fahrzeugverkauf' })).toBeVisible();

    await page.getByLabel('Fahrgestellnummer (VIN)').fill('WV1');
    await page.getByRole('button', { name: 'Verkauf erfassen' }).click();
    await expect(page.getByText('Die Fahrgestellnummer hat 17 Zeichen')).toBeVisible();

    await page.getByLabel('Fahrgestellnummer (VIN)').fill(vin);
    await page.getByLabel('Marke').fill('Skoda');
    await page.getByLabel('Modell').fill('Octavia Combi');
    await page.getByLabel('Name des Käufers oder Firma').fill('Kundin Testfall');
    await page.getByLabel('E-Mail des Käufers').fill(buyerEmail);
    await page.getByLabel('Zulassungskanton').selectOption('LU');
    await page.getByLabel('Verkaufsdatum').fill('2026-10-20');
    await page.getByRole('button', { name: 'Verkauf erfassen' }).click();

    await expect(page).toHaveURL(/\/faelle\/[0-9a-f-]{36}$/);
    caseUrl = page.url();
    await expect(page.getByRole('heading', { name: 'Skoda Octavia Combi' })).toBeVisible();
    await page.getByRole('button', { name: 'Einladungslink erzeugen' }).click();
    const link = page.getByLabel('Einladungslink');
    await expect(link).toHaveValue(/\/einladung\/.+/);
    inviteUrl = await link.inputValue();
  });

  test('Käufer registriert sich über den Link, öffnet den Vorgang und bestätigt den Kauf', async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(inviteUrl);
      await expect(page.getByRole('heading', { name: 'Ihr Fahrzeug ist bereit für die Zulassung.' })).toBeVisible();
      await expect(page.getByText('Skoda Octavia Combi')).toBeVisible();

      await page.getByRole('link', { name: 'Registrieren' }).click();
      await page.getByLabel('Vollständiger Name').fill('Kundin Testfall');
      await page.getByLabel('E-Mail-Adresse').fill(buyerEmail);
      await page.getByLabel('Passwort').fill('Kunden-Passwort-2026');
      await page.getByRole('button', { name: 'Konto erstellen' }).click();

      await expect(page).toHaveURL(/\/einladung\//);
      await page.getByRole('button', { name: 'Vorgang öffnen' }).click();
      await expect(page).toHaveURL(/\/faelle\/[0-9a-f-]{36}$/);
      await expect(page.getByRole('heading', { name: 'Angaben bestätigen' })).toBeVisible();

      await page.getByRole('button', { name: 'Kauf bestätigen' }).click();
      await expect(page.getByText('Bitte bestätigen Sie die Angaben.')).toBeVisible();

      const checkboxes = page.getByRole('checkbox');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await page.getByRole('button', { name: 'Kauf bestätigen' }).click();
      await expect(page.getByText('In Vorbereitung').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible();
      await expect(page.getByText('Prozessbestätigung').first()).toBeVisible();
      caseUrl = page.url();
    } finally {
      await context.close();
    }
  });

  test('Käufer sieht keine internen Prüfungen, der Händler sieht den Fortschritt', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('haendler.lu@demo.autopass.example');
    await page.getByLabel('Passwort').fill('Demo-Passwort-2026');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/haendler$/);
    await page.goto(caseUrl);
    await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible();
    await expect(page.getByText('Offene Prüfungen')).toBeVisible();
    await expect(page.getByText('Operations-Aktionen')).toHaveCount(0);
  });
});
