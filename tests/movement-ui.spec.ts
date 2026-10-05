import {expect, test, type Page} from '@playwright/test';
import {createMatch, serializeSave} from '../packages/sim/src/index';
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
  expect(errors).toEqual([]);
});
