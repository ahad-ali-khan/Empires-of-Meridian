import {expect, test, type Page} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';

async function controlledMatch(page: Page) {
  const state = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    aiCount: 0,
    populationCap: 100,
    gameSpeed: 1,
    fogOfWar: false,
  });
  const hall = state.entities.find((e) => e.kind === 'hall')!,
    worker = state.entities.find((e) => e.kind === 'worker')!,
    sheep = state.entities.find((e) => e.kind === 'sheep')!,
    bush = state.entities.find((e) => e.kind === 'provisions')!;
  worker.x = hall.x - 3 * 256;
  worker.z = hall.z - 3 * 256;
  sheep.owner = 1;
  sheep.x = hall.x + 10 * 256;
  sheep.z = hall.z + 2 * 256;
  sheep.followId = undefined;
  bush.x = hall.x + 8 * 256;
  bush.z = hall.z + 6 * 256;
  state.entities = [hall, worker, sheep, bush];
  await page.goto('/');
  await page.evaluate(async (save) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('meridian-saves', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('matches');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('matches', 'readwrite');
      transaction.objectStore('matches').put(save, 'autosave');
      transaction.oncomplete = () => resolve();
    });
    db.close();
  }, serializeSave(state));
  await page.getByRole('button', {name: 'Credits', exact: true}).click();
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  await page.getByRole('button', {name: 'Continue autosave'}).click();
  await expect(page.locator('.top-hud').getByText('provisions', {exact: true})).toBeVisible({timeout: 60000});
  await page.waitForFunction(() => !!(window as any).meridianInspect?.project(1));
  const point = (id: number) => page.evaluate((entityId) => (window as any).meridianInspect.project(entityId), id);
  return {state, hall, worker, sheep, bush, point};
}

test('owned sheep receive contextual move orders over resources and plain ground', async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize({width: 1440, height: 900});
  const {sheep, bush, point} = await controlledMatch(page);
  const sheepPoint = await point(sheep.id),
    target = await point(bush.id);
  await page.mouse.click(sheepPoint.x, sheepPoint.y);
  await expect(page.locator('.selection-info')).toContainText(/sheep/i);
  const before = await page.evaluate(() => (window as any).meridianInspect.snapshot().tick);
  await page.mouse.click(target.x, target.y, {button: 'right'});
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id).lastOrder ?? -1,
        sheep.id,
      ),
    )
    .toBeGreaterThan(before);
});

test('selection box intent survives returning to its origin and orbiting preserves selection', async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize({width: 1440, height: 900});
  const {worker, point} = await controlledMatch(page);
  const p = await point(worker.id);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.selection-info')).toContainText('Frontier Worker');
  const start = {x: 800, y: 280};
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y + 70, {steps: 5});
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.mouse.move(start.x + 3, start.y + 3, {steps: 5});
  await page.mouse.up();
  // A completed empty drag clears selection; it must not select an incidental entity as a click.
  await expect(page.locator('.selection-info')).toContainText('Select your settlement');
  await page.mouse.click(p.x, p.y);
  const before = await page.evaluate(() => (window as any).meridianInspect.camera());
  await page.keyboard.down('Alt');
  await page.mouse.move(870, 360);
  await page.mouse.down();
  await page.mouse.move(1010, 405, {steps: 8});
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect(page.locator('.selection-info')).toContainText('Frontier Worker');
  const after = await page.evaluate(() => (window as any).meridianInspect.camera());
  expect(after.position).not.toEqual(before.position);
  await expect(page.locator('.selection-marquee')).toBeHidden();
});
