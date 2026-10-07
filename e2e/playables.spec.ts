import { test, expect } from '@playwright/test';
import { startMatch, waitForGame, cellCenter } from './helpers';

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __ytmock: { calls: string[] } }).__ytmock.calls);

test('SDK mock: firstFrameReady then gameReady within 3s, language follows getLanguage', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/?mock=playables&lang=ja');
  await waitForGame(page);
  const c = await calls(page);
  const ff = c.findIndex((s) => s.startsWith('firstFrameReady'));
  const gr = c.findIndex((s) => s.startsWith('gameReady'));
  expect(ff).toBeGreaterThanOrEqual(0);
  expect(gr).toBeGreaterThan(ff);
  const grTime = Number(c[gr].split('@')[1]);
  expect(grTime).toBeLessThan(3000);
  expect(Date.now() - t0).toBeLessThan(6000);
  const lang = await page.evaluate(() => (window as unknown as { __kisshug: { store: { resolvedLang(): string } } }).__kisshug.store.resolvedLang());
  expect(lang).toBe('ja');
  await page.screenshot({ path: 'e2e/screenshots/playables-title-ja.png' });
});

test('SDK mock: pause stops AI thinking and the ceremony; resume restarts them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mock=playables');
  await waitForGame(page);
  await startMatch(page, { mode: 'chars', opponent: 'ai', level: 'lv3', lv3Size: 15, difficulty: 'hard', first: 1 });
  // Human plays first so the AI has to think (an empty board is answered instantly with the centre).
  const h = await cellCenter(page, 7, 7);
  await page.mouse.click(h.x, h.y);
  await page.waitForTimeout(350);
  await page.mouse.click(h.x, h.y);
  await page.waitForTimeout(60);
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { top(): { aiThinking: boolean } } }).__kisshug.top().aiThinking)).toBe(true);
  await page.evaluate(() => (window as unknown as { __ytmock: { pause(): void } }).__ytmock.pause());
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { app: { paused: boolean }; top(): { aiThinking: boolean } } }).__kisshug.app.paused)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { top(): { aiThinking: boolean } } }).__kisshug.top().aiThinking)).toBe(false);
  await page.waitForTimeout(2200);
  // Still no AI move while paused
  const moves = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { board: { cells: number[] } } } }).__kisshug.top().board.cells.filter((v) => v !== 0).length);
  expect(moves).toBe(1);
  await page.evaluate(() => (window as unknown as { __ytmock: { resume(): void } }).__ytmock.resume());
  await page.waitForFunction(() => (window as unknown as { __kisshug: { top(): { board: { cells: number[] } } } }).__kisshug.top().board.cells.filter((v) => v !== 0).length === 2, null, { timeout: 4000 });

  // Ceremony pause: the result scene's clock must stop.
  await page.evaluate(async () => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    k.go(new m.ResultScene(k.ctx, k.store.match, { status: 'win', winner: 1, line: null }));
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __ytmock: { pause(): void } }).__ytmock.pause());
  const t1 = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { time: number } } }).__kisshug.top().time);
  await page.waitForTimeout(600);
  const t2 = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { time: number } } }).__kisshug.top().time);
  expect(t2).toBe(t1);
  await page.evaluate(() => (window as unknown as { __ytmock: { resume(): void } }).__ytmock.resume());
  await page.waitForTimeout(400);
  const t3 = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { time: number } } }).__kisshug.top().time);
  expect(t3).toBeGreaterThan(t2);
});

test('SDK mock: saveData, audio follow, sendScore on a hard win, interstitial every 3 matches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mock=playables');
  await waitForGame(page);
  await page.evaluate(() => {
    const k = (window as unknown as { __kisshug: { store: { settings: { lv3Size: number }; saveSettings(): Promise<void> } } }).__kisshug;
    k.store.settings.lv3Size = 19;
    return k.store.saveSettings();
  });
  const saved = await page.evaluate(() => (window as unknown as { __ytmock: { saved: string } }).__ytmock.saved);
  const settings = JSON.parse(JSON.parse(saved)['settings.v1']) as { lv3Size: number };
  expect(settings.lv3Size).toBe(19);
  await page.evaluate(() => (window as unknown as { __ytmock: { setAudio(e: boolean): void } }).__ytmock.setAudio(false));
  expect(await page.evaluate(() => (window as unknown as { __kisshug: { ctx: { sfx: { enabled: boolean } } } }).__kisshug.ctx.sfx.enabled)).toBe(false);
  // Hard AI match: force a human win through the scene's finish() and check the score.
  await startMatch(page, { mode: 'chars', opponent: 'ai', level: 'lv1', difficulty: 'hard', first: 1 });
  await page.evaluate(() => {
    const k = (window as unknown as { __kisshug: { store: { stats: { matches: number } }; top(): { finish(r: unknown): void } } }).__kisshug;
    k.store.stats.matches = 2;
    k.top().finish({ status: 'win', winner: 1, line: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] });
  });
  await page.waitForTimeout(100);
  let c = await calls(page);
  expect(c.some((s) => s.startsWith('sendScore:1'))).toBe(true);
  await page.waitForFunction(() => (window as unknown as { __kisshug: { scene(): string } }).__kisshug.scene() === 'Result', null, { timeout: 5000 });
  await page.evaluate(() => (window as unknown as { __kisshug: { top(): { leave(h: string): Promise<void> } } }).__kisshug.top().leave('again'));
  await page.waitForTimeout(600);
  c = await calls(page);
  expect(c.some((s) => s.startsWith('interstitial'))).toBe(true);
  const p = await cellCenter(page, 1, 1);
  expect(p.x).toBeGreaterThan(0);
});
