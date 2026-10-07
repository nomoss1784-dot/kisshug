import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { text, heart, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { SetupDraft } from './setup';
import type { Reward } from '../state/types';
import { CharSelectScene } from './charSelect';
import { DifficultyScene } from './difficulty';
import { playerName } from './context';
import { t } from '../i18n';

/** "If you win: kiss or hug?" for each human player (chars/photo modes). */
export class RewardSelectScene extends BaseScene {
  name = 'RewardSelect';
  constructor(g: import('./context').GameContext, private draft: SetupDraft, private idx: 0 | 1) {
    super(g);
  }

  build(): void {
    const { safe, u } = this;
    this.addBack(() => {
      if (this.idx === 1) this.g.go(new RewardSelectScene(this.g, this.draft, 0));
      else this.g.go(new CharSelectScene(this.g, this.draft, this.draft.opponent === 'human' ? 1 : 0));
    });
    this.addGear();
    const portrait = this.h > this.w;
    const bw = portrait ? Math.min(safe.w - 40 * u, 320 * u) : Math.min((safe.w - 60 * u) / 2, 300 * u);
    const bh = Math.min(120 * u, safe.h / 5);
    const rewards: Reward[] = ['kiss', 'hug'];
    rewards.forEach((r, i) => {
      const x = portrait ? this.w / 2 - bw / 2 : this.w / 2 - bw - 10 * u + i * (bw + 20 * u);
      const y = portrait ? safe.y + safe.h * 0.5 - bh - 10 * u + i * (bh + 20 * u) : safe.y + safe.h * 0.5 - bh / 2;
      this.buttons.add(
        new Button({
          label: t(`reward.${r}`),
          style: r === 'kiss' ? 'primary' : 'secondary',
          fontSize: 30 * u,
          id: `reward-${r}`,
          icon: (ctx, rect) => {
            if (r === 'kiss') heart(ctx, rect.x + 34 * u, rect.y + rect.h / 2, 26 * u, '#FFFFFF', 0.8);
            else {
              ctx.strokeStyle = 'rgba(255,255,255,0.85)';
              ctx.lineWidth = 5 * u;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.arc(rect.x + 34 * u, rect.y + rect.h / 2, 14 * u, Math.PI * 0.2, Math.PI * 1.8);
              ctx.stroke();
            }
          },
          onClick: () => {
            this.draft.players[this.idx].reward = r;
            if (this.idx === 0 && this.draft.opponent === 'human') this.g.go(new RewardSelectScene(this.g, this.draft, 1));
            else this.g.go(new DifficultyScene(this.g, this.draft));
          },
        }).set(x, y, bw, bh),
      );
    });
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const [p1, p2] = this.draft.players;
    const me = this.idx === 0 ? p1 : p2;
    const other = this.idx === 0 ? p2 : p1;
    const y = this.header(ctx, t('reward.title', { player: playerName(me, other) }));
    if (this.draft.opponent === 'ai') text(ctx, t('reward.aiNote'), this.w / 2, y + 10 * this.u, { size: 15 * this.u, color: COLORS.textSoft, weight: 'normal', maxWidth: this.safe.w - 40 });
    this.buttons.draw(ctx);
  }
}
