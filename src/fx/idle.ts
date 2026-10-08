import { easeInOut } from './ease';
import { track } from './track';
import type { CeremonyLayout, Pose, SpriteState, Timeline, Who } from './types';

export function buildIdle(layout: CeremonyLayout, opts: { actorPose?: Pose; targetPose?: Pose; blink?: boolean } = {}): Timeline {
  const sx = track([[0, 1, easeInOut], [800, 0.985, easeInOut], [1600, 1]]);
  const sy = track([[0, 1, easeInOut], [800, 1.035, easeInOut], [1600, 1]]);
  return {
    duration: 6400, loop: true,
    sample(time) {
      const t = ((time % 6400) + 6400) % 6400;
      const sprites: SpriteState[] = [];
      for (const who of ['actor', 'target'] as Who[]) {
        const offset = who === 'actor' ? 0 : 800;
        const phase = (t + offset) % 1600;
        const pose = (who === 'actor' ? opts.actorPose : opts.targetPose) ?? 'idle';
        sprites.push({ id: `${who}:${pose}`, kind: 'pose', who, pose, z: 10,
          x: who === 'actor' ? layout.actorX : layout.targetX, y: layout.groundY,
          sx: sx(phase), sy: sy(phase), rot: 0, opacity: 1 });
        // Two blinks per period, with the characters blinking at different times.
        if (opts.blink !== false && (t + offset) % 3200 < 120) {
          sprites.push({ id: `${who}:blink`, kind: 'blink', z: 20,
            attach: { who, anchor: 'eyes' }, x: 0, y: 0, sx: 1, sy: 1, rot: 0, opacity: 1 });
        }
      }
      return sprites;
    },
  };
}
