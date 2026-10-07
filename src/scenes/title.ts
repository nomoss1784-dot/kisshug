import { BaseScene } from './base';
import { COLORS } from '../ui/theme';
import { heart, text, type Ctx } from '../ui/draw';
import { RigPlayer } from '../rig/player';
import { loadSkin } from '../rig/assets';
import { ANIMALS } from '../state/types';
import type { PointerPos } from '../ui/app';
import { ModeSelectScene } from './modeSelect';
import { inRect } from '../ui/widgets';

/** Title screen: logo, the four animals idling, tap to start. */
export class TitleScene extends BaseScene {
  name = 'Title';
  private players: RigPlayer[] = [];
  private tick = 0;
  private hearts: Array<{ x: number; y: number; s: number; v: number; a: number }> = [];
  /** Thumbnail capture: characters only, no text or buttons (SPEC §8.4). */
  thumbnailMode = false;

  enter(): void {
    void Promise.all(ANIMALS.map((a) => loadSkin(this.g.rig, { animal: a, hueShift: 0, photo: null }))).then((skins) => {
      this.players = skins.map((s, i) => {
        const p = new RigPlayer(this.g.rig, s, ANIMALS[i]);
        p.play('idle');
        return p;
      });
      this.placePlayers();
    });
    // Title is interactive from the first frame: tell the platform.
    this.g.app.onFirstFrame(() => this.g.platform.ready());
  }

  build(): void {
    this.addGear();
    this.placePlayers();
  }

  private placePlayers(): void {
    const { safe, u } = this;
    const n = this.players.length;
    if (!n) return;
    const portrait = this.h > this.w;
    const charH = Math.min(150 * u, portrait ? this.h * 0.18 : this.h * 0.32, safe.w / 4.4);
    const groundY = portrait ? safe.y + safe.h * 0.68 : safe.y + safe.h * 0.78;
    const spread = Math.min(safe.w * 0.8, charH * 4.2);
    this.players.forEach((p, i) => {
      p.height = charH;
      p.groundY = groundY;
      p.x = this.w / 2 - spread / 2 + (spread / (n - 1)) * i;
      p.facing = i < n / 2 ? 1 : -1;
    });
  }

  update(dt: number): void {
    this.tick += dt;
    this.players.forEach((p) => p.update(dt));
    if (Math.random() < dt / 900) this.hearts.push({ x: Math.random() * this.w, y: this.h + 20, s: (10 + Math.random() * 14) * this.u, v: 20 + Math.random() * 30, a: 1 });
    this.hearts.forEach((h) => {
      h.y -= (h.v * dt) / 1000;
      h.a -= dt / 7000;
    });
    this.hearts = this.hearts.filter((h) => h.a > 0 && h.y > -40);
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    this.hearts.forEach((h) => heart(ctx, h.x, h.y, h.s, COLORS.heart, h.a * 0.35));
    const { safe, u } = this;
    const portrait = this.h > this.w;
    const titleY = safe.y + (portrait ? safe.h * 0.26 : safe.h * 0.24);
    const titleSize = Math.min(72 * u, safe.w / 5.5);
    if (this.thumbnailMode) {
      this.players.forEach((p) => p.draw(ctx));
      return;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 12;
    text(ctx, this.t('app.title'), this.w / 2, titleY, { size: titleSize, color: COLORS.primaryDark });
    ctx.restore();
    text(ctx, this.t('app.subtitle'), this.w / 2, titleY + titleSize * 0.85, { size: 17 * u, color: COLORS.textSoft, weight: 'normal', maxWidth: safe.w - 40 });
    this.players.forEach((p) => p.draw(ctx));
    if (this.thumbnailMode) return;
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
