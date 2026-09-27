import {expect, test} from '@playwright/test';

test('offline tutorial launches, renders HUD, pauses and resumes', async ({page}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Empires of Meridian'})).toBeVisible();
  await page.getByRole('button', {name: 'Guided tutorial'}).click();
  await expect(page.getByText('FIELD INSTRUCTION')).toBeVisible({timeout: 15_000});
  await expect(page.locator('.top-hud').getByText('provisions', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Pause'}).click();
  await expect(page.getByRole('heading', {name: 'Match paused'})).toBeVisible();
  await page.getByRole('button', {name: 'Resume'}).click();
  await expect(page.getByRole('heading', {name: 'Match paused'})).toBeHidden();
  expect(errors).toEqual([]);
});

test('asset forge remains available at its developer route', async ({page}) => {
  await page.goto('/dev/forge');
  await expect(page.getByText('ASSET FORGE')).toBeVisible({timeout: 15_000});
});
