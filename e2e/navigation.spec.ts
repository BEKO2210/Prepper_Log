import { test, expect } from '@playwright/test';

test('rapid navigation across lazy pages never blanks', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('preptrack-language', 'de'); } catch { /* */ }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button').first().click();
    await expect(dialog).toBeHidden();
  }

  // Visit each lazy page (Statistik, Einstellungen) and the eager ones, twice,
  // asserting content actually renders (not a blank <main>).
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Statistik' }).first().click();
    await expect(page.getByRole('heading', { name: 'Statistiken' })).toBeVisible();

    await page.getByRole('button', { name: 'Einstellungen' }).first().click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

    await page.getByRole('button', { name: 'Vorräte' }).first().click();
    await expect(page.getByRole('heading', { name: 'Vorräte' })).toBeVisible();

    await page.getByRole('button', { name: 'Dashboard' }).first().click();
    await expect(page.getByRole('heading', { name: 'PrepTrack', exact: true })).toBeVisible();
  }

  // Rapid-fire switching without waiting between clicks must not deadlock the
  // transition and leave a blank page (regression guard for the bottom-nav bug).
  for (const name of ['Statistik', 'Einstellungen', 'Vorräte', 'Statistik', 'Dashboard', 'Einstellungen']) {
    await page.getByRole('button', { name }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
});
