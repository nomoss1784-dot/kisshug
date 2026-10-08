import { BaseScene } from './base';
import { COLORS } from '../ui/theme';
import { heart, text, type Ctx } from '../ui/draw';
import { ANIMALS } from '../state/types';
import type { PointerPos } from '../ui/app';
import { ModeSelectScene } from './modeSelect';
import { inRect } from '../ui/widgets';
import { loadFace, type Drawable } from '../art/characters';

/** Title screen: logo, the four faces bobbing, tap to start. Face art loads after gameReady. */
export class TitleScene extends BaseScene {
  name = 'Title';
  private faces: Drawable[] = [];
  private tick = 0;
  private hearts: Array<{ x: number; y: number; s: number; v: number; a: number }> = [];
  /** Thumbnail capture: characters only, no text or buttons (SPEC §8.4). */
  thumbnailMode = false;

  enter(): void {
    // Title is interactive from the first frame: tell the platform, then lazy-load art.
    this.g.app.onFirstFrame(() => {
      this.g.platform.ready();
      void Promise.all(ANIMALS.map((a) => loadFace(a))).then((faces) => (this.faces = faces));
    });
  }

  build(): void {
    this.addGear();
  }

  update(dt: number): void {
    this.tick += dt;
    if (Math.random() < dt / 900) this.hearts.push({ x: Math.random() * this.w, y: this.h + 20, s: (10 + Math.random() * 14) * this.u, v: 20 + Math.random() * 30, a: 1 });
    this.hearts.forEach((h) => {
      h.y -= (h.v * dt) / 1000;
      h.a -= dt / 7000;
    });
    this.hearts = this.hearts.filter((h) => h.a > 0 && h.y > -40);
  }

  private drawFaces(ctx: Ctx, cy: number, size: number): void {
    const n = this.faces.length;
    if (!n) return;
    const spread = Math.min(this.safe.w - size * 1.1, size * 4.6);
    this.faces.forEach((f, i) => {
      const x = this.w / 2 - spread / 2 + (spread / (n - 1)) * i;
      const phase = (this.tick / 1600) * Math.PI * 2 + i * 0.8;
      const sy = 1 + 0.035 * Math.sin(phase);
      const sx = 1 - 0.015 * Math.sin(phase);
      ctx.save();
      ctx.translate(x, cy + size / 2);
      ctx.scale(sx, sy);
      ctx.drawImage(f, -size / 2, -size, size, size);
      ctx.restore();
    });
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    this.hearts.forEach((h) => heart(ctx, h.x, h.y, h.s, COLORS.heart, h.a * 0.35));
    const { safe, u } = this;
    const portrait = this.h > this.w;
    const faceSize = Math.min(150 * u, safe.w / 4.6, portrait ? this.h * 0.16 : this.h * 0.3);
    if (this.thumbnailMode) {
      this.drawFaces(ctx, this.h / 2 - faceSize / 2, faceSize * 1.5);
      return;
    }
    const titleY = safe.y + (portrait ? safe.h * 0.26 : safe.h * 0.24);
    const titleSize = Math.min(72 * u, safe.w / 5.5);
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 12;
    text(ctx, this.t('app.title'), this.w / 2, titleY, { size: titleSize, color: COLORS.primaryDark });
    ctx.restore();
    text(ctx, this.t('app.subtitle'), this.w / 2, titleY + titleSize * 0.85, { size: 17 * u, color: COLORS.textSoft, weight: 'normal', maxWidth: safe.w - 40 });
    this.drawFaces(ctx, safe.y + (portrait ? safe.h * 0.55 : safe.h * 0.5), faceSize);
    const pulse = 0.75 + 0.25 * Math.sin(this.tick / 350);
    ctx.globalAlpha = pulse;
    text(ctx, this.t('title.tap'), this.w / 2, safe.y + safe.h * 0.86, { size: 20 * u, color: COLORS.text });
    ctx.globalAlpha = 1;
    this.buttons.draw(ctx);
  }

  onTap(p: PointerPos): void {
    this.g.sfx.unlock();
    if (this.buttons.buttons.some((b) => inRect(p, b.rect))) {
      super.onTap(p);
      return;
    }
    this.g.sfx.play('button');
    this.g.go(new ModeSelectScene(this.g));
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === ' ') {
      this.g.go(new ModeSelectScene(this.g));
      return true;
    }
    return false;
  }
}
