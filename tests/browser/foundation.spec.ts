import { expect, test } from '@playwright/test';

test('local visual foundation launches without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Empires of Meridian');
  await expect(page.locator('#meridian-canvas')).toBeVisible();
  await expect(page.locator('.brand')).toContainText('MERIDIAN');
  await expect(page.locator('[data-backend]')).toBeVisible();
  await expect(page.locator('.minimap-card')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'wide', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1080 },
]) {
  test(`HUD remains readable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.command-desk')).toBeVisible();
    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noHorizontalOverflow).toBe(true);
  });
}

test('asset preview route loads the local manifest and scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/asset-preview.html');
  await expect(page).toHaveTitle('Meridian Asset Preview');
  await expect(page.locator('[data-asset-list] li')).toHaveCount(13);
  await expect(page.locator('#preview-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
