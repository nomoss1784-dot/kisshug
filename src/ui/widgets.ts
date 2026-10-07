import { COLORS } from './theme';
import { fillRoundRect, roundRect, text, type Ctx } from './draw';
import type { PointerPos } from './app';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inRect = (p: PointerPos, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export type ButtonStyle = 'primary' | 'secondary' | 'ghost' | 'danger' | 'choice' | 'choiceSelected';

export interface ButtonOpts {
  label: string;
  sub?: string;
  style?: ButtonStyle;
  fontSize?: number;
  onClick: () => void;
  enabled?: boolean;
  /** Custom icon drawer called with the content rect. */
  icon?: (ctx: Ctx, r: Rect) => void;
  /** Extra identifier for tests (drawn nowhere). */
  id?: string;
}

/** A tappable rounded button drawn on the canvas. */
export class Button {
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  pressed = false;
  constructor(public opts: ButtonOpts) {}

  set(x: number, y: number, w: number, h: number): this {
    this.rect = { x, y, w, h };
    return this;
  }

  get enabled(): boolean {
    return this.opts.enabled ?? true;
  }

  draw(ctx: Ctx): void {
    const r = this.rect;
    const style = this.opts.style ?? 'primary';
    const scale = this.pressed ? 0.96 : 1;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    const radius = Math.min(18, r.h / 2);
    let fill = COLORS.primary;
    let fg = '#FFFFFF';
    let stroke: string | null = null;
    if (style === 'secondary') fill = COLORS.secondary;
    if (style === 'ghost') {
      fill = 'rgba(255,255,255,0.85)';
      fg = COLORS.text;
      stroke = COLORS.boardLine;
    }
    if (style === 'danger') fill = '#E57373';
    if (style === 'choice') {
      fill = '#FFFFFF';
      fg = COLORS.text;
      stroke = COLORS.boardLine;
    }
    if (style === 'choiceSelected') {
      fill = '#FFE4EC';
      fg = COLORS.text;
      stroke = COLORS.primary;
    }
    if (!this.enabled) {
      fill = COLORS.disabled;
      fg = '#FFFFFF';
    }
    ctx.shadowColor = 'rgba(80,40,60,0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    fillRoundRect(ctx, r.x, r.y, r.w, r.h, radius, fill);
    ctx.shadowColor = 'transparent';
    if (stroke) {
      roundRect(ctx, r.x, r.y, r.w, r.h, radius);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = style === 'choiceSelected' ? 3 : 1.5;
      ctx.stroke();
    }
    const fs = this.opts.fontSize ?? Math.min(r.h * 0.42, 24);
    const hasSub = !!this.opts.sub;
    const cx = r.x + r.w / 2;
    if (this.opts.icon) {
      ctx.save();
      this.opts.icon(ctx, r);
      ctx.restore();
    }
    const subSize = fs * 0.62;
    const subLines = hasSub && this.opts.sub ? this.opts.sub.split('\n') : [];
    const totalH = fs + (hasSub ? subLines.length * subSize * 1.25 + 4 : 0);
    const topY = r.y + r.h / 2 - totalH / 2 + fs / 2;
    text(ctx, this.opts.label, cx, topY, { size: fs, color: fg, maxWidth: r.w - 20 });
    subLines.forEach((ln, i) => text(ctx, ln, cx, topY + fs / 2 + 4 + subSize * 0.7 + i * subSize * 1.25, { size: subSize, color: style === 'choice' || style === 'choiceSelected' || style === 'ghost' ? COLORS.textSoft : 'rgba(255,255,255,0.9)', weight: 'normal', maxWidth: r.w - 20 }));
    ctx.restore();
  }
}

/** Collects buttons for a scene and dispatches pointer events. */
export class ButtonGroup {
  buttons: Button[] = [];
  private pressedBtn: Button | null = null;

  add(b: Button): Button {
    this.buttons.push(b);
    return b;
  }
  clear(): void {
    this.buttons = [];
  }
  draw(ctx: Ctx): void {
    for (const b of this.buttons) b.draw(ctx);
  }
  down(p: PointerPos): void {
    this.pressedBtn = this.buttons.find((b) => b.enabled && inRect(p, b.rect)) ?? null;
    if (this.pressedBtn) this.pressedBtn.pressed = true;
  }
  move(p: PointerPos): void {
    if (this.pressedBtn && !inRect(p, this.pressedBtn.rect)) {
      this.pressedBtn.pressed = false;
      this.pressedBtn = null;
    }
  }
  up(): void {
    if (this.pressedBtn) this.pressedBtn.pressed = false;
    this.pressedBtn = null;
  }
  /** Returns true if a button consumed the tap. */
  tap(p: PointerPos): boolean {
    const b = this.buttons.find((bb) => bb.enabled && inRect(p, bb.rect));
    if (!b) return false;
    b.opts.onClick();
    return true;
  }
}

/** Layout helper: a responsive "unit" that scales UI by the smaller side. */
export function unit(w: number, h: number): number {
  return Math.max(0.55, Math.min(1.35, Math.min(w, h) / 420));
}

export function drawBack(ctx: Ctx, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 5, cy - 8);
  ctx.lineTo(cx - 4, cy);
  ctx.lineTo(cx + 5, cy + 8);
  ctx.stroke();
}

export function drawGear(ctx: Ctx, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const R = Math.min(r.w, r.h) * 0.3;
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7);
    ctx.lineTo(cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}
