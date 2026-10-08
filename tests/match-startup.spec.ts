import {expect, test} from '@playwright/test';

test('a cold match prepares its first frame before starting the clock', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).startupMessages = [];
    (window as any).startupSnapshotTicks = [];
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        this.addEventListener('message', (event) => {
          if (event.data?.type === 'snapshot' && (window as any).startupSnapshotTicks.length < 5)
            (window as any).startupSnapshotTicks.push(event.data.snapshot.tick);
        });
      }
      postMessage(message: any, transfer?: Transferable[]) {
        (window as any).startupMessages.push(message.type);
        super.postMessage(message, transfer ?? []);
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Skirmish', exact: true}).click();
  await page.getByRole('button', {name: 'Launch match', exact: true}).click();
  await page.waitForFunction(() => (window as any).meridianInspect?.snapshot()?.tick > 20, {timeout: 30000});
  await expect(page.getByRole('heading', {name: 'Preparing battlefield'})).toBeHidden();
  const launch = await page.evaluate(() => ({
    messages: (window as any).startupMessages,
    ticks: (window as any).startupSnapshotTicks,
    metrics: (window as any).meridianInspect.metrics(),
  }));
  expect(launch.messages.slice(0, 3)).toEqual(['create', 'pause', 'resume']);
  expect(launch.ticks[0]).toBe(0);
  expect(launch.metrics.visibleViews).toBeGreaterThan(0);
  expect(launch.metrics.drawCalls).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a failed simulation startup shows recovery and pauses the match instead of playing unseen', async ({page}) => {
  await page.route('**/match.worker.ts?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: "throw new Error('Startup regression: worker unavailable');",
    }),
  );
  await page.goto('/');
  await page.getByRole('button', {name: 'Skirmish', exact: true}).click();
  await page.getByRole('button', {name: 'Launch match', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Match stopped'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Your match clock has been paused.');
  await page.getByRole('button', {name: 'Return to menu'}).click();
  await expect(page.getByRole('button', {name: 'Skirmish', exact: true})).toBeVisible();
});
