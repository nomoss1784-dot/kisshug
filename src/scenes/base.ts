import type { Scene, PointerPos } from '../ui/app';
import { Tweens } from '../ui/tween';
import { Button, ButtonGroup, drawBack, drawGear, unit, type Rect } from '../ui/widgets';
import { COLORS } from '../ui/theme';
import { text, type Ctx } from '../ui/draw';
import type { GameContext } from './context';
import { t } from '../i18n';

/** Common scene plumbing: background, header, buttons, pointer forwarding. */
export abstract class BaseScene implements Scene {
  readonly tweens = new Tweens();
  readonly buttons = new ButtonGroup();
  transparent = false;
  w = 0;
  h = 0;
  /** UI scale unit (1 at ~420px short side). */
  u = 1;
  /** Safe content rect (letterboxed on extreme aspect ratios). */
  safe: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(protected g: GameContext) {}

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.u = unit(w, h);
    // Keep content within a 9:32..32:9 friendly box: cap width in landscape, height in portrait.
    const maxW = Math.min(w, h * 1.6, 900);
    const maxH = Math.min(h, w * 2.2);
    this.safe = { x: (w - maxW) / 2, y: (h - maxH) / 2, w: maxW, h: maxH };
    this.buttons.clear();
    this.build();
  }

  /** Rebuild buttons/positions for the current size. */
  abstract build(): void;
  update(_dt: number): void {}
  abstract draw(ctx: Ctx, w: number, h: number): void;

  enter(): void {}
  exit(): void {}

  onPointerDown(p: PointerPos): void {
    this.buttons.down(p);
  }
  onPointerMove(p: PointerPos): void {
    this.buttons.move(p);
  }
  onPointerUp(): void {
    this.buttons.up();
  }
  onTap(p: PointerPos): void {
    if (this.buttons.tap(p)) this.g.sfx.play('button');
  }
  onKey(_e: KeyboardEvent): boolean {
    return false;
  }

  drawBg(ctx: Ctx): void {
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, COLORS.bg);
    grad.addColorStop(1, COLORS.bgDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
    // soft dots
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const step = 48 * this.u;
    for (let y = step / 2; y < this.h; y += step) {
      for (let x = ((y / step) % 2) * step * 0.5 + step / 2; x < this.w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 3 * this.u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Header with optional back button; returns the y below it. */
  header(ctx: Ctx, title: string): number {
    const u = this.u;
    const y = this.safe.y + 14 * u;
    text(ctx, title, this.w / 2, y + 24 * u, { size: 26 * u, color: COLORS.text, maxWidth: this.safe.w - 120 * u });
    return y + 56 * u;
  }

  addBack(onClick: () => void): Button {
    const u = this.u;
    return this.buttons.add(new Button({ label: '', style: 'ghost', onClick, icon: drawBack, id: 'back' }).set(this.safe.x + 10 * u, this.safe.y + 10 * u, 48 * u, 48 * u));
  }

  addGear(): Button {
    const u = this.u;
    return this.buttons.add(
      new Button({ label: '', style: 'ghost', onClick: () => this.openSettings(), icon: drawGear, id: 'settings' }).set(this.safe.x + this.safe.w - 58 * u, this.safe.y + 10 * u, 48 * u, 48 * u),
    );
  }

  openSettings(): void {
    void import('./settings').then(({ SettingsScene }) => this.g.overlay(new SettingsScene(this.g)));
  }

  /** Convenience for `t` in subclasses. */
  t(key: string, params?: Record<string, string | number>): string {
    return t(key, params);
  }
}
