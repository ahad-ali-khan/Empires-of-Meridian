import {expect, test} from '@playwright/test';
test('a worker receives the clicked tree, reaches it, chops, and shows a timber load', async ({page}) => {
  test.setTimeout(160000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  await page.getByRole('button', {name: 'Guided tutorial'}).click();
  await expect(page.locator('.top-hud').getByText('provisions', {exact: true})).toBeVisible({timeout: 60000});
  const targets = await page.evaluate(() => {
    const i = (window as any).meridianInspect,
      s = i.snapshot(),
      w = s.entities.find((e: any) => e.kind === 'worker' && e.owner === 1);
    const trees = s.entities
      .filter((e: any) => e.kind === 'timber')
      .sort((a: any, b: any) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z));
    const tree =
      trees.find((e: any) => {
        const p = i.project(e.id);
        return p.x > 340 && p.x < 1200 && p.y > 300 && p.y < 660;
      }) ?? trees[0];
    return {worker: {id: w.id, ...i.project(w.id)}, tree: {id: tree.id, ...i.project(tree.id)}};
  });
  await page.mouse.click(targets.worker.x, targets.worker.y);
  await expect(page.locator('.selection-info')).toContainText('Frontier Worker');
  await page.mouse.move(targets.tree.x, targets.tree.y);
  await expect(page.locator('.match-canvas canvas')).toHaveCSS('cursor', /data:image\/svg/);
  await page.mouse.click(targets.tree.x, targets.tree.y, {button: 'right'});
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id).resourceTargetId,
          targets.worker.id,
        ),
      {timeout: 10000},
    )
    .toBe(targets.tree.id);
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => (window as any).meridianInspect.snapshot().entities.find((e: any) => e.id === id).carry.timber ?? 0,
          targets.worker.id,
        ),
      {timeout: 40000},
    )
    .toBeGreaterThan(0);
  await expect(page.locator('.selection-info')).toContainText(/Carrying .* timber/);
  await page.screenshot({path: 'artifacts/worker-tree-order.png'});
  expect(errors).toEqual([]);
});
