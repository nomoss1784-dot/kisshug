import { clamp01, lerp, linear } from './ease';
import type { Ease } from './types';

/** Easing on a key controls the segment beginning at that key. */
export function track(keys: Array<[number, number, Ease?]>): (t: number) => number {
  if (!keys.length) throw new Error('A track requires at least one key');
  const sorted = keys.map(key => [...key] as [number, number, Ease?]).sort((a, b) => a[0] - b[0]);
  return t => {
    if (t <= sorted[0][0]) return sorted[0][1];
    for (let i = 1; i < sorted.length; i++) {
      const [start, value, ease = linear] = sorted[i - 1];
      const [end, next] = sorted[i];
      if (t < end) return lerp(value, next, ease(clamp01((t - start) / (end - start))));
    }
    return sorted[sorted.length - 1][1];
  };
}

export const fade = (fromT: number, toT: number): ((t: number) => number) =>
  toT <= fromT ? t => t < fromT ? 0 : 1 : track([[fromT, 0], [toT, 1]]);
