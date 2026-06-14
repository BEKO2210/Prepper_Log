import { test, expect } from '@playwright/test';

// Pin the language so assertions are deterministic regardless of the CI
// browser's navigator locale.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('preptrack-language', 'de');
    } catch {
      /* ignore */
    }
  });
});

test('onboarding appears on first launch and can be dismissed', async ({ page }) => {
  await page.goto('/');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The onboarding modal has a single primary action.
  await dialog.getByRole('button').click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('heading', { name: 'PrepTrack', exact: true })).toBeVisible();
});

test('a product can be added and shows up in the list', async ({ page }) => {
  await page.goto('/');

  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button').click();
    await expect(dialog).toBeHidden();
  }

  // Open the add form (empty-state CTA / bottom-nav both labelled "Hinzufügen").
  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();

  const name = `E2E Testdose ${Date.now()}`;
  await page.getByPlaceholder('z.B. Dosentomaten').fill(name);
  await page.locator('input[type="date"]').fill('2031-12-31');
  await page.getByRole('button', { name: 'Produkt speichern' }).click();

  // After saving we land on the product list and the new product is visible.
  await expect(page.getByText(name)).toBeVisible();
});

test('swiping a product card left reveals the delete confirmation', async ({ page }) => {
  // Skip onboarding/changelog so they can't intercept the gesture.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('preptrack-onboarded', 'true');
      localStorage.setItem('preptrack-last-seen-version', '2.0.4');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  const name = `Swipe ${Date.now()}`;
  await page.getByPlaceholder('z.B. Dosentomaten').fill(name);
  await page.locator('input[type="date"]').fill('2031-12-31');
  await page.getByRole('button', { name: 'Produkt speichern' }).click();

  // Ensure we are on the product list (robust against a service-worker reload).
  await page.getByRole('button', { name: 'Vorräte' }).first().click();
  const card = page.getByText(name);
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  if (!box) throw new Error('card not found');

  // Swipe left past the delete threshold.
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 30, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, cy, { steps: 18 });
  await page.mouse.up();

  await expect(page.getByText(/Wirklich löschen/)).toBeVisible({ timeout: 4000 });
});
