import {expect, test} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';

test.use({launchOptions: {args: process.platform === 'darwin' ? ['--use-angle=metal'] : []}});

test('Dispatch charter exposes real contents, transit and refundable cancellation', async ({page}) => {
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
  await page.getByText('Dispatch charter · 5 tokens').click();
  const charter = page.locator('.dispatch-panel');
  await expect(charter.getByRole('button')).toHaveCount(24);
  const workers = charter.getByRole('button', {name: /Worker Party · 1 tokens/});
  await expect(workers).toContainText('2 Frontier Worker');
  await workers.click();
  await expect(charter.locator('.dispatch-transit')).toContainText('Worker Party');
  await charter.getByRole('button', {name: 'Cancel · refund 1 tokens'}).click();
  await expect(charter.locator('.dispatch-transit')).toHaveCount(0);
  await expect(charter.locator('summary')).toContainText('5 tokens');
  expect(errors).toEqual([]);
});
