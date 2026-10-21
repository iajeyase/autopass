import { expect, test } from '@playwright/test';

test.describe('Öffentlicher Auftritt und Anmeldung', () => {
  test('zeigt die Landingpage mit Kernbotschaft und Einstiegsbuttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auto gekauft. Den Papierkram übernehmen wir.');
    await expect(page.getByRole('link', { name: 'Fahrzeug anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lösung für Autohändler' })).toBeVisible();
    await expect(page.getByText('AutoPass ist keine Zulassungsbehörde.')).toBeVisible();
  });

  test('bricht nicht horizontal aus dem Viewport aus', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('zeigt Formularfehler direkt am Feld', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('keine-adresse');
    await page.getByLabel('Passwort').fill('x');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.')).toBeVisible();
  });

  test('meldet falsche Zugangsdaten neutral', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('unbekannt@example.test');
    await page.getByLabel('Passwort').fill('falsches-passwort');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'E-Mail-Adresse oder Passwort ist nicht korrekt.' })).toBeVisible();
  });

  test('leitet geschützte Seiten ohne Anmeldung zur Anmeldung um', async ({ page }) => {
    await page.goto('/haendler');
    await expect(page).toHaveURL(/\/anmelden$/);
  });

  test('zeigt auf dem Smartphone eine untere Navigation nach der Anmeldung', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Nur für Mobile-Layout');
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('haendler.lu@demo.autopass.example');
    await page.getByLabel('Passwort').fill('Demo-Passwort-2026');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/haendler$/);
    await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
  });
});
