import type { Ctx } from '../ui/draw';
import { circleMark, crossMark } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { Drawable } from '../art/characters';
import type { MatchConfig, PlayerConfig } from '../state/types';

/** Vector X (pink) / O (blue) marks used by classic mode and as forehead badges. */
export function drawMark(ctx: Ctx, mark: 'o' | 'x', cx: number, cy: number, r: number, lw: number): void {
  if (mark === 'o') circleMark(ctx, cx, cy, r, COLORS.o, lw);
  else crossMark(ctx, cx, cy, r * 0.95, COLORS.x, lw);
}

/** Draws one board piece: classic = vector mark, otherwise the character's face (or photo). */
export function drawPiece(ctx: Ctx, cfg: MatchConfig, p: PlayerConfig, face: Drawable | undefined, cx: number, cy: number, cell: number, scale = 1): void {
  const s = cell * scale;
  if (cfg.mode === 'classic') {
    drawMark(ctx, p.mark, cx, cy, s * 0.3, Math.max(2, s * 0.11));
    return;
  }
  if (!face) {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = p.id === 1 ? COLORS.o : COLORS.x;
    ctx.fill();
    return;
  }
  const d = s * 0.92;
  if (p.photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, cx - d / 2, cy - d / 2, d, d);
    ctx.restore();
    return;
  }
  ctx.drawImage(face, cx - d / 2, cy - d / 2, d, d);
}
