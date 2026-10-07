import type { ClipDef, Keyframe, Pose, PoseProps, RigDef } from './types';
import { identityPose } from './types';
import type { Skin } from './assets';
import type { AnimalId } from '../state/types';
import { COLORS } from '../ui/theme';
import type { Ctx } from '../ui/draw';

interface Playing {
  clip: ClipDef;
  name: string;
  time: number;
  additive: boolean;
  onEnd?: () => void;
  ended: boolean;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function sampleTrack(track: Keyframe[], time: number): PoseProps {
  if (track.length === 0) return {};
  if (time <= track[0][0]) return track[0][1];
  const last = track[track.length - 1];
  if (time >= last[0]) return last[1];
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, a] = track[i];
    const [t1, b] = track[i + 1];
    if (time >= t0 && time <= t1) {
      const p = smooth((time - t0) / (t1 - t0 || 1));
      const lerp = (k: keyof PoseProps, def: number) => {
        const va = a[k] ?? def;
        const vb = b[k] ?? def;
        return va + (vb - va) * p;
      };
      return { rot: lerp('rot', 0), x: lerp('x', 0), y: lerp('y', 0), sx: lerp('sx', 1), sy: lerp('sy', 1) };
    }
  }
  return {};
}

/**
 * Plays rig clips for one character and draws it. The base clip defines the
 * pose; additive overlays (animal flair) are summed on top. Blush and hearts
 * are overlays drawn on the head so photo heads can emote too.
 */
export class RigPlayer {
  private base: Playing | null = null;
  private overlays: Playing[] = [];
  blush = false;
  /** Screen-space transform set by the scene. */
  x = 0;
  groundY = 0;
  height = 200;
  facing: 1 | -1 = 1;
  alpha = 1;
  private worldPoints = new Map<string, { x: number; y: number }>();

  constructor(public rig: RigDef, public skin: Skin, public animal: AnimalId) {
    this.play('idle');
  }

  play(name: string, onEnd?: () => void): void {
    const clip = this.rig.clips[name];
    if (!clip) return;
    this.base = { clip, name, time: 0, additive: false, onEnd, ended: false };
  }

  get current(): string {
    return this.base?.name ?? '';
  }

  addOverlay(name: string, onEnd?: () => void): void {
    const clip = this.rig.clips[name];
    if (!clip) return;
    this.overlays = this.overlays.filter((o) => o.name !== name);
    this.overlays.push({ clip, name, time: 0, additive: true, onEnd, ended: false });
  }

  clearOverlays(): void {
    this.overlays = [];
  }

  update(dt: number): void {
    const step = (p: Playing) => {
      if (p.ended) return;
      p.time += dt;
      if (p.time >= p.clip.duration) {
        if (p.clip.loop) p.time %= p.clip.duration;
        else {
          p.time = p.clip.duration;
          p.ended = true;
          p.onEnd?.();
        }
      }
    };
    if (this.base) step(this.base);
    this.overlays.forEach(step);
  }

  /** Final pose for a part: animal default + base clip + additive overlays. */
  private poseOf(part: string): Pose {
    const pose = identityPose();
    const def = this.rig.animalPose[this.animal]?.[part];
    if (def) {
      pose.rot += def.rot ?? 0;
      pose.x += def.x ?? 0;
      pose.y += def.y ?? 0;
    }
    const apply = (p: Playing) => {
      const track = p.clip.tracks[part];
      if (!track) return;
      const s = sampleTrack(track, p.time);
      pose.rot += s.rot ?? 0;
      pose.x += s.x ?? 0;
      pose.y += s.y ?? 0;
      pose.sx *= s.sx ?? 1;
      pose.sy *= s.sy ?? 1;
    };
    if (this.base) apply(this.base);
    this.overlays.forEach(apply);
    return pose;
  }

  /** Screen position of a part's pivot after the last draw(). */
  point(part: string): { x: number; y: number } {
    return this.worldPoints.get(part) ?? { x: this.x, y: this.groundY };
  }

