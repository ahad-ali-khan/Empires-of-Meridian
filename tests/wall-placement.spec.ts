import {test, expect} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';
test('wall placement draws connected segments and a selected wall converts to a gate', async ({page}) => {
  test.setTimeout(180000);
  const s = createMatch({
    v: 1,
    seed: 73,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 100,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  s.players[0].age = 2;
  s.players[0].resources.timber = 100000;
  s.players[0].resources.metal = 100000;
  s.entities = s.entities.filter((e) => e.owner === 1 && (e.kind === 'hall' || e.kind === 'worker'));
  const hall = s.entities.find((e) => e.kind === 'hall')!;
  hall.x = 40 * 256;
  hall.z = 60 * 256;
  const workers = s.entities.filter((e) => e.kind === 'worker');
  workers.forEach((w, i) => {
    w.x = (39 + i * 2) * 256;
    w.z = 66 * 256;
  });
  await page.setViewportSize({width: 1440, height: 900});
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(async (save) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('meridian-saves', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('matches');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('matches', 'readwrite');
      tx.objectStore('matches').put(save, 'autosave');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, serializeSave(s));
  await page.reload();
  await page.getByRole('button', {name: 'Continue autosave'}).click();
  await expect(page.locator('.top-hud')).toBeVisible({timeout: 60000});
  await expect
    .poll(() => page.evaluate((id) => (window as any).meridianInspect?.project(id), workers[0].id), {timeout: 30000})
    .toBeTruthy();
  const worker = await page.evaluate((id) => (window as any).meridianInspect.project(id), workers[0].id);
  await page.mouse.click(worker.x, worker.y);
  await page.getByRole('button', {name: /^Wall /}).click();
  const points = await page.evaluate(() =>
    [
      [50, 59],
      [60, 59],
    ].map(([x, z]) => (window as any).meridianInspect.projectWorld(x, z)),
  );
  for (const p of points) await page.mouse.click(p.x, p.y);
  await page.mouse.click(points[1].x, points[1].y, {button: 'right'});
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).meridianInspect.snapshot().entities.filter((e: any) => e.kind === 'wall').length,
      ),
    )
    .toBe(2);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).meridianInspect
            .snapshot()
            .entities.filter((e: any) => e.kind === 'wall')
            .every((e: any) => e.progress === 10000),
        ),
      {timeout: 60000},
    )
    .toBe(true);
  const wall = await page.evaluate(() => {
    const api = (window as any).meridianInspect;
    const e = api.snapshot().entities.find((e: any) => e.kind === 'wall');
    return {id: e.id, ...api.project(e.id)};
  });
  await page.mouse.click(wall.x, wall.y);
  await page.getByRole('button', {name: /Convert to gate/}).click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id)?.kind,
        wall.id,
      ),
    )
    .toBe('gate');
  await page.screenshot({path: 'artifacts/wall-chain-gate.png'});
  expect(errors).toEqual([]);
});
