import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { SetupDraft } from './setup';
import { finalize } from './setup';
import type { Level, Lv3Size } from '../state/types';
import type { Difficulty } from '../ai/types';
import { RewardSelectScene } from './rewardSelect';
import { CharSelectScene } from './charSelect';
import { MatchScene } from './match';
import { t } from '../i18n';

/** Board level (Lv1-3), AI strength, and start. */
export class DifficultyScene extends BaseScene {
  name = 'Difficulty';
  constructor(g: import('./context').GameContext, private draft: SetupDraft) {
    super(g);
  }

  build(): void {
    const { safe, u } = this;
    const d = this.draft;
    this.addBack(() => {
      if (d.mode === 'classic') this.g.go(new CharSelectScene(this.g, d, d.opponent === 'human' ? 1 : 0));
      else this.g.go(new RewardSelectScene(this.g, d, d.opponent === 'human' ? 1 : 0));
    });
    this.addGear();
    const colW = Math.min(safe.w - 40 * u, 360 * u);
    const x = this.w / 2 - colW / 2;
    const bh = Math.min(50 * u, safe.h / 13);
    const gap = 8 * u;
    let y = safe.y + 100 * u;
    const levels: Level[] = ['lv1', 'lv2', 'lv3'];
    for (const lv of levels) {
      const label = lv === 'lv3' ? t('level.lv3', { size: this.g.store.settings.lv3Size }) : t(`level.${lv}`);
      this.buttons.add(
        new Button({
          label,
          style: d.level === lv ? 'choiceSelected' : 'choice',
          fontSize: 17 * u,
          id: `level-${lv}`,
          onClick: () => {
            d.level = lv;
            this.layout(this.w, this.h);
          },
        }).set(x, y, colW, bh),
      );
      y += bh + gap;
    }
    if (d.level === 'lv3') {
      const sizes: Lv3Size[] = [15, 17, 19];
      const sw = (colW - gap * 2) / 3;
      sizes.forEach((s, i) => {
        this.buttons.add(
          new Button({
            label: `${s}×${s}`,
            style: this.g.store.settings.lv3Size === s ? 'choiceSelected' : 'choice',
            fontSize: 15 * u,
            id: `size-${s}`,
            onClick: () => {
              this.g.store.settings.lv3Size = s;
              void this.g.store.saveSettings();
              this.layout(this.w, this.h);
            },
          }).set(x + i * (sw + gap), y, sw, bh * 0.85),
        );
      });
      y += bh * 0.85 + gap;
    }
    y += 26 * u;
    this.diffLabelY = y - 2 * u;
    if (d.opponent === 'ai') {
      y += 14 * u;
      const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
      const dw = (colW - gap * 2) / 3;
      diffs.forEach((df, i) => {
        this.buttons.add(
          new Button({
            label: t(`diff.${df}`),
            style: d.difficulty === df ? 'choiceSelected' : 'choice',
            fontSize: 16 * u,
            id: `diff-${df}`,
            onClick: () => {
              d.difficulty = df;
              this.layout(this.w, this.h);
            },
          }).set(x + i * (dw + gap), y, dw, bh),
        );
      });
      y += bh + gap;
    }
    const startH = Math.min(64 * u, safe.h / 9);
    const startY = Math.min(safe.y + safe.h - startH - 16 * u, y + 24 * u);
    this.buttons.add(
      new Button({
        label: t('common.next'),
        style: 'primary',
        fontSize: 22 * u,
        id: 'start',
        onClick: () => {
          const cfg = finalize(d, this.g.store);
          this.g.store.match = cfg;
          this.g.go(new MatchScene(this.g, cfg));
        },
      }).set(this.w / 2 - colW / 2, startY, colW, startH),
    );
  }

  private diffLabelY = 0;

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const u = this.u;
    const y = this.header(ctx, t('diff.title'));
    text(ctx, t('level.title'), this.w / 2, y + 16 * u, { size: 15 * u, color: COLORS.textSoft, weight: 'normal' });
    if (this.draft.opponent === 'ai') text(ctx, t('diff.ai'), this.w / 2, this.diffLabelY, { size: 15 * u, color: COLORS.textSoft, weight: 'normal' });
    this.buttons.draw(ctx);
  }
}
