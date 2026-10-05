import {expect, test, type Page} from '@playwright/test';
import {buildingById} from '../packages/content/src/index';
import {perimeterPoint} from '../packages/sim/src/spatial';
import {createMatch, serializeSave} from '../packages/sim/src/index';

test.use({launchOptions: {args: process.platform === 'darwin' ? ['--use-angle=metal'] : []}});

async function openMatch(page: Page, save: ReturnType<typeof serializeSave>) {
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
  const click = async (id: number, button: 'left' | 'right' = 'left') => {
    const p = await page.evaluate((entityId) => (window as any).meridianInspect.project(entityId), id);
    await page.mouse.click(p.x, p.y, {button});
  };
  return click;
}

test('market exchange controls and explorer treasure collection run through the live worker', async ({page}) => {
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
    fogOfWar: false,
  });
  state.players[0].age = 2;
  state.players[0].resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  const market = state.entities.find((e) => e.kind === 'house')!;
  const definition = buildingById.get('market')!;
  Object.assign(market, {kind: 'market', model: definition.model, hp: definition.hp, maxHp: definition.hp});
  const explorer = state.entities.find((e) => e.kind === 'explorer')!;
  const treasure = state.entities.find((e) => e.treasureId === 'pioneer-cache')!;
  // Keep a small, peaceful fixture; the worker still owns all runtime state.
  state.entities = state.entities.filter((e) => !e.guardOf);
  const click = await openMatch(page, serializeSave(state));
  await click(market.id);
  await expect(page.getByRole('button', {name: /Buy 100 timber/})).toBeVisible();
  await page.getByRole('button', {name: /Buy 100 timber/}).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).meridianInspect.snapshot().players[0].stats.exchanges))
    .toBe(1);
  await page.getByRole('button', {name: /Sell 100 timber/}).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).meridianInspect.snapshot().players[0].stats.exchanges))
    .toBe(2);
  await click(explorer.id);
  await click(treasure.id, 'right');
  await expect
    .poll(() => page.evaluate(() => (window as any).meridianInspect.snapshot().players[0].stats.treasures), {
      timeout: 20000,
    })
    .toBe(1);
  expect(errors).toEqual([]);
});

test('site capture exposes income controls and paid explorer return restores a downed model', async ({page}) => {
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
    fogOfWar: false,
  });
  state.players[0].resources.coin = 100000;
  state.entities = state.entities.filter((e) => !e.guardOf);
  const explorer = state.entities.find((e) => e.kind === 'explorer')!;
  Object.assign(explorer, {hp: 0, incapacitatedAt: 0, deathTick: 0, task: 'dead'});
  const site = state.entities.find((e) => e.kind === 'house')!;
  const definition = buildingById.get('tradePost')!;
  Object.assign(site, {
    owner: 0,
    kind: 'tradePost',
    model: definition.model,
    hp: definition.hp,
    maxHp: definition.hp,
    tradeSite: true,
    siteIncome: 'coin',
    captureOwner: 1,
    captureProgress: 195,
  });
  const worker = state.entities.find((e) => e.kind === 'worker')!;
  const point = perimeterPoint(site, worker.id % 8, 180);
  worker.x = point.x;
  worker.z = point.z;
  const click = await openMatch(page, serializeSave(state));
  await click(explorer.id);
  await expect(page.getByRole('button', {name: /Return explorer/})).toBeVisible();
  await page.getByRole('button', {name: /Return explorer/}).click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id)?.hp,
        explorer.id,
      ),
    )
    .toBeGreaterThan(0);
  await click(worker.id);
  await click(site.id, 'right');
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id)?.owner,
          site.id,
        ),
      {timeout: 20000},
    )
    .toBe(1);
  await click(site.id);
  await page.getByRole('button', {name: /Route income: metal/}).click();
  await expect(page.getByRole('button', {name: /Route income: metal/})).toBeDisabled();
  expect(errors).toEqual([]);
});
