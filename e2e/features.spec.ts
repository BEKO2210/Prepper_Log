import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('preptrack-language', 'de'); } catch { /* */ }
  });
});

test('web share target prefills the add form with the shared text', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('preptrack-onboarded', 'true'); } catch { /* */ }
  });
  await page.goto('/?text=' + encodeURIComponent('Geteilte Dose'));
  await page.waitForLoadState('networkidle');
  await expect(page.getByPlaceholder('z.B. Dosentomaten')).toHaveValue('Geteilte Dose');
});

test('consuming the whole stock archives the product', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible().catch(() => false)) {
    await dlg.getByRole('button').first().click();
    await expect(dlg).toBeHidden();
  }

  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  const name = `Verbrauch ${Date.now()}`;
  await page.getByPlaceholder('z.B. Dosentomaten').fill(name);
  await page.locator('input[type="date"]').fill('2031-12-31');
  await page.getByRole('button', { name: 'Produkt speichern' }).click();

  await page.getByRole('button', { name: 'Vorräte' }).first().click();
  await expect(page.locator('main').getByText(name)).toBeVisible();

  await page.getByRole('button', { name: 'Verbraucht' }).first().click();
  await page.getByRole('button', { name: /entnehmen/ }).click();

  // Consuming everything moves it to the archive -> gone from the active list.
  // Scope to <main> so the (name-containing) undo toast doesn't match.
  await expect(page.locator('main').getByText(name)).toHaveCount(0);
});

test('deleting a product can be undone via the toast', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible().catch(() => false)) {
    await dlg.getByRole('button').first().click();
    await expect(dlg).toBeHidden();
  }

  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  const name = `Undo ${Date.now()}`;
  await page.getByPlaceholder('z.B. Dosentomaten').fill(name);
  await page.locator('input[type="date"]').fill('2031-12-31');
  await page.getByRole('button', { name: 'Produkt speichern' }).click();
  await page.getByRole('button', { name: 'Vorräte' }).first().click();

  // Delete via the card trash button -> inline confirm -> confirm.
  await page.getByRole('button', { name: 'Löschen' }).first().click();
  await page.locator('.bg-red-500\\/10').getByRole('button').first().click();
  await expect(page.locator('main').getByText(name)).toHaveCount(0);

  // Undo from the toast restores the product.
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.locator('main').getByText(name)).toBeVisible();
});
