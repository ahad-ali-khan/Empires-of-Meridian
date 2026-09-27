import {expect, test} from '@playwright/test';
import type {MatchSnapshot} from '../packages/sim/src/index';

test('select a hall, train a worker, set a rally and orbit without changing selection', async ({page}) => {
  test.setTimeout(150000);
  await page.setViewportSize({width: 1440, height: 900});
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Guided tutorial'}).click();
  await expect(page.locator('.top-hud').getByText('provisions', {exact: true})).toBeVisible({timeout: 60000});
  const hall = await page.evaluate(() => {
    const inspect = (window as any).meridianInspect;
    const s = inspect.snapshot() as MatchSnapshot;
    const hall = s.entities.find((e) => e.owner === 1 && e.kind === 'hall')!;
    return {id: hall.id, ...inspect.project(hall.id)};
  });
  await page.mouse.click(hall.x, hall.y);
  await expect(page.locator('.selection-info')).toContainText('Charter Hall');
  await page.getByRole('button', {name: /Frontier Worker/}).click();
  await page.getByRole('button', {name: /Frontier Worker/}).click();
  await expect(page.locator('.production-list > div')).toHaveCount(2);
  await expect(page.locator('.building-world-label').filter({hasText: 'Frontier Worker'})).toBeVisible();
  await expect(page.locator('.production-list')).toContainText('Frontier Worker');
  const map = await page.locator('.tactical-map canvas').boundingBox();
  expect(map).toBeTruthy();
  await page.mouse.click(map!.x + map!.width * 0.7, map!.y + map!.height * 0.72, {button: 'right'});
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id)?.rally,
        hall.id,
      ),
    )
    .toBeTruthy();
  const before = await page.evaluate(() => (window as any).meridianInspect.camera().position);
  await page.mouse.move(990, 240);
  await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(1160, 290, {steps: 5});
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const after = await page.evaluate(() => (window as any).meridianInspect.camera().position);
  expect(after).not.toEqual(before);
  await expect(page.locator('.selection-info')).toContainText('Charter Hall');
  await page.screenshot({path: 'artifacts/queues-rally-and-fog.png'});
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as any).meridianInspect.snapshot().entities.filter((e: any) => e.owner === 1 && e.kind === 'worker')
              .length,
        ),
      {timeout: 30000},
    )
    .toBeGreaterThan(4);
  console.log('Render capture:', await page.evaluate(() => (window as any).meridianInspect.metrics()));
  expect(errors).toEqual([]);
});
