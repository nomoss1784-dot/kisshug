import { chromium } from '@playwright/test';
const [,, url, w, h, out, ...actions] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForTimeout(1200);
for (const a of actions) {
  const [kind, ...rest] = a.split(':');
  if (kind === 'tap') { const [x, y] = rest[0].split(',').map(Number); await page.mouse.click(x, y); }
  if (kind === 'wait') await page.waitForTimeout(+rest[0]);
  if (kind === 'eval') await page.evaluate(rest.join(':'));
  if (kind === 'key') await page.keyboard.press(rest[0]);
}
await page.waitForTimeout(400);
await page.screenshot({ path: out });
console.log('scene:', await page.evaluate(() => window.__kisshug?.scene()));
if (errors.length) console.log('ERRORS:', errors.join('\n'));
await browser.close();
