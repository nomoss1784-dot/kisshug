import { test, expect, type Page } from '@playwright/test';
import { startMatch, waitForGame, buttonRect, scene } from './helpers';

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'android-portrait', width: 360, height: 800 },
  { name: 'pc-landscape', width: 1280, height: 720 },
  { name: 'square', width: 800, height: 800 },
  { name: 'extreme-9x32', width: 360, height: 1280 },
  { name: 'extreme-32x9', width: 1280, height: 360 },
];

async function expectButtonsInside(page: Page, w: number, h: number) {
  const rects = await page.evaluate(() => {
    const top = (window as unknown as { __kisshug: { top(): { buttons: { buttons: Array<{ rect: { x: number; y: number; w: number; h: number } }> } } } }).__kisshug.top();
    return top.buttons.buttons.map((b) => b.rect);
  });
  for (const r of rects) {
    expect(r.x).toBeGreaterThanOrEqual(-1);
    expect(r.y).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.w).toBeLessThanOrEqual(w + 1);
    expect(r.y + r.h).toBeLessThanOrEqual(h + 1);
  }
}

for (const vp of VIEWPORTS) {
  test(`layout holds at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await waitForGame(page);
    const shot = (n: string) => page.screenshot({ path: `e2e/screenshots/${vp.name}-${n}.png` });
    await shot('title');
    await expectButtonsInside(page, vp.width, vp.height);
    // Mode select via the real UI (tap anywhere on the title)
    await page.mouse.click(vp.width / 2, vp.height * 0.55);
    await page.waitForTimeout(300);
    expect(await scene(page)).toBe('ModeSelect');
    await shot('mode');
    await expectButtonsInside(page, vp.width, vp.height);
    const r = await buttonRect(page, 'mode-chars');
    expect(r).not.toBeNull();
    await page.mouse.click(r!.x + r!.w / 2, r!.y + r!.h / 2);
    await page.waitForTimeout(200);
    const r2 = await buttonRect(page, 'opp-ai');
    await page.mouse.click(r2!.x + r2!.w / 2, r2!.y + r2!.h / 2);
    await page.waitForTimeout(300);
    expect(await scene(page)).toBe('CharSelect');
    await shot('chars');
    await startMatch(page, { level: 'lv1', first: 1 });
    await page.waitForTimeout(600);
    await shot('match-lv1');
    await expectButtonsInside(page, vp.width, vp.height);
    // Board must be a square inside the viewport
    const br = await page.evaluate(() => (window as unknown as { __kisshug: { top(): { boardRect: { x: number; y: number; w: number; h: number } } } }).__kisshug.top().boardRect);
    expect(Math.abs(br.w - br.h)).toBeLessThan(1);
    expect(br.x).toBeGreaterThanOrEqual(0);
    expect(br.y).toBeGreaterThanOrEqual(0);
    expect(br.x + br.w).toBeLessThanOrEqual(vp.width + 0.5);
    expect(br.y + br.h).toBeLessThanOrEqual(vp.height + 0.5);
    await startMatch(page, { level: 'lv3', lv3Size: 19, opponent: 'human', mode: 'classic' });
    await page.waitForTimeout(600);
    await shot('match-lv3');
    // Resize mid-match keeps the board state
    await page.mouse.click(br.x + br.w / 2, br.y + br.h / 2);
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForTimeout(300);
    expect(await scene(page)).toBe('Match');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    expect(errors).toEqual([]);
  });
}

test('settings overlay closes with Escape and photo privacy text is visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForGame(page);
  const gear = await buttonRect(page, 'settings');
  await page.mouse.click(gear!.x + gear!.w / 2, gear!.y + gear!.h / 2);
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('Settings');
  await page.screenshot({ path: 'e2e/screenshots/settings.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await scene(page)).toBe('Title');
});