  /** Approximate screen position of the head centre (for hearts/blush). */
  headCenter(): { x: number; y: number } {
    return this.point('head_center');
  }

  scale(): number {
    return this.height / this.rig.height;
  }

  draw(ctx: Ctx): void {
    const rig = this.rig;
    const s = this.scale();
    const root = this.poseOf('root');
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x + root.x * s, this.groundY - rig.groundOffset * s + root.y * s);
    // Lean around the feet: rotate about the ground point.
    ctx.translate(0, rig.groundOffset * s);
    ctx.rotate((root.rot * Math.PI) / 180 * this.facing);
    ctx.scale(this.facing * s * root.sx, s * root.sy);
    ctx.translate(0, -rig.groundOffset);

    // Compute world matrices by walking parents.
    const order = Object.keys(rig.parts).sort((a, b) => rig.parts[a].z - rig.parts[b].z);
    const matrices = new Map<string, DOMMatrix>();
    const matrixFor = (name: string): DOMMatrix => {
      const cached = matrices.get(name);
      if (cached) return cached;
      const def = rig.parts[name];
      const pose = this.poseOf(name);
      let m = new DOMMatrix();
      if (def.parent) {
        const pm = matrixFor(def.parent);
        const pdef = rig.parts[def.parent];
        m = pm.translate(def.attach[0] - pdef.pivot[0], def.attach[1] - pdef.pivot[1]);
      }
      m = m.translate(pose.x, pose.y).rotate(pose.rot).scale(pose.sx, pose.sy);
      matrices.set(name, m);
      return m;
    };
    const baseTransform = ctx.getTransform();
    for (const name of order) {
      // Photo heads are human faces: no animal ears or tail (SPEC §6.4 emotes via overlays instead).
      if (this.skin.photoHead && (name === 'ear_l' || name === 'ear_r' || name === 'tail')) continue;
      const def = rig.parts[name];
      const m = matrixFor(name);
      ctx.setTransform(baseTransform.multiply(m));
      const px = m.e;
      const py = m.f;
      const wp = baseTransform.transformPoint(new DOMPoint(px, py));
      this.worldPoints.set(name, { x: wp.x, y: wp.y });
      const img = name === 'head' && this.blush && !this.skin.photoHead ? this.skin.headBlush : this.skin.parts[name];
      if (name === 'head' && this.skin.photoHead) {
        // Photo head: draw the circular photo at the head circle.
        const [hcx, hcy] = rig.headCenter;
        const r = rig.headRadius;
        const cx = hcx - def.pivot[0];
        const cy = hcy - def.pivot[1];
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = '#5A3A48';
        ctx.fill();
        ctx.drawImage(this.skin.photoHead, cx - r, cy - r, r * 2, r * 2);
        if (this.blush) {
          ctx.fillStyle = COLORS.blush;
          ctx.beginPath();
          ctx.ellipse(cx - r * 0.5, cy + r * 0.25, r * 0.2, r * 0.11, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + r * 0.5, cy + r * 0.25, r * 0.2, r * 0.11, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const hc = baseTransform.multiply(m).transformPoint(new DOMPoint(cx, cy));
        this.worldPoints.set('head_center', { x: hc.x, y: hc.y });
      } else {
        ctx.drawImage(img, -def.pivot[0], -def.pivot[1], def.size[0], def.size[1]);
        if (name === 'head') {
          const [hcx, hcy] = rig.headCenter;
          const hc = baseTransform.multiply(m).transformPoint(new DOMPoint(hcx - def.pivot[0], hcy - def.pivot[1]));
          this.worldPoints.set('head_center', { x: hc.x, y: hc.y });
        }
      }
      if (name === 'tail') {
        const tip = baseTransform.multiply(m).transformPoint(new DOMPoint(200 - def.pivot[0], 100 - def.pivot[1]));
        this.worldPoints.set('tail_tip', { x: tip.x, y: tip.y });
      }
    }
    ctx.restore();
  }
}
