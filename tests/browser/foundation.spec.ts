import { expect, test } from '@playwright/test';

test('local visual foundation launches without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Empires of Meridian');
  await expect(page.locator('#meridian-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
