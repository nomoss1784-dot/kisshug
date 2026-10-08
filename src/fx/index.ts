export * from './types';
export * from './ease';
export * from './track';
export * from './idle';
export * from './ceremony';
import type { SpriteState, Timeline } from './types';

/** Normalize time even for externally supplied timelines; sort a fresh array. */
export function sampleClamped(tl: Timeline, t: number): SpriteState[] {
  const time = tl.loop ? ((t % tl.duration) + tl.duration) % tl.duration : Math.max(0, Math.min(tl.duration, t));
  return [...tl.sample(time)].sort((a, b) => a.z - b.z);
}
