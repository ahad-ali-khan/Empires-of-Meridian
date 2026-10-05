import {expect, test} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';

test.use({launchOptions: {args: process.platform === 'darwin' ? ['--use-angle=metal'] : []}});

test('unit orders support Shift queues, attack-move targeting, patrol, guard and stop', async ({page}) => {
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
  state.config.fogOfWar = false;
  const actor = state.entities.find((e) => e.kind === 'explorer')!;
  actor.kind = 'militia';
  actor.model = 'militia';
  actor.range = 0;
  const friend = {
    ...structuredClone(actor),
    id: state.nextEntityId++,
    kind: 'worker',
    model: 'villager',
    x: actor.x + 2000,
    z: actor.z + 2000,
  };
  state.entities.push(friend);
  state.entities = state.entities.filter(
    (e) => e.id === actor.id || e.id === friend.id || Math.max(Math.abs(e.x - actor.x), Math.abs(e.z - actor.z)) > 7000,
  );
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
  const actorPoint = await page.evaluate((id) => (window as any).meridianInspect.project(id), actor.id);
  await page.mouse.click(actorPoint.x, actorPoint.y);
  await expect(page.locator('.selection-info')).toContainText('Militia');
  const points = await page.evaluate(({x, z}) => {
    const inspect = (window as any).meridianInspect;
    return [inspect.projectWorld((x + 4200) / 256, z / 256), inspect.projectWorld((x + 3500) / 256, (z + 2500) / 256)];
  }, actor);
  await page.mouse.click(points[0].x, points[0].y, {button: 'right'});
  await page.keyboard.down('Shift');
  await page.mouse.click(points[1].x, points[1].y, {button: 'right'});
  await page.keyboard.up('Shift');
  await expect(page.locator('.selection-info')).toContainText('1 queued');
  await page.getByRole('button', {name: 'Stop [X]', exact: true}).click();
  await expect(page.locator('.selection-info')).toContainText('0 queued');
  await page.getByRole('button', {name: 'Attack-move [T]', exact: true}).click();
  await page.mouse.click(points[0].x, points[0].y);
  await expect(page.locator('.selection-info')).toContainText('Order: attack-move');
  await page.getByRole('button', {name: 'Patrol [P]', exact: true}).click();
  await page.mouse.click(points[1].x, points[1].y);
  await expect(page.locator('.selection-info')).toContainText('Order: patrol');
  await page.getByRole('button', {name: 'Guard [G]', exact: true}).click();
  const friendPoint = await page.evaluate((id) => (window as any).meridianInspect.project(id), friend.id);
  await page.mouse.click(friendPoint.x, friendPoint.y);
  await expect(page.locator('.selection-info')).toContainText('Order: guard');
  await page.getByRole('button', {name: 'Stop [X]', exact: true}).click();
  await expect(page.locator('.selection-info')).toContainText('Order: idle');
  expect(errors).toEqual([]);
});
