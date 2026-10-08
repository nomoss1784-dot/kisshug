import { describe, expect, it } from 'vitest';
import { buildCeremony, buildIdle, easeOut, fade, mulberry32, overshoot, sampleClamped, track, TRANSFORM_KEYS } from '../src/fx';
import type { CeremonyKind, CeremonyLayout } from '../src/fx';

const layout: CeremonyLayout = { actorX: 100, targetX: 400, groundY: 500, charHeight: 200, dir: 1, seed: 1 };
const allowed = new Set<string>([...TRANSFORM_KEYS, 'id', 'z', 'kind', 'who', 'pose', 'attach', 'size']);

describe('pure ceremony timelines', () => {
  for (const kind of ['kiss', 'hug', 'shake'] as CeremonyKind[]) {
    it(`${kind} obeys the sprite contract through every transition`, () => {
      const tl = buildCeremony(kind, layout);
      expect(tl.duration).toBe(kind === 'shake' ? 1800 : 2500);
      const other = buildCeremony(kind, layout);
      for (const t of [...Array.from({ length: Math.ceil(tl.duration / 16) }, (_, i) => i * 16), tl.duration]) {
        const sprites = sampleClamped(tl, t);
        expect(sprites).toEqual(sampleClamped(other, t));
        expect(tl.sample(t)).toEqual(tl.sample(t));
        for (const sprite of sprites) {
          expect(Object.keys(sprite).every(key => allowed.has(key))).toBe(true);
          for (const key of TRANSFORM_KEYS) expect(Number.isFinite(sprite[key])).toBe(true);
          expect(sprite.opacity).toBeGreaterThanOrEqual(0);
          expect(sprite.opacity).toBeLessThanOrEqual(1);
          if (sprite.kind === 'pose') expect(sprite.y).toBeLessThanOrEqual(layout.groundY + 0.5);
        }
        for (const who of ['actor', 'target']) {
          const poses = sprites.filter(s => s.kind === 'pose' && s.who === who && s.opacity > 0);
          expect(poses.length).toBeLessThanOrEqual(2);
          const sum = poses.reduce((total, s) => total + s.opacity, 0);
          expect(sum).toBeGreaterThanOrEqual(0.98);
          expect(sum).toBeLessThanOrEqual(1.02);
          if (poses.length === 2) {
            for (const key of ['x', 'y', 'sx', 'sy', 'rot'] as const) expect(poses[0][key]).toBe(poses[1][key]);
          }
        }
        expect(sprites.map(s => s.z)).toEqual(sprites.map(s => s.z).sort((a, b) => a - b));
      }
      const end = sampleClamped(tl, tl.duration);
      expect(end).toHaveLength(2);
      for (const sprite of end) expect(sprite).toMatchObject({ kind: 'pose', pose: 'happy', opacity: 1, sx: 1, sy: 1, rot: 0 });
      expect(sampleClamped(tl, tl.duration + 999)).toEqual(end);
      expect(tl.sample(tl.duration + 999)).toEqual(tl.sample(tl.duration));
      expect(sampleClamped(tl, -100)).toEqual(sampleClamped(tl, 0));
    });
  }

  it('kiss hearts peak visibly and disappear at the endpoint', () => {
    const tl = buildCeremony('kiss', layout);
    const peaked = new Set<string>();
    for (let t = 0; t <= tl.duration; t += 16) {
      for (const s of tl.sample(t)) if (s.kind === 'heart' && s.opacity > 0.9) peaked.add(s.id);
    }
    expect(peaked.size).toBeGreaterThanOrEqual(3);
    expect(tl.sample(2150).filter(s => s.kind === 'heart')).toEqual([]);
    expect(tl.sample(tl.duration).filter(s => s.kind === 'heart' && s.opacity > 0)).toEqual([]);
  });

  it('supports reversed layouts and centres handshake feet', () => {
    const reversed = { ...layout, actorX: 400, targetX: 100, dir: -1 as const };
    const end = buildCeremony('shake', reversed).sample(1800);
    expect(end.find(s => s.kind === 'pose' && s.who === 'actor')?.x).toBe(310);
    expect(end.find(s => s.kind === 'pose' && s.who === 'target')?.x).toBe(190);
  });
});

describe('idle and interpolation helpers', () => {
  it('wraps idle and keeps feet grounded while breathing out of phase', () => {
    const tl = buildIdle(layout);
    expect(tl.duration).toBe(6400);
    expect(sampleClamped(tl, 6500)).toEqual(sampleClamped(tl, 100));
    expect(tl.sample(6500)).toEqual(tl.sample(100));
    expect(tl.sample(-100)).toEqual(tl.sample(6300));
    const poses = tl.sample(0).filter(s => s.kind === 'pose');
    expect(poses[0]).toMatchObject({ sx: 1, sy: 1, y: 500 });
    expect(poses[1]).toMatchObject({ sx: 0.985, sy: 1.035, y: 500 });
    expect(tl.sample(119).some(s => s.kind === 'blink')).toBe(true);
    expect(tl.sample(120).some(s => s.kind === 'blink')).toBe(false);
    expect(buildIdle(layout, { actorPose: 'happy', targetPose: 'handshake', blink: false }).sample(0)).toHaveLength(2);
  });

  it('solves the overshooting Bezier and holds keyframe endpoints', () => {
    expect(overshoot(0.5)).toBeGreaterThan(0.9);
    expect(overshoot(0.5)).toBeCloseTo(1.08740067, 6);
    expect(overshoot(1)).toBe(1);
    expect(easeOut(0)).toBe(0);
    const value = track([[0, 10, easeOut], [100, 20], [200, 40]]);
    expect(value(-1)).toBe(10);
    expect(value(50)).toBe(18.75);
    expect(value(150)).toBe(30);
    expect(value(300)).toBe(40);
    expect(fade(10, 20)(15)).toBe(0.5);
    const a = mulberry32(1), b = mulberry32(1);
    expect(Array.from({ length: 10 }, a)).toEqual(Array.from({ length: 10 }, b));
  });
});
