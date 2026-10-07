import type { Page } from '@playwright/test';

export interface MatchOpts {
  mode?: 'classic' | 'chars' | 'photo';
  opponent?: 'ai' | 'human';
  level?: 'lv1' | 'lv2' | 'lv3';
  lv3Size?: 15 | 17 | 19;
  difficulty?: 'easy' | 'normal' | 'hard';
  first?: 1 | 2;
  animals?: [string, string];
  rewards?: [string, string];
}

/** Waits until the game has booted (debug hook present) and the title is shown. */
export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __kisshug?: { scene(): string } }).__kisshug?.scene() === 'Title', null, { timeout: 20_000 });
  await page.waitForTimeout(300);
}

export async function startMatch(page: Page, o: MatchOpts = {}): Promise<void> {
  await page.evaluate(async (opts) => {
    const k = (window as unknown as { __kisshug: Record<string, any> }).__kisshug;
    const m = await k.scenes();
    if (opts.lv3Size) k.store.settings.lv3Size = opts.lv3Size;
    const d = m.createDraft(opts.mode ?? 'chars', opts.opponent ?? 'ai');
    d.level = opts.level ?? 'lv1';
    d.difficulty = opts.difficulty ?? 'normal';
    if (opts.animals) {
      d.players[0].animal = opts.animals[0];
      d.players[1].animal = opts.animals[1];
    }
    if (opts.rewards) {
      d.players[0].reward = opts.rewards[0];
      d.players[1].reward = opts.rewards[1];
    }
    const cfg = m.finalize(d, k.store);
    if (opts.animals) cfg.players[1].animal = opts.animals[1];
    if (opts.first) cfg.first = opts.first;
    k.store.match = cfg;
    k.go(new m.MatchScene(k.ctx, cfg));
  }, o);
  await page.waitForTimeout(400);
}

export async function scene(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __kisshug: { scene(): string } }).__kisshug.scene());
}

export async function cells(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __kisshug: { top(): { board: { cells: number[] } } } }).__kisshug.top().board.cells);
}

/** Screen centre of a board cell, in CSS px. */
export async function cellCenter(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([r, c]) => (window as unknown as { __kisshug: { top(): { cellCenter(m: { row: number; col: number }): { x: number; y: number } } } }).__kisshug.top().cellCenter({ row: r, col: c }), [row, col]);
}

export async function buttonRect(page: Page, id: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return page.evaluate((bid) => {
    type Btn = { opts: { id?: string }; rect: { x: number; y: number; w: number; h: number } };
    const top = (window as unknown as { __kisshug: { top(): { buttons: { buttons: Btn[] }; confirmBtn?: Btn | null; cancelBtn?: Btn | null; zoomBtn?: Btn | null } } }).__kisshug.top();
    const extra = [top.confirmBtn, top.cancelBtn, top.zoomBtn].filter((b): b is Btn => !!b);
    const b = [...top.buttons.buttons, ...extra].find((bb) => bb.opts.id === bid);
    return b ? b.rect : null;
  }, id);
}

export async function tapButton(page: Page, id: string): Promise<void> {
  const r = await buttonRect(page, id);
  if (!r) throw new Error(`button ${id} not found`);
  await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
  await page.waitForTimeout(250);
}

/** Collects every request URL; returns those not served by our own origin. */
export function trackExternal(page: Page, origin: string): { external: string[]; all: string[] } {
  const rec = { external: [] as string[], all: [] as string[] };
  page.on('request', (req) => {
    const url = req.url();
    rec.all.push(url);
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) rec.external.push(url);
  });
  return rec;
}
