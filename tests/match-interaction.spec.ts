import {expect, test} from '@playwright/test';

test('battlefield supports box selection, zoom and camera panning', async ({page}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  await page.getByRole('button', {name: 'Guided tutorial'}).click();
  await expect(page.locator('.top-hud').getByText('provisions', {exact: true})).toBeVisible({timeout: 45000});
  const canvas = page.locator('.match-canvas canvas');
  await expect(canvas).toBeVisible();
  await page.mouse.move(380, 250);
  await page.mouse.down();
  await page.mouse.move(1150, 640, {steps: 12});
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.selection-info')).toContainText('selected');
  await page.mouse.move(820, 430);
  await page.mouse.wheel(0, -250);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  await page.screenshot({path: 'artifacts/match-rebuild.png'});
  expect(errors).toEqual([]);
});
