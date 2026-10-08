import { test, expect } from '@playwright/test';
import { startMatch, waitForGame, buttonRect, scene } from './helpers';

/** Screenshots embedded in REPORT.md (SPEC §10 / 完了条件). */
const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'pc', width: 1280, height: 720 },
  { name: 'square', width: 800, height: 800 },
];

for (const vp of VIEWPORTS) {
  test(`report shot: match at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await waitForGame(page);
    await startMatch(page, { mode: 'chars', opponent: 'human', level: 'lv1', animals: ['cat', 'dog'], first: 1 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/screenshots/match-${vp.name}.png` });
  });
}

const CEREMONIES: Array<{ kind: 'kiss' | 'hug' | 'shake'; at: number; actor: string; target: string; reward: 'kiss' | 'hug'; status: 'win' | 'draw' }> = [
  { kind: 'kiss', at: 1500, actor: 'cat', target: 'rabbit', reward: 'kiss', status: 'win' },
  { kind: 'hug', at: 1250, actor: 'bear', target: 'dog', reward: 'hug', status: 'win' },
  { kind: 'shake', at: 900, actor: 'dog', target: 'rabbit', reward: 'hug', status: 'draw' },
];

for (const c of CEREMONIES) {
  test(`report shot: ${c.kind} ceremony`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForGame(page);
    await page.evaluate(async (c) => {
      const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
      const m = await k.scenes();
      const d = m.createDraft('chars', 'ai');
      d.players[0].animal = c.actor;
      d.players[0].reward = c.reward;
      const cfg = m.finalize(d, k.store);
      cfg.players[1].animal = c.target;
      cfg.players[1].hueShift = 0;
      k.store.match = cfg;
      k.go(new m.ResultScene(k.ctx, cfg, { status: c.status, winner: c.status === 'win' ? 1 : null, line: null }));
    }, c);
    await page.waitForTimeout(c.at);
    await page.screenshot({ path: `docs/screenshots/ceremony-${c.kind}.png` });
    expect(await scene(page)).toBe('Result');
  });
}

test('report shot: classic board with X/O marks and forehead badges', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForGame(page);
  // Side select via the real UI
  await page.mouse.click(195, 500);
  await page.waitForTimeout(300);
  const classic = await buttonRect(page, 'mode-classic');
  await page.mouse.click(classic!.x + classic!.w / 2, classic!.y + classic!.h / 2);
  await page.waitForTimeout(400); // > double-tap window
  const ai = await buttonRect(page, 'opp-ai');
  await page.mouse.click(ai!.x + ai!.w / 2, ai!.y + ai!.h / 2);
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('SideSelect');
  await page.screenshot({ path: 'docs/screenshots/classic-side-select.png' });
  const x = await buttonRect(page, 'side-x');
  await page.mouse.click(x!.x + x!.w / 2, x!.y + x!.h / 2);
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('CharSelect');
  // Board: play a few moves in a 2P classic match
  await startMatch(page, { mode: 'classic', opponent: 'human', level: 'lv1', first: 1 });
  const cfgMarks = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { cfg: { players: Array<{ mark: string }> } } } }).__kisshug.top().cfg.players.map((p) => p.mark));
  expect(cfgMarks).toEqual(['o', 'x']);
  const play = async (r: number, c: number) => {
    const p = await page.evaluate(([r, c]) => (window as unknown as { __kisshug: { top(): { cellCenter(m: { row: number; col: number }): { x: number; y: number } } } }).__kisshug.top().cellCenter({ row: r, col: c }), [r, c]);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
  };
  await play(0, 0); await play(1, 0); await play(0, 1); await play(1, 1); await play(0, 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/classic-win-line.png' });
  const line = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { result: { line: unknown[] | null } } } }).__kisshug.top().result.line);
  expect(line?.length).toBe(3);
  await page.waitForFunction(() => (window as unknown as { __kisshug: { scene(): string } }).__kisshug.scene() === 'Result', null, { timeout: 5000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/classic-ceremony-badges.png' });
});
