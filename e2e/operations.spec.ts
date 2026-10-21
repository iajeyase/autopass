import { expect, test } from '@playwright/test';

test.describe('Operations-Team', () => {
  test('sieht die Warteschlange und kann einen Fall öffnen', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('operator@demo.autopass.example');
    await page.getByLabel('Passwort').fill('Demo-Passwort-2026');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(page.getByText('Demo-Modus aktiv').first()).toBeVisible();

    const firstCase = page.locator('a[href^="/faelle/"]').first();
    await firstCase.click();
    await expect(page.getByRole('heading', { name: 'Operations-Aktionen' })).toBeVisible();
    await expect(page.getByText('Demo-Werkzeuge')).toBeVisible();
  });

  test('simulierte Versicherungsbestätigung ist als Simulation gekennzeichnet', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('operator@demo.autopass.example');
    await page.getByLabel('Passwort').fill('Demo-Passwort-2026');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.locator('a[href^="/faelle/"]').first().click();
    await page.getByRole('button', { name: 'Versicherung: bestätigt' }).click();
    await expect(page.getByText('Simulation (Demo)').first()).toBeVisible();
    await expect(page.getByText('Demo: Übergabe simuliert').or(page.getByText('Übergabe noch nicht möglich'))).toBeVisible();
    await expect(page.getByText('Ihr Fahrzeug kann übergeben werden.')).toHaveCount(0);
  });
});
