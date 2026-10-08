import { clamp01, easeInOut, easeOut, lerp, mulberry32, overshoot } from './ease';
import { fade, track } from './track';
import type { CeremonyKind, CeremonyLayout, OverlaySprite, Pose, SpriteState, Timeline, Transform, Who } from './types';

const easeIn = (t: number) => t ** 3;

/** One 320ms hop, including its subsequent landing squash/recovery. */
function hop(t: number, count: number, height: number): { y: number; sx: number; sy: number } {
  const end = count * 320;
  if (t < end) {
    const phase = t % 320;
    const y = phase < 160 ? -height * easeOut(phase / 160) : -height * (1 - easeIn((phase - 160) / 160));
    // The first landing's squash overlaps the next hop without moving its feet.
    const recover = t >= 320 ? fade(410, 570)(t) : 1;
    const amount = t >= 320 ? 1 - overshoot(recover) : 0;
    return { y, sx: 1 + 0.08 * amount, sy: 1 - 0.08 * amount };
  }
  const amount = 1 - overshoot(fade(end + 90, end + 250)(t));
  return { y: 0, sx: 1 + 0.08 * amount, sy: 1 - 0.08 * amount };
}

export function buildCeremony(kind: CeremonyKind, layout: CeremonyLayout): Timeline {
  const shake = kind === 'shake';
  const duration = shake ? 1800 : 2500;
  const approachEnd = shake ? 320 : 640;
  const finishStart = duration - 250;
  const h = layout.charHeight;
  const midpoint = (layout.actorX + layout.targetX) / 2;
  const actorEnd = shake ? midpoint - layout.dir * 0.3 * h
    : layout.targetX - layout.dir * (kind === 'hug' ? 0.42 : 0.55) * h;
  const targetEnd = shake ? midpoint + layout.dir * 0.3 * h : layout.targetX;
  const random = mulberry32(layout.seed ?? 1);
  const particles: Array<{ kind: 'heart' | 'sparkle'; who: Who; id: string; size: number; x: number; start: number; life: number }> = [];
  const add = (particleKind: 'heart' | 'sparkle', count: number, who: Who, start: number, life: number) => {
    for (let i = 0; i < count; i++) {
      const index = particles.filter(p => p.kind === particleKind).length;
      particles.push({ kind: particleKind, who, id: `${particleKind}:${index}`,
        size: h * (particleKind === 'heart' ? lerp(0.08, 0.14, random()) : lerp(0.05, 0.09, random())),
        x: (random() * 0.4 - 0.2) * h, start: start + random() * 350, life });
      // Stagger within the fixed effect window so its trailing hold stays clear.
      const particle = particles[particles.length - 1];
      particle.life = start + life - particle.start;
    }
  };
  if (kind === 'kiss') add('heart', 4, 'target', 950, 1200);
  if (kind === 'hug') {
    add('heart', 3, 'target', 1000, 1200);
    add('sparkle', 3, 'target', 1000, 1200);
  }
  if (shake) {
    add('sparkle', 2, 'actor', 800, 700);
    add('sparkle', 2, 'target', 800, 700);
  }
  const special: Record<Who, Pose> = { actor: shake ? 'handshake' : kind === 'kiss' ? 'kiss_give' : 'hug_give',
    target: shake ? 'handshake' : kind === 'kiss' ? 'kiss_receive' : 'hug_receive' };
  return { duration, loop: false, sample(time) {
    const t = Math.max(0, Math.min(duration, time));
    const sprites: SpriteState[] = [];
    for (const who of ['actor', 'target'] as Who[]) {
      const moving = who === 'actor' || shake;
      const motion = moving ? hop(t, shake ? 1 : 2, 0.12 * h) : { y: 0, sx: 1, sy: 1 };
      let { sx, sy } = motion;
      let y = layout.groundY + motion.y;
      if (kind === 'hug' && t >= 900 && t < 1600) {
        const squeeze = track([[0, 1, easeInOut], [175, 0.94, easeInOut], [350, 1]])((t - 900) % 350);
        sx = sy = squeeze;
      }
      if (shake && t >= 600 && t < 1300) {
        y += track([[0, 0, easeInOut], [175, -0.03 * h, easeInOut], [350, 0]])((t - 600) % 350);
      }
      const transform: Transform = {
        x: lerp(who === 'actor' ? layout.actorX : layout.targetX, who === 'actor' ? actorEnd : targetEnd, fade(0, approachEnd)(t)),
        y, sx, sy, rot: 0, opacity: 1,
      };
      const entered = fade(approachEnd, approachEnd + 250)(t);
      const happy = fade(finishStart, duration)(t);
      const poses: Array<[Pose, number]> = t < finishStart
        ? [['idle', 1 - entered], [special[who], entered]] : [[special[who], 1 - happy], ['happy', happy]];
      for (const [pose, opacity] of poses) {
        if (opacity > 0) sprites.push({ ...transform, id: `${who}:${pose}`, kind: 'pose', who, pose,
          z: who === 'actor' && pose === 'hug_give' ? 12 : 10, opacity });
      }
    }
    if (!shake) {
      const opacity = fade(900, 1100)(t) * (1 - fade(finishStart, duration)(t));
      if (opacity > 0) sprites.push({ id: 'target:blush', kind: 'blush', z: 20,
        attach: { who: 'target', anchor: 'cheeks' }, x: 0, y: 0, sx: 1, sy: 1, rot: 0, opacity });
    }
    for (const p of particles) {
      const age = t - p.start;
      if (age < 0 || age >= p.life) continue;
      // A final fade also retires staggered particles before the happy endpoint.
      const opacity = fade(0, 150)(age) * (1 - fade(p.life - 400, p.life)(age)) * (1 - fade(finishStart, duration)(t));
      if (opacity <= 0) continue;
      const progress = easeOut(clamp01(age / p.life));
      const sprite: OverlaySprite = { id: p.id, kind: p.kind, z: 30, attach: { who: p.who, anchor: 'top' }, size: p.size,
        x: p.x, y: -0.45 * h * progress, sx: lerp(0.6, 1, progress), sy: lerp(0.6, 1, progress),
        rot: p.kind === 'sparkle' ? 180 * progress : 0, opacity };
      sprites.push(sprite);
    }
    return sprites;
  } };
}
