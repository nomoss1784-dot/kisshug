import { BaseScene } from './base';
import { inRect, type Rect } from '../ui/widgets';
import { text, fillRoundRect, roundRect, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import { ANIMALS, type AnimalId, type GameMode, type Opponent } from '../state/types';
import { createDraft, type SetupDraft } from './setup';
import { ModeSelectScene } from './modeSelect';
import { RewardSelectScene } from './rewardSelect';
import { DifficultyScene } from './difficulty';
import { SideSelectScene } from './sideSelect';
import { loadFace, type Drawable } from '../art/characters';
import { overshoot } from '../fx/ease';
import type { PointerPos } from '../ui/app';
import { PALETTES } from '../art/plush';
import { t } from '../i18n';

interface Card {
  rect: Rect;
  animal: AnimalId | 'locked' | 'photo';
  /** Bounce animation progress (0..1) when just selected. */
  bounce: number;
}

/** Character pick for one player. Cards use the face images (SPEC §6.3). */
export class CharSelectScene extends BaseScene {
  name = 'CharSelect';
  private draft: SetupDraft;
  private idx: 0 | 1;
  private cards: Card[] = [];
  private faces = new Map<AnimalId, Drawable>();
  private photoThumb: HTMLImageElement | null = null;
  private pressedCard: Card | null = null;
  private lockedHint = 0;
  private leaving = false;

  constructor(g: import('./context').GameContext, init: { mode: GameMode; opponent: Opponent } | SetupDraft, idx: 0 | 1 = 0) {
    super(g);
    this.draft = 'players' in init ? init : createDraft(init.mode, init.opponent);
    this.idx = idx;
  }

  enter(): void {
    void Promise.all(ANIMALS.map((a) => loadFace(a))).then((faces) => faces.forEach((f, i) => this.faces.set(ANIMALS[i], f)));
    const photo = this.draft.players[this.idx].photo;
    if (photo) {
      const img = new Image();
      img.onload = () => (this.photoThumb = img);
      img.src = photo;
    }
  }

  private get player() {
    return this.draft.players[this.idx];
  }

  build(): void {
    const { safe, u } = this;
    this.cards = [];
    this.addBack(() => {
      if (this.idx === 1) this.g.go(new CharSelectScene(this.g, this.draft, 0));
      else if (this.draft.mode === 'classic') this.g.go(new SideSelectScene(this.g, this.draft));
      else this.g.go(new ModeSelectScene(this.g));
    });
    this.addGear();
    const slots: Card['animal'][] = [...ANIMALS, 'locked'];
    if (this.draft.mode === 'photo') slots.unshift('photo');
    const cols = this.w > this.h ? Math.min(slots.length, 6) : slots.length <= 4 ? 2 : 3;
    const rows = Math.ceil(slots.length / cols);
    const top = safe.y + 90 * u;
    const bottom = safe.y + safe.h - 24 * u;
    const availW = safe.w - 32 * u;
    const availH = bottom - top;
    const gap = 12 * u;
    const size = Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows, 150 * u);
    const gridW = cols * size + (cols - 1) * gap;
    const gridH = rows * size + (rows - 1) * gap;
    const x0 = this.w / 2 - gridW / 2;
    const y0 = top + (availH - gridH) / 2;
    slots.forEach((a, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      this.cards.push({ rect: { x: x0 + c * (size + gap), y: y0 + r * (size + gap), w: size, h: size }, animal: a, bounce: 1 });
    });
  }

  private titleText(): string {
    const p = this.player;
    if (this.draft.mode === 'classic') return p.mark === 'o' ? t('select.side.o') : t('select.side.x');
    return t('select.title', { player: this.idx === 0 ? t('common.player1') : t('common.player2') });
  }

  update(dt: number): void {
    if (this.lockedHint > 0) this.lockedHint -= dt;
    for (const c of this.cards) if (c.bounce < 1) c.bounce = Math.min(1, c.bounce + dt / 420);
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const y = this.header(ctx, this.titleText());
    if (this.draft.mode === 'classic') text(ctx, t('select.sideNote'), this.w / 2, y + 6 * this.u, { size: 13 * this.u, color: COLORS.textSoft, weight: 'normal' });
    const u = this.u;
    for (const card of this.cards) {
      const r = card.rect;
      const selected = (card.animal === this.player.animal && !this.player.photo) || (card.animal === 'photo' && !!this.player.photo);
      const pressed = this.pressedCard === card;
      // Selected card bounces with a little overshoot (SPEC §6).
      const b = card.bounce < 1 ? 1 + 0.12 * (1 - card.bounce) * Math.sin(overshoot(card.bounce) * Math.PI) : 1;
      const sc = (pressed ? 0.95 : 1) * b;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      ctx.shadowColor = 'rgba(80,40,60,0.15)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 18 * u, card.animal === 'locked' ? '#F3EAEE' : '#FFFFFF');
      ctx.shadowColor = 'transparent';
      if (selected) {
        roundRect(ctx, r.x, r.y, r.w, r.h, 18 * u);
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 4 * u;
        ctx.stroke();
      }
      const iconSize = r.w * 0.62;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h * 0.42;
      if (card.animal === 'locked') {
        text(ctx, t('char.locked'), cx, cy, { size: iconSize * 0.7, color: COLORS.textSoft });
        text(ctx, t('char.locked.hint'), cx, r.y + r.h * 0.82, { size: Math.max(10, r.w * 0.09), color: COLORS.textSoft, weight: 'normal', maxWidth: r.w - 10 });
      } else if (card.animal === 'photo') {
        if (this.photoThumb) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, iconSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(this.photoThumb, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, iconSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#F7E3EA';
          ctx.fill();
          text(ctx, '📷', cx, cy, { size: iconSize * 0.5 });
        }
        text(ctx, t('common.photo'), cx, r.y + r.h * 0.82, { size: Math.max(11, r.w * 0.12), color: COLORS.text, maxWidth: r.w - 10 });
      } else {
        const face = this.faces.get(card.animal);
        if (face) ctx.drawImage(face, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
        else {
          ctx.beginPath();
          ctx.arc(cx, cy, iconSize / 2.5, 0, Math.PI * 2);
          ctx.fillStyle = PALETTES[card.animal].body;
          ctx.fill();
        }
        text(ctx, t(`char.${card.animal}`), cx, r.y + r.h * 0.8, { size: Math.max(11, r.w * 0.13), color: COLORS.text, maxWidth: r.w - 10 });
        text(ctx, t(`char.${card.animal}.kind`), cx, r.y + r.h * 0.91, { size: Math.max(9, r.w * 0.09), color: COLORS.textSoft, weight: 'normal', maxWidth: r.w - 10 });
      }
      ctx.restore();
    }
    if (this.lockedHint > 0) {
      ctx.globalAlpha = Math.min(1, this.lockedHint / 300);
      text(ctx, t('char.locked.hint'), this.w / 2, this.safe.y + this.safe.h - 30 * u, { size: 14 * u, color: COLORS.textSoft, weight: 'normal' });
      ctx.globalAlpha = 1;
    }
    this.buttons.draw(ctx);
  }

  onPointerDown(p: PointerPos): void {
    super.onPointerDown(p);
    this.pressedCard = this.cards.find((c) => inRect(p, c.rect)) ?? null;
  }
  onPointerUp(): void {
    super.onPointerUp();
    this.pressedCard = null;
  }

  onTap(p: PointerPos): void {
    if (this.leaving) return;
    if (this.buttons.tap(p)) {
      this.g.sfx.play('button');
      return;
    }
    const card = this.cards.find((c) => inRect(p, c.rect));
    if (!card) return;
    this.g.sfx.play('button');
    if (card.animal === 'locked') {
      this.lockedHint = 1800;
      return;
    }
    if (card.animal === 'photo') {
      void import('./photo').then(({ PhotoScene }) => this.g.go(new PhotoScene(this.g, this.draft, this.idx)));
      return;
    }
    this.player.animal = card.animal;
    this.player.photo = null;
    card.bounce = 0;
    this.leaving = true;
    this.tweens.to({}, {}, 380, { onComplete: () => this.next() });
  }

  next(): void {
    if (this.idx === 0 && this.draft.opponent === 'human') {
      this.g.go(new CharSelectScene(this.g, this.draft, 1));
      return;
    }
    if (this.draft.mode === 'classic') this.g.go(new DifficultyScene(this.g, this.draft));
    else this.g.go(new RewardSelectScene(this.g, this.draft, 0));
  }
}
