import { test, expect } from '@playwright/test';
import { waitForGame, trackExternal, scene } from './helpers';
// @ts-expect-error plain JS helper without types
import { Canvas, hex } from '../scripts/png.mjs';

test('initial load is under 5MB and never talks to another host', async ({ page, baseURL }) => {
  const rec = trackExternal(page, baseURL!);
  let bytes = 0;
  page.on('response', async (res) => {
    try {
      bytes += (await res.body()).length;
    } catch {
      /* ignore */
    }
  });
  await page.goto('/');
  await waitForGame(page);
  await page.waitForTimeout(1000);
  expect(rec.external).toEqual([]);
  expect(bytes).toBeLessThan(5 * 1024 * 1024);
  console.log(`initial load: ${(bytes / 1024).toFixed(0)} KB over ${rec.all.length} requests`);
});

test('a full photo-mode flow sends nothing off-device', async ({ page, baseURL }) => {
  const rec = trackExternal(page, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForGame(page);
  // Open the photo scene for player 1 directly and feed a generated image to the file input.
  await page.evaluate(async () => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    const d = m.createDraft('photo', 'ai');
    k.go(new m.PhotoScene(k.ctx, d, 0));
    (window as unknown as { __draft: unknown }).__draft = d;
  });
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('Photo');
  const c = new Canvas(300, 400);
  c.circle(150, 180, 120, hex('#F2C9A0')).circle(110, 160, 14, hex('#333333')).circle(190, 160, 14, hex('#333333'));
  const png = c.render(1).toPNG();
  await page.setInputFiles('input[type=file]', { name: 'face.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => (window as unknown as { __kisshug: { top(): { status: string } } }).__kisshug.top().status === 'ready');
  await page.screenshot({ path: 'e2e/screenshots/photo-crop.png' });
  // Confirm the crop and play a match with the photo head.
  await page.evaluate(() => (window as unknown as { __kisshug: { top(): { confirm(): void } } }).__kisshug.top().confirm());
  await page.waitForTimeout(300);
  const photo = await page.evaluate(() => (window as unknown as { __draft: { players: Array<{ photo: string | null }> } }).__draft.players[0].photo);
  expect(photo).toMatch(/^data:image\/png;base64,/);
  await page.evaluate(async () => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    const d = (window as unknown as { __draft: any }).__draft;
    d.level = 'lv1';
    const cfg = m.finalize(d, k.store);
    k.store.match = cfg;
    k.go(new m.MatchScene(k.ctx, cfg));
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/photo-match.png' });
  await page.evaluate(async () => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    const cfg = k.store.match;
    k.go(new m.ResultScene(k.ctx, cfg, { status: 'win', winner: 1, line: null }));
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'e2e/screenshots/photo-kiss.png' });
  expect(rec.external).toEqual([]);
});
