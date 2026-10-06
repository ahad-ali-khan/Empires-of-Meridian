import {expect, test, type Page} from '@playwright/test';
import {createMatch, serializeSave, placementReason} from '../packages/sim/src/index';
import {unitById} from '../packages/content/src/index';
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

test('group attack orders keep the live simulation advancing', async ({page}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  const template = structuredClone(s.entities.find((e) => e.kind === 'worker')!);
  const d = unitById.get('militia')!;
  s.entities = s.entities.filter((e) => e.kind === 'hall');
  const army = Array.from({length: 24}, (_, i) => ({
    ...structuredClone(template),
    id: s.nextEntityId++,
    kind: 'militia',
    model: d.model,
    damage: d.damage,
    hp: d.hp,
    maxHp: d.hp,
    speed: d.speed,
    range: d.range,
    stance: 'no-attack' as const,
    x: template.x - 2300 + (i % 6) * 450,
    z: template.z + 1300 + Math.floor(i / 6) * 400,
  }));
  const target = {
    ...structuredClone(army[0]),
    id: s.nextEntityId++,
    owner: 0 as const,
    guardOf: 999999,
    x: template.x + 2800,
    z: template.z - 1800,
    hp: 100000,
    maxHp: 100000,
  };
  s.entities.push(...army, target);
  const click = await openMatch(page, serializeSave(s));
  const point = await page.evaluate((id) => (window as any).meridianInspect.project(id), army[0].id);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('.selection-info')).toContainText('24');
  const before = await page.evaluate(() => (window as any).meridianInspect.snapshot().tick);
  const frameBefore = await page.locator('.match-canvas canvas').screenshot();
  await click(target.id, 'right');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).meridianInspect.snapshot().entities.filter((e: any) => e.owner === 1 && e.task === 'attack')
            .length,
      ),
    )
    .toBe(24);
  await expect
    .poll(() => page.evaluate(() => (window as any).meridianInspect.snapshot().tick), {timeout: 10000})
    .toBeGreaterThan(before + 40);
  const frameAfter = await page.locator('.match-canvas canvas').screenshot();
  expect(frameAfter.equals(frameBefore), 'rendered battlefield must keep updating while simulation advances').toBe(
    false,
  );
  expect(errors).toEqual([]);
});

test('Shift placement repeats reserved blueprints and selected construction can be cancelled', async ({page}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  const worker = s.entities.find((e) => e.kind === 'worker')!,
    hall = s.entities.find((e) => e.kind === 'hall')!;
  s.entities = [worker, hall];
  s.players[0].resources.timber = 100000;
  const candidates: {x: number; z: number}[] = [];
  for (let z = -20; z <= 20; z += 10)
    for (let x = -20; x <= 20; x += 10) {
      const p = {x: hall.x + x * 256, z: hall.z + z * 256};
      if (!placementReason(s, 'house', p.x, p.z)) candidates.push(p);
    }
  const click = await openMatch(page, serializeSave(s));
  const points = await page.evaluate((options) => {
    const inspect = (window as any).meridianInspect;
    return options
      .map((p) => ({...p, screen: inspect.projectWorld(p.x / 256, p.z / 256)}))
      .filter(
        (p) => p.screen.x > 60 && p.screen.x < innerWidth - 340 && p.screen.y > 180 && p.screen.y < innerHeight - 230,
      );
  }, candidates);
  expect(points.length).toBeGreaterThanOrEqual(3);
  await click(worker.id);
  await page.mouse.click(points[0].screen.x, points[0].screen.y, {button: 'right'});
  await page.getByRole('button', {name: /Harbor Residence/}).click();
  await page.keyboard.press('KeyE');
  await page.keyboard.down('Shift');
  await page.mouse.move(points[1].screen.x, points[1].screen.y);
  await page.screenshot({path: 'test-results/queued-blueprint-preview.png'});
  await page.mouse.click(points[1].screen.x, points[1].screen.y);
  await page.mouse.click(points[2].screen.x, points[2].screen.y);
  await page.keyboard.up('Shift');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).meridianInspect.snapshot().entities.filter((e: any) => e.kind === 'house').length,
      ),
    )
    .toBe(2);
  await expect(page.locator('.selection-info')).toContainText('2 queued');
  const plan = await page.evaluate(() =>
    (window as any).meridianInspect
      .snapshot()
      .entities.filter((e: any) => e.kind === 'house')
      .at(-1),
  );
  expect(plan.rotation).toBe(1);
  await page.mouse.click(points[2].screen.x, points[2].screen.y, {button: 'right'});
  await click(plan.id);
  await page.getByRole('button', {name: /Cancel construction/}).click();
  await expect
    .poll(() =>
      page.evaluate((id) => (window as any).meridianInspect.snapshot().entities.some((e: any) => e.id === id), plan.id),
    )
    .toBe(false);
  expect(errors).toEqual([]);
});
