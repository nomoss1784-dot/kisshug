import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { panel, text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { MatchConfig, PlayerConfig } from '../state/types';
import type { GameResult } from '../game/types';
import { nextPlayer } from '../game';
import { loadCharacterArt } from '../art/characters';
import { buildCeremony, buildIdle, sampleClamped, type CeremonyKind, type Timeline } from '../fx';
import { drawForeheadBadge, drawSprites, type Cast } from '../fx/renderer';
import { drawMark } from './pieces';
import { MatchScene } from './match';
import { ModeSelectScene } from './modeSelect';
import { artSpecOf, markGlyph, playerName } from './context';
import type { PointerPos } from '../ui/app';
import { t } from '../i18n';

/**
 * Result ceremony (SPEC §6.2): pose-image crossfades + transform bounces from
 * the fx engine. Tap skips (after the first full viewing); afterwards the
 * characters idle (breathing/blinking) behind the result panel.
 */
export class ResultScene extends BaseScene {
  name = 'Result';
  private ceremony: CeremonyKind;
  private actor: PlayerConfig;
  private target: PlayerConfig;
  private cast: Cast | null = null;
  private timeline: Timeline | null = null;
  private idle: Timeline | null = null;
  private time = 0;
  private stage: 'play' | 'done' = 'play';
  private panelAlpha = { a: 0 };
  private panelY = 0;
  private busy = false;
  private layoutInfo = { actorX: 0, targetX: 0, groundY: 0, charHeight: 200, dir: 1 as 1 | -1 };

  constructor(g: import('./context').GameContext, private cfg: MatchConfig, private result: GameResult) {
    super(g);
    if (result.status === 'win' && result.winner) {
      this.actor = cfg.players[result.winner - 1];
      this.target = cfg.players[nextPlayer(result.winner) - 1];
      this.ceremony = this.actor.reward;
    } else {
      this.actor = cfg.players[0];
      this.target = cfg.players[1];
      this.ceremony = 'shake';
    }
  }

  enter(): void {
    void Promise.all([loadCharacterArt(artSpecOf(this.actor)), loadCharacterArt(artSpecOf(this.target))]).then(([a, b]) => {
      const dir = this.actor.id === 1 ? 1 : -1;
      this.cast = { actor: { art: a, facing: dir as 1 | -1 }, target: { art: b, facing: -dir as 1 | -1 }, charHeight: this.layoutInfo.charHeight };
      this.layout(this.w, this.h);
      this.g.sfx.play(this.ceremony);
    });
  }

  build(): void {
    const { safe, u } = this;
    const portrait = this.h > this.w;
    const charHeight = Math.min(portrait ? this.h * 0.3 : this.h * 0.46, safe.w * 0.42, 300 * u);
    const groundY = portrait ? safe.y + safe.h * 0.58 : safe.y + safe.h * 0.74;
    const half = Math.min(safe.w * 0.3, charHeight * 1.05);
    const dir = (this.actor.id === 1 ? 1 : -1) as 1 | -1;
    this.layoutInfo = { actorX: this.w / 2 - dir * half, targetX: this.w / 2 + dir * half * 0.6, groundY, charHeight, dir };
    if (this.cast) {
      this.cast.charHeight = charHeight;
      const layout = { ...this.layoutInfo, seed: 1 };
      this.timeline = buildCeremony(this.ceremony, layout);
      // After the ceremony both idle in their final (happy) poses where they ended up.
      const finalPoses = sampleClamped(this.timeline, this.timeline.duration).filter((s) => s.kind === 'pose');
      const ax = finalPoses.find((s) => s.kind === 'pose' && s.who === 'actor')?.x ?? layout.actorX;
      const tx = finalPoses.find((s) => s.kind === 'pose' && s.who === 'target')?.x ?? layout.targetX;
      this.idle = buildIdle({ ...layout, actorX: ax, targetX: tx }, { actorPose: 'happy', targetPose: 'happy' });
    }
    const bw = Math.min(safe.w - 40 * u, 300 * u);
    const bh = Math.min(54 * u, safe.h / 10);
    const py = portrait ? groundY + 40 * u : groundY + 10 * u;
    const row = portrait;
    const b1x = row ? this.w / 2 - bw / 2 : this.w / 2 - bw - 6 * u;
    const b2x = row ? this.w / 2 - bw / 2 : this.w / 2 + 6 * u;
    const b1y = py + 70 * u;
    const b2y = row ? py + 70 * u + bh + 10 * u : py + 70 * u;
    this.panelY = py;
    this.buttons.add(new Button({ label: t('result.again'), style: 'primary', fontSize: 20 * u, id: 'again', enabled: this.stage === 'done', onClick: () => this.leave('again') }).set(b1x, b1y, bw, bh));
    this.buttons.add(new Button({ label: t('result.back'), style: 'ghost', fontSize: 18 * u, id: 'back', enabled: this.stage === 'done', onClick: () => this.leave('back') }).set(b2x, b2y, bw, bh));
  }

  private async leave(how: 'again' | 'back'): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    // Interstitial at a natural break: every 3rd match's result screen (SPEC §8.3).
    if (this.g.store.stats.matches > 0 && this.g.store.stats.matches % 3 === 0) await this.g.platform.showInterstitial();
    if (how === 'again') {
      const store = this.g.store;
      const first = store.nextFirst;
      store.nextFirst = first === 1 ? 2 : 1;
      const p2 = { ...this.cfg.players[1] };
      if (p2.isAi) p2.reward = Math.random() < 0.5 ? 'kiss' : 'hug';
      const cfg: MatchConfig = { ...this.cfg, players: [{ ...this.cfg.players[0] }, p2], first };
      store.match = cfg;
      this.g.go(new MatchScene(this.g, cfg));
    } else this.g.go(new ModeSelectScene(this.g));
  }

  private finishAct(): void {
    if (this.stage === 'done') return;
    this.stage = 'done';
    this.time = 0;
    const seen = this.g.store.settings.seen[this.ceremony];
    if (!seen) {
      this.g.store.settings.seen[this.ceremony] = true;
      void this.g.store.saveSettings();
    }
    this.tweens.to(this.panelAlpha, { a: 1 }, 350);
    this.buttons.buttons.forEach((bt) => (bt.opts.enabled = true));
  }

  private skip(): void {
    if (this.timeline) this.time = this.timeline.duration;
    this.finishAct();
  }

  update(dt: number): void {
    if (!this.timeline) return;
    this.time += dt;
    if (this.stage === 'play' && this.time >= this.timeline.duration) this.finishAct();
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const u = this.u;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, this.layoutInfo.groundY, this.w, 6 * u);
    if (this.cast && this.timeline && this.idle) {
      const sprites = this.stage === 'play' ? sampleClamped(this.timeline, this.time) : sampleClamped(this.idle, this.time);
      drawSprites(ctx, sprites, this.cast);
      if (this.cfg.mode === 'classic') {
        // Classic: X/O badge on the forehead (SPEC §3.1).
        for (const who of ['actor', 'target'] as const) {
          const p = who === 'actor' ? this.actor : this.target;
          drawForeheadBadge(ctx, sprites, who, this.cast, (c, size) => {
            c.beginPath();
            c.arc(0, 0, size * 0.7, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,255,255,0.92)';
            c.fill();
            drawMark(c, p.mark, 0, 0, size * 0.42, size * 0.16);
          });
        }
      }
    }
    const classic = this.cfg.mode === 'classic';
    const an = classic ? markGlyph(this.actor.mark) : playerName(this.actor, this.target);
    const tn = classic ? markGlyph(this.target.mark) : playerName(this.target, this.actor);
    const title = this.result.status === 'draw' ? t('result.draw') : t('result.win', { name: an });
    const sub = this.ceremony === 'shake' ? t('result.shake') : t(`result.${this.ceremony}`, { w: an, l: tn });
    const topY = this.safe.y + 40 * u;
    text(ctx, title, this.w / 2, topY, { size: 30 * u, color: COLORS.primaryDark, maxWidth: this.safe.w - 20 });
    text(ctx, sub, this.w / 2, topY + 34 * u, { size: 17 * u, color: COLORS.text, weight: 'normal', maxWidth: this.safe.w - 20 });
    if (this.stage !== 'done') {
      if (this.g.store.settings.seen[this.ceremony]) text(ctx, t('result.skip'), this.w / 2, this.safe.y + this.safe.h - 24 * u, { size: 13 * u, color: COLORS.textSoft, weight: 'normal' });
    } else {
      ctx.globalAlpha = this.panelAlpha.a;
      const bw = Math.min(this.safe.w - 24 * u, 420 * u);
      panel(ctx, this.w / 2 - bw / 2, this.panelY + 50 * u, bw, this.h > this.w ? 150 * u : 90 * u, 18 * u, 'rgba(255,255,255,0.9)');
      this.buttons.draw(ctx);
      ctx.globalAlpha = 1;
    }
  }

  onTap(p: PointerPos): void {
    if (this.stage === 'done') {
      if (this.buttons.tap(p)) this.g.sfx.play('button');
      return;
    }
    // SPEC §6.2: skippable, but the first viewing of each ceremony plays through.
    if (this.g.store.settings.seen[this.ceremony]) this.skip();
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.stage !== 'done' && this.g.store.settings.seen[this.ceremony]) {
      this.skip();
      return true;
    }
    return false;
  }
}
