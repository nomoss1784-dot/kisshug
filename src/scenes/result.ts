import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { heart, panel, sparkle, text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { MatchConfig, PlayerConfig, Reward } from '../state/types';
import { BODY_TINTS } from '../state/types';
import type { GameResult } from '../game/types';
import { nextPlayer } from '../game';
import { RigPlayer } from '../rig/player';
import { loadSkin } from '../rig/assets';
import { MatchScene } from './match';
import { ModeSelectScene } from './modeSelect';
import { playerName } from './context';
import { easeInOutQuad, easeOutBack } from '../ui/tween';
import type { PointerPos } from '../ui/app';
import { t } from '../i18n';

type Ceremony = Reward | 'shake';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: 'heart' | 'sparkle';
}

/**
 * Result ceremony (SPEC §6.2): the winner walks over and gives a kiss or hug;
 * a draw is a handshake. Tap skips (after the first full viewing).
 */
export class ResultScene extends BaseScene {
  name = 'Result';
  private ceremony: Ceremony;
  private actor: PlayerConfig;
  private target: PlayerConfig;
  private rigs: Record<'actor' | 'target', RigPlayer | null> = { actor: null, target: null };
  private time = 0;
  private stage: 'walk' | 'act' | 'done' = 'walk';
  private particles: Particle[] = [];
  private panelAlpha = { a: 0 };
  private lift = { y: 0 };
  private charH = 200;
  private groundY = 0;
  private actorStart = 0;
  private actorEnd = 0;
  private targetX = 0;
  private walkMs = 800;
  private busy = false;

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

  private get actMs(): number {
    return this.ceremony === 'shake' ? 1500 : 2000;
  }

  enter(): void {
    const spec = (p: PlayerConfig) => ({ animal: p.animal, hueShift: p.hueShift, photo: p.photo, bodyColor: p.photo ? BODY_TINTS[p.bodyTint] : undefined });
    void Promise.all([loadSkin(this.g.rig, spec(this.actor)), loadSkin(this.g.rig, spec(this.target))]).then(([a, b]) => {
      this.rigs.actor = new RigPlayer(this.g.rig, a, this.actor.animal);
      this.rigs.target = new RigPlayer(this.g.rig, b, this.target.animal);
      this.rigs.actor.play('walk');
      this.rigs.target.play('idle');
      this.layout(this.w, this.h);
    });
  }

  build(): void {
    const { safe, u } = this;
    const portrait = this.h > this.w;
    this.charH = Math.min(portrait ? this.h * 0.28 : this.h * 0.42, safe.w * 0.42, 280 * u);
    this.groundY = portrait ? safe.y + safe.h * 0.56 : safe.y + safe.h * 0.72;
    const gapNear = this.charH * 0.62;
    const half = Math.min(safe.w * 0.3, this.charH * 1.1);
    const actorLeft = this.actor.id === 1;
    const dir = actorLeft ? 1 : -1;
    this.actorStart = this.w / 2 - dir * half;
    this.targetX = this.w / 2 + dir * half * 0.55;
    this.actorEnd = this.targetX - dir * gapNear;
    const a = this.rigs.actor;
    const b = this.rigs.target;
    if (a && b) {
      a.height = this.charH;
      b.height = this.charH;
      a.groundY = this.groundY;
      b.groundY = this.groundY;
      a.facing = dir as 1 | -1;
      b.facing = -dir as 1 | -1;
      b.x = this.targetX;
      if (this.stage === 'walk') a.x = this.actorStart + (this.actorEnd - this.actorStart) * easeInOutQuad(Math.min(1, this.time / this.walkMs));
      else a.x = this.actorEnd;
    }
    // panel buttons
    const bw = Math.min(safe.w - 40 * u, 300 * u);
    const bh = Math.min(54 * u, safe.h / 10);
    const py = portrait ? this.groundY + 40 * u : this.groundY + 10 * u;
    const row = portrait;
    const b1x = row ? this.w / 2 - bw / 2 : this.w / 2 - bw - 6 * u;
    const b2x = row ? this.w / 2 - bw / 2 : this.w / 2 + 6 * u;
    const b1y = row ? py + 70 * u : py + 70 * u;
    const b2y = row ? py + 70 * u + bh + 10 * u : py + 70 * u;
    this.panelY = py;
    this.buttons.add(new Button({ label: t('result.again'), style: 'primary', fontSize: 20 * u, id: 'again', enabled: false, onClick: () => this.leave('again') }).set(b1x, b1y, bw, bh));
    this.buttons.add(new Button({ label: t('result.back'), style: 'ghost', fontSize: 18 * u, id: 'back', enabled: false, onClick: () => this.leave('back') }).set(b2x, b2y, bw, bh));
  }

  private panelY = 0;

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

