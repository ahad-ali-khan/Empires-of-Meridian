import {expect, test} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';

test.use({launchOptions: {args: process.platform === 'darwin' ? ['--use-angle=metal'] : []}});

test('building research and production controls show queues and accurate cancellation refunds', async ({page}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
  });
  state.players[0].tokens = 5;
  state.players[0].resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  const save = serializeSave(state);
  await page.goto('/');
  await page.evaluate(async (envelope) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('meridian-saves', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('matches');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('matches', 'readwrite');
      transaction.objectStore('matches').put(envelope, 'autosave');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, save);
  await page.getByRole('button', {name: 'Credits', exact: true}).click();
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  await page.getByRole('button', {name: 'Continue autosave'}).click();
  await expect(page.locator('.top-hud')).toBeVisible({timeout: 60000});
  await page.waitForFunction(() => !!(window as any).meridianInspect?.snapshot());
  const hall = await page.evaluate(() => {
    const inspect = (window as any).meridianInspect;
    const hall = inspect.snapshot().entities.find((e: any) => e.owner === 1 && e.kind === 'hall');
    return {id: hall.id, ...inspect.project(hall.id)};
  });
  await page.mouse.click(hall.x, hall.y);
  await expect(page.locator('.selection-info')).toContainText('Charter Hall');
  await page.getByRole('button', {name: /Frontier Worker/}).click();
  await page.getByRole('button', {name: /Research Improved Tools/}).click();
  await expect(page.locator('.production-list > div')).toHaveCount(2);
  await expect(page.locator('.building-world-label').filter({hasText: 'Improved Tools'})).toBeVisible();
  await expect(page.getByRole('button', {name: /Research Improved Tools/})).toBeDisabled();
  await page.getByRole('button', {name: 'Cancel · 100% refund'}).click();
  await expect(page.locator('.production-list > div')).toHaveCount(1);
  await expect(page.getByRole('button', {name: /Research Improved Tools/})).toBeEnabled();
  await page.getByRole('button', {name: 'Cancel · 50% refund'}).click();
  await expect(page.locator('.production-list')).toHaveCount(0);
  await page.getByRole('button', {name: /Research Improved Tools/}).click();
  await expect(page.locator('.production-list')).toContainText('Improved Tools');
  await expect(page.getByRole('button', {name: /Research Carrying Packs/})).toBeDisabled();
  expect(errors).toEqual([]);
});
