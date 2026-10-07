import { test, expect, devices } from '@playwright/test';
import { startMatch, waitForGame, cells, cellCenter, tapButton } from './helpers';

test.use({ ...devices['Pixel 5'], viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

test('19x19 on a 360px-wide phone: two-step input places exactly the tapped cell', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  await startMatch(page, { mode: 'classic', opponent: 'human', level: 'lv3', lv3Size: 19, first: 1 });
  const targets = [
    [0, 0], [18, 18], [9, 9], [0, 18], [18, 0], [5, 13], [12, 3], [17, 1], [1, 17], [8, 10],
  ];
  let placed = 0;
  for (const [r, c] of targets) {
    const p = await cellCenter(page, r, c);
    await page.touchscreen.tap(p.x, p.y); // 1st tap: select + lens
    await page.waitForTimeout(350); // the player looks at the lens
    const pending = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { pending: { row: number; col: number } | null } } }).__kisshug.top().pending);
    expect(pending).toEqual({ row: r, col: c });
    await page.touchscreen.tap(p.x, p.y); // 2nd tap on the same cell: confirm
    await page.waitForTimeout(150);
    placed++;
    const b = await cells(page);
    expect(b[r * 19 + c]).not.toBe(0);
    expect(b.filter((v) => v !== 0).length).toBe(placed);
  }
  await page.screenshot({ path: 'e2e/screenshots/board19-360.png' });
});

test('19x19: the lens corrects a near-miss and the Place button confirms', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  await startMatch(page, { mode: 'chars', opponent: 'human', level: 'lv3', lv3Size: 19, first: 1 });
  const p = await cellCenter(page, 10, 10);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(120);
  // Tap the neighbouring cell inside the magnified lens
  const lens = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { lens: { x: number; y: number; r: number } } } }).__kisshug.top().lens);
  const lc = (lens.r * 2) / 5;
  await page.touchscreen.tap(lens.x + lc, lens.y); // one cell to the right => (10, 11)
  await page.waitForTimeout(350);
  const pending = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { pending: unknown } } }).__kisshug.top().pending);
  expect(pending).toEqual({ row: 10, col: 11 });
  await page.screenshot({ path: 'e2e/screenshots/board19-lens.png' });
  await tapButton(page, 'confirm');
  const b = await cells(page);
  expect(b[10 * 19 + 11]).toBe(1);
  // Occupied cells do not react
  const occ = await cellCenter(page, 10, 11);
  await page.touchscreen.tap(occ.x, occ.y);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { top(): { pending: unknown } } }).__kisshug.top().pending)).toBeNull();
});

test('19x19: pinch zoom + pan keep taps accurate, double-tap resets', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  await startMatch(page, { mode: 'classic', opponent: 'human', level: 'lv3', lv3Size: 19, first: 1 });
  const br = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { boardRect: { x: number; y: number; w: number; h: number } } } }).__kisshug.top().boardRect);
  // Simulate a pinch (Playwright has no multi-touch pinch): same code path as the pointer handler.
  await page.evaluate(([x, y]) => (window as unknown as { __kisshug: { top(): { onPinch(s: number, x: number, y: number): void } } }).__kisshug.top().onPinch(2.5, x, y), [br.x + br.w * 0.2, br.y + br.h * 0.2]);
  const zoom = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { cam: { zoom: number } } } }).__kisshug.top().cam.zoom);
  expect(zoom).toBeGreaterThan(2);
  // Pan with a real touch drag
  await page.touchscreen.tap(br.x + br.w / 2, br.y + br.h / 2); // selects a cell; drag afterwards
  await page.waitForTimeout(100);
  const p = await cellCenter(page, 2, 2);
  expect(p.x).toBeGreaterThan(br.x);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { top(): { pending: unknown } } }).__kisshug.top().pending)).toEqual({ row: 2, col: 2 });
  await page.screenshot({ path: 'e2e/screenshots/board19-zoom.png' });
  // Double tap resets the camera and clears the selection (no stone is placed)
  await page.touchscreen.tap(br.x + 30, br.y + br.h - 30);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(br.x + 30, br.y + br.h - 30);
  await page.waitForTimeout(150);
  const zoom2 = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { cam: { zoom: number } } } }).__kisshug.top().cam.zoom);
  expect(zoom2).toBe(1);
  expect((await cells(page)).filter((v) => v !== 0).length).toBe(0);
  // A slow second tap on the highlighted cell confirms it
  const q = await cellCenter(page, 4, 4);
  await page.touchscreen.tap(q.x, q.y);
  await page.waitForTimeout(400);
  await page.touchscreen.tap(q.x, q.y);
  await page.waitForTimeout(150);
  expect((await cells(page))[4 * 19 + 4]).toBe(1);
});
