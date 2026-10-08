import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import type { Ctx } from '../ui/draw';
import type { GameMode, Opponent } from '../state/types';
import { TitleScene } from './title';
import { CharSelectScene } from './charSelect';
import { SideSelectScene } from './sideSelect';
import { COLORS } from '../ui/theme';
import { text } from '../ui/draw';

/** Step 1: mode (classic / characters / photo). Step 2: opponent (AI / 2 players). */
export class ModeSelectScene extends BaseScene {
  name = 'ModeSelect';
  private step: 'mode' | 'opponent' = 'mode';
  private mode: GameMode = 'classic';

  build(): void {
    const { safe, u } = this;
    this.addBack(() => {
      if (this.step === 'opponent') {
        this.step = 'mode';
        this.layout(this.w, this.h);
      } else this.g.go(new TitleScene(this.g));
    });
    this.addGear();
    const bw = Math.min(safe.w - 40 * u, 380 * u);
    const bh = Math.min(86 * u, safe.h / 7);
    const gap = 14 * u;
    const x = this.w / 2 - bw / 2;
    if (this.step === 'mode') {
      const modes: GameMode[] = ['classic', 'chars'];
      if (this.g.photoModeEnabled) modes.push('photo');
      const totalH = modes.length * bh + (modes.length - 1) * gap;
      let y = safe.y + safe.h * 0.5 - totalH / 2 + 20 * u;
      for (const m of modes) {
        this.buttons.add(
          new Button({
            label: this.t(`mode.${m}`),
            sub: this.t(`mode.${m}.desc`),
            style: m === 'classic' ? 'primary' : m === 'chars' ? 'secondary' : 'primary',
            fontSize: 22 * u,
            id: `mode-${m}`,
            onClick: () => {
              this.mode = m;
              this.step = 'opponent';
              this.layout(this.w, this.h);
            },
          }).set(x, y, bw, bh),
        );
        y += bh + gap;
      }
    } else {
      const opps: Opponent[] = ['ai', 'human'];
      let y = safe.y + safe.h * 0.5 - bh;
      for (const o of opps) {
        this.buttons.add(
          new Button({
            label: this.t(`opponent.${o}`),
            style: o === 'ai' ? 'primary' : 'secondary',
            fontSize: 22 * u,
            id: `opp-${o}`,
            onClick: () => this.g.go(this.mode === 'classic' ? new SideSelectScene(this.g, { opponent: o }) : new CharSelectScene(this.g, { mode: this.mode, opponent: o })),
          }).set(x, y, bw, bh),
        );
        y += bh + gap;
      }
    }
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const y = this.header(ctx, this.step === 'mode' ? this.t('mode.title') : this.t('opponent.title'));
    if (this.step === 'opponent') text(ctx, this.t(`mode.${this.mode}`), this.w / 2, y + 10 * this.u, { size: 18 * this.u, color: COLORS.textSoft, weight: 'normal' });
    this.buttons.draw(ctx);
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.step === 'opponent') {
      this.step = 'mode';
      this.layout(this.w, this.h);
      return true;
    }
    return false;
  }
}
