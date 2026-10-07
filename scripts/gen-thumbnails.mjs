// Placeholder thumbnails for the Playables submission (no logo, characters only). Run after `npm run build`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const sizes = [
  ['16x9', 1280, 720],
  ['9x16', 720, 1280],
  ['1x1', 1080, 1080],
  ['4x3', 1200, 900],
];
mkdirSync('submission/thumbnails', { recursive: true });
const browser = await chromium.launch();
for (const [name, w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1500);
  // Hide the settings gear + "tap to start" by taking the shot of the title scene with buttons stripped.
  await page.evaluate(() => {
    const s = window.__kisshug.top();
    s.thumbnailMode = true;
    s.buttons.buttons = [];
    s.players.forEach((p, i) => { p.height *= 1.6; p.groundY = window.innerHeight * 0.72; p.x = window.innerWidth * (0.2 + 0.2 * i); });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `submission/thumbnails/thumb-${name}.png` });
  console.log('wrote', name);
  await page.close();
}
await browser.close();
