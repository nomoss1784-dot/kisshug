import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { circleMark, crossMark, text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { SetupDraft } from './setup';
import { createDraft } from './setup';
import { ModeSelectScene } from './modeSelect';
import { CharSelectScene } from './charSelect';
import { t } from '../i18n';

/** Classic mode: "Are you X or O?" (X wins = kiss, O wins = hug). Player 1 chooses. */
export class SideSelectScene extends BaseScene {
  name = 'SideSelect';
  private draft: SetupDraft;

  constructor(g: import('./context').GameContext, init: SetupDraft | { opponent: 'ai' | 'human' }) {
    super(g);
    this.draft = 'players' in init ? init : createDraft('classic', init.opponent);
  }

  build(): void {
    const { safe, u } = this;
    this.addBack(() => this.g.go(new ModeSelectScene(this.g)));
    this.addGear();
    const portrait = this.h > this.w;
    const bw = portrait ? Math.min(safe.w - 40 * u, 320 * u) : Math.min((safe.w - 60 * u) / 2, 300 * u);
    const bh = Math.min(120 * u, safe.h / 5);
    const marks: Array<'x' | 'o'> = ['x', 'o'];
    marks.forEach((mark, i) => {
      const x = portrait ? this.w / 2 - bw / 2 : this.w / 2 - bw - 10 * u + i * (bw + 20 * u);
      const y = portrait ? safe.y + safe.h * 0.5 - bh - 10 * u + i * (bh + 20 * u) : safe.y + safe.h * 0.5 - bh / 2;
      this.buttons.add(
        new Button({
          label: t(`side.${mark}`),
          style: 'choice',
          fontSize: 22 * u,
          id: `side-${mark}`,
          icon: (ctx, r) => {
            const cx = r.x + 40 * u;
            const cy = r.y + r.h / 2;
            if (mark === 'x') crossMark(ctx, cx, cy, 16 * u, COLORS.x, 7 * u);
            else circleMark(ctx, cx, cy, 16 * u, COLORS.o, 7 * u);
          },
          onClick: () => {
            const [p1, p2] = this.draft.players;
            p1.mark = mark;
            p2.mark = mark === 'x' ? 'o' : 'x';
            this.g.go(new CharSelectScene(this.g, this.draft, 0));
          },
        }).set(x, y, bw, bh),
      );
    });
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const y = this.header(ctx, t('side.title'));
    text(ctx, t('reward.classicNote'), this.w / 2, y + 10 * this.u, { size: 15 * this.u, color: COLORS.textSoft, weight: 'normal', maxWidth: this.safe.w - 40 });
    this.buttons.draw(ctx);
  }
}