  private startAct(): void {
    this.stage = 'act';
    const a = this.rigs.actor!;
    const b = this.rigs.target!;
    a.x = this.actorEnd;
    if (this.ceremony === 'shake') {
      a.play('shake_actor');
      b.play('shake_target');
      this.g.sfx.play('shake');
      this.tweens.to({}, {}, 600, { onComplete: () => (a.blush = b.blush = true) });
    } else {
      a.play(`${this.ceremony}_actor`);
      b.play(`${this.ceremony}_target`);
      this.g.sfx.play(this.ceremony);
      this.tweens.to({}, {}, 450, { onComplete: () => (b.blush = true) });
      // Animal flair (SPEC §6.1)
      if (!this.actor.photo) {
        if (this.actor.animal === 'bear' && this.ceremony === 'hug') {
          a.addOverlay('flair_bear');
          this.tweens.to(this.lift, { y: -this.charH * 0.16 }, 500, { ease: easeOutBack, delay: 450 });
          this.tweens.to(this.lift, { y: 0 }, 400, { delay: 1550 });
        } else if (this.actor.animal !== 'bear') a.addOverlay(`flair_${this.actor.animal}`);
      }
      if (!this.target.photo && this.target.animal === 'dog') b.addOverlay('flair_dog');
    }
    this.tweens.to({}, {}, this.actMs, { onComplete: () => this.finishAct() });
  }

  private finishAct(): void {
    if (this.stage === 'done') return;
    this.stage = 'done';
    const a = this.rigs.actor;
    const b = this.rigs.target;
    a?.clearOverlays();
    if (this.ceremony === 'shake') {
      a?.play('idle');
      b?.play('idle');
    } else {
      a?.play('happy');
      b?.play('idle');
    }
    if (a) a.x = this.actorEnd;
    this.lift.y = 0;
    const seen = this.g.store.settings.seen;
    if (!seen[this.ceremony]) {
      seen[this.ceremony] = true;
      void this.g.store.saveSettings();
    }
    this.tweens.to(this.panelAlpha, { a: 1 }, 350);
    this.buttons.buttons.forEach((bt) => (bt.opts.enabled = true));
  }

  private skip(): void {
    this.tweens.clear();
    if (this.rigs.actor && this.rigs.target) {
      this.rigs.target.blush = this.ceremony !== 'shake' || true;
      this.finishAct();
    }
  }

  private spawn(kind: Particle['kind'], x: number, y: number): void {
    const u = this.u;
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 60 * u, vy: -(40 + Math.random() * 50) * u, life: 0, max: 1200 + Math.random() * 600, size: (10 + Math.random() * 12) * u, kind });
  }

  update(dt: number): void {
    const a = this.rigs.actor;
    const b = this.rigs.target;
    if (!a || !b) return;
    this.time += dt;
    a.update(dt);
    b.update(dt);
    if (this.stage === 'walk') {
      const p = Math.min(1, this.time / this.walkMs);
      a.x = this.actorStart + (this.actorEnd - this.actorStart) * easeInOutQuad(p);
      if (p >= 1) this.startAct();
    } else if (this.stage === 'act' && this.ceremony !== 'shake') {
      const hc = b.headCenter();
      if (Math.random() < dt / 160) this.spawn(this.ceremony === 'kiss' ? 'heart' : Math.random() < 0.5 ? 'heart' : 'sparkle', hc.x + (Math.random() - 0.5) * this.charH * 0.5, hc.y);
    }
    b.groundY = this.groundY + this.lift.y;
    for (const p of this.particles) {
      p.life += dt;
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const u = this.u;
    const a = this.rigs.actor;
    const b = this.rigs.target;
    // ground line
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, this.groundY, this.w, 6 * u);
    if (a && b) {
      // draw the one further back first
      const order = this.ceremony === 'hug' && this.stage !== 'walk' ? [a, b] : [b, a];
      order.forEach((r) => r.draw(ctx));
      // Cat flair: heart at the tail tip
      if (this.stage === 'act' && !this.actor.photo && this.actor.animal === 'cat' && this.ceremony !== 'shake') {
        const tip = a.point('tail_tip');
        heart(ctx, tip.x, tip.y - 10 * u, 16 * u, COLORS.heart, Math.min(1, Math.max(0, (this.time - this.walkMs - 500) / 400)));
      }
    }
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.max;
      if (p.kind === 'heart') heart(ctx, p.x, p.y, p.size, COLORS.heart, alpha);
      else sparkle(ctx, p.x, p.y, p.size * 0.6, COLORS.accent, alpha);
    }
    // caption
    const title = this.result.status === 'draw' ? t('result.draw') : t('result.win', { name: playerName(this.actor, this.target) });
    const sub = this.ceremony === 'shake' ? t('result.shake') : t(`result.${this.ceremony}`, { w: playerName(this.actor, this.target), l: playerName(this.target, this.actor) });
    const topY = this.safe.y + 40 * u;
    text(ctx, title, this.w / 2, topY, { size: 30 * u, color: COLORS.primaryDark, maxWidth: this.safe.w - 20 });
    text(ctx, sub, this.w / 2, topY + 34 * u, { size: 17 * u, color: COLORS.text, weight: 'normal', maxWidth: this.safe.w - 20 });
    if (this.stage !== 'done') {
      const seen = this.g.store.settings.seen[this.ceremony];
      if (seen) text(ctx, t('result.skip'), this.w / 2, this.safe.y + this.safe.h - 24 * u, { size: 13 * u, color: COLORS.textSoft, weight: 'normal' });
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
