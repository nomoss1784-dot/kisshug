import { test, expect } from '@playwright/test';
import { startMatch, waitForGame, cells, cellCenter, scene } from './helpers';

test('hard AI on 15x15 answers within 1.5s + overhead and never blocks rendering', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForGame(page);
  await startMatch(page, { mode: 'chars', opponent: 'ai', level: 'lv3', lv3Size: 15, difficulty: 'hard', first: 1 });
  // Human plays the centre via the two-step UI.
  const p = await cellCenter(page, 7, 7);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(350);
  await page.mouse.click(p.x, p.y);
  const t0 = Date.now();
  // Count animation frames while the AI thinks.
  const frames = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const start = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(frames).toBeGreaterThan(30); // ~60fps expected; a blocked main thread would give ~1
  await page.waitForFunction(() => (window as unknown as { __kisshug: { top(): { board: { cells: number[] } } } }).__kisshug.top().board.cells.filter((v) => v === 2).length === 1, null, { timeout: 4000 });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(2600);
  const b = await cells(page);
  expect(b.filter((v) => v !== 0).length).toBe(2);
  console.log(`AI replied in ${elapsed} ms, ${frames} frames rendered during the first second`);
});

test('3x3 vs hard AI plays to the end and reaches the result ceremony', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForGame(page);
  await startMatch(page, { mode: 'classic', opponent: 'ai', level: 'lv1', difficulty: 'hard', first: 1 });
  for (let i = 0; i < 5; i++) {
    const b = await cells(page);
    const empty = b.map((v, idx) => (v === 0 ? idx : -1)).filter((v) => v >= 0);
    if (empty.length === 0) break;
    const st = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { phase: string } } }).__kisshug.top().phase);
    if (st !== 'play') break;
    const idx = empty[0];
    const p = await cellCenter(page, Math.floor(idx / 3), idx % 3);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(1400);
  }
  await page.waitForFunction(() => (window as unknown as { __kisshug: { scene(): string } }).__kisshug.scene() === 'Result', null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/result-ceremony.png' });
  expect(await scene(page)).toBe('Result');
});
