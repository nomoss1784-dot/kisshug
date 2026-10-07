import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** SPEC §10 phase 3: the submission ZIP works when unzipped and index.html is opened directly. */
test('kisshug-playables.zip runs from file:// with index.html at the root', async ({ page }) => {
  execSync('npm run build:playables', { cwd: process.cwd(), stdio: 'ignore' });
  const dir = mkdtempSync(join(tmpdir(), 'kisshug-zip-'));
  execSync(`unzip -q "${join(process.cwd(), 'kisshug-playables.zip')}" -d "${dir}"`);
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) external.push(r.url());
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${join(dir, 'index.html')}`);
  await page.waitForFunction(() => (window as unknown as { __kisshug?: { scene(): string } }).__kisshug?.scene() === 'Title', null, { timeout: 15_000 });
  // AI must still answer (worker falls back to the main thread on file://)
  await page.evaluate(async () => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    const d = m.createDraft('chars', 'ai');
    d.level = 'lv1';
    const cfg = m.finalize(d, k.store);
    cfg.first = 2;
    k.store.match = cfg;
    k.go(new m.MatchScene(k.ctx, cfg));
  });
  await page.waitForFunction(() => (window as unknown as { __kisshug: { top(): { board: { cells: number[] } } } }).__kisshug.top().board.cells.some((v) => v === 2), null, { timeout: 5000 });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
