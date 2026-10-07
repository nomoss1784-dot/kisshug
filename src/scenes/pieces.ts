import type { Ctx } from '../ui/draw';
import { circleMark, crossMark } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { Skin } from '../rig/assets';
import type { MatchConfig, PlayerConfig } from '../state/types';

/** Draws one board piece for a player: O/X (classic), animal icon, or photo face. */
export function drawPiece(ctx: Ctx, cfg: MatchConfig, p: PlayerConfig, skin: Skin | undefined, cx: number, cy: number, cell: number, scale = 1): void {
  const s = cell * scale;
  if (cfg.mode === 'classic') {
    const r = s * 0.3;
    const lw = Math.max(2, s * 0.11);
    if (p.mark === 'o') circleMark(ctx, cx, cy, r, skin?.color && cfg.level !== 'lv1' ? COLORS.o : COLORS.o, lw);
    else crossMark(ctx, cx, cy, r, COLORS.x, lw);
    return;
  }
  if (p.photo && skin?.photoHead) {
    const r = s * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = skin.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(skin.photoHead, cx - r * 0.92, cy - r * 0.92, r * 1.84, r * 1.84);
    ctx.restore();
    return;
  }
  if (!skin) {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = p.id === 1 ? COLORS.o : COLORS.x;
    ctx.fill();
    return;
  }
  if (cfg.level === 'lv1') {
    const d = s * 0.9;
    ctx.drawImage(skin.iconFull, cx - d / 2, cy - d / 2, d, d);
  } else {
    const d = s * 0.92;
    ctx.drawImage(skin.iconFace, cx - d / 2, cy - d / 2, d, d);
  }
}
