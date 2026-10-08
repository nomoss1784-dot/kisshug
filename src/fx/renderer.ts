/**
 * Draws SpriteState lists from the fx engine onto a canvas. Pose sprites are
 * character images (feet at x,y; scale/rotate about the feet). Overlays are
 * attached to anchors from anchors.json and inherit the character's pose
 * transform, so blush/blink/hearts follow the squash and hops.
 */
import type { AnchorName, OverlaySprite, PoseSprite, SpriteState, Who } from './types';
import type { CharacterArt } from '../art/characters';
import { heart, sparkle, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';

export interface CharacterView {
  art: CharacterArt;
  /** +1 faces right (images are drawn facing right), -1 flips horizontally. */
  facing: 1 | -1;
}

export interface Cast {
  actor: CharacterView;
  target: CharacterView;
  /** Rendered character height in px. */
  charHeight: number;
}

function anchorPoint(view: CharacterView, pose: PoseSprite['pose'], name: AnchorName, index = 0): { x: number; y: number } {
  const a = view.art.anchors.poses[pose];
  switch (name) {
    case 'head':
      return a.head;
    case 'forehead':
      return a.forehead;
    case 'eyes':
      return a.eyes[index];
    case 'cheeks':
      return a.cheeks[index];
    case 'top':
      return a.top;
  }
}

/** Applies a pose sprite's transform: origin at the feet, image px → screen px. */
function applyPoseTransform(ctx: Ctx, s: PoseSprite, view: CharacterView, charHeight: number): number {
  const scale = charHeight / view.art.anchors.canvas;
  ctx.translate(s.x, s.y);
  ctx.rotate((s.rot * Math.PI) / 180);
  ctx.scale(s.sx * scale * view.facing, s.sy * scale);
  ctx.translate(-view.art.anchors.feet.x, -view.art.anchors.feet.y);
  return scale;
}

export function drawSprites(ctx: Ctx, sprites: SpriteState[], cast: Cast): void {
  // The most visible pose per character defines where its overlays attach.
  const lead: Record<Who, PoseSprite | null> = { actor: null, target: null };
  for (const s of sprites) if (s.kind === 'pose' && (!lead[s.who] || s.opacity > lead[s.who]!.opacity)) lead[s.who] = s;
  const sorted = [...sprites].sort((a, b) => a.z - b.z);
  for (const s of sorted) {
    if (s.opacity <= 0) continue;
    const view = cast[s.kind === 'pose' ? s.who : s.attach.who];
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.opacity);
    if (s.kind === 'pose') {
      applyPoseTransform(ctx, s, view, cast.charHeight);
      const img = view.art.poses[s.pose];
      ctx.drawImage(img, 0, 0, view.art.anchors.canvas, view.art.anchors.canvas);
    } else {
      const base = lead[s.attach.who];
      if (base) drawOverlay(ctx, s, base, view, cast.charHeight);
    }
    ctx.restore();
  }
}

function drawOverlay(ctx: Ctx, s: OverlaySprite, base: PoseSprite, view: CharacterView, charHeight: number): void {
  const scale = applyPoseTransform(ctx, { ...base, opacity: 1 }, view, charHeight);
  const px = 1 / scale; // screen px → image px
  const canvas = view.art.anchors.canvas;
  const a = view.art.anchors.poses[base.pose];
  switch (s.kind) {
    case 'blush': {
      for (const c of a.cheeks) {
        ctx.save();
        ctx.translate(c.x + s.x * px, c.y + s.y * px);
        ctx.scale(s.sx, s.sy);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, canvas * 0.08);
        g.addColorStop(0, 'rgba(255,110,150,0.85)');
        g.addColorStop(1, 'rgba(255,110,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, canvas * 0.08, canvas * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    case 'blink': {
      // Blink image: 200x100 with eyes at x=52 and x=148 → map onto the two eye anchors.
      const [l, r] = a.eyes;
      const dist = Math.hypot(r.x - l.x, r.y - l.y) || 1;
      const k = dist / 96;
      ctx.translate(l.x + s.x * px, l.y + s.y * px);
      ctx.rotate(Math.atan2(r.y - l.y, r.x - l.x));
      ctx.scale(k * s.sx, k * s.sy);
      ctx.drawImage(view.art.blink, -52, -50, 200, 100);
      return;
    }
    case 'heart':
    case 'sparkle': {
      const p = anchorPoint(view, base.pose, s.attach.anchor);
      ctx.translate(p.x + s.x * px, p.y + s.y * px);
      // Undo the character flip so hearts keep their shape, keep scale.
      ctx.scale(view.facing, 1);
      ctx.rotate((s.rot * Math.PI) / 180);
      ctx.scale(s.sx, s.sy);
      const size = (s.size ?? charHeight * 0.1) * px;
      if (s.kind === 'heart') heart(ctx, 0, -size / 2, size, COLORS.heart, 1);
      else sparkle(ctx, 0, 0, size * 0.6, COLORS.accent, 1);
      return;
    }
  }
}

/** Static badge (classic mode X/O on the forehead) for the lead pose of a character. */
export function drawForeheadBadge(ctx: Ctx, sprites: SpriteState[], who: Who, cast: Cast, draw: (ctx: Ctx, size: number) => void): void {
  let base: PoseSprite | null = null;
  for (const s of sprites) if (s.kind === 'pose' && s.who === who && (!base || s.opacity > base.opacity)) base = s;
  if (!base) return;
  const view = cast[who];
  ctx.save();
  ctx.globalAlpha = 1;
  applyPoseTransform(ctx, { ...base, opacity: 1 }, view, cast.charHeight);
  const f = view.art.anchors.poses[base.pose].forehead;
  ctx.translate(f.x, f.y);
  ctx.scale(view.facing, 1);
  draw(ctx, view.art.anchors.canvas * 0.13);
  ctx.restore();
}
