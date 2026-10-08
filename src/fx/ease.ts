import type { Ease } from './types';

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const linear: Ease = t => t;
export const easeOut: Ease = t => 1 - (1 - t) ** 3;
export const easeInOut: Ease = t => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/** Solve the Bezier's x coordinate before evaluating y; y may exceed one. */
export const overshoot: Ease = t => {
  t = clamp01(t);
  if (t === 0 || t === 1) return t;
  const curve = (u: number, a: number, b: number) =>
    3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const error = curve(u, 0.34, 0.64) - t;
    if (Math.abs(error) < 1e-9) return curve(u, 1.56, 1);
    const derivative = 3 * (1 - u) ** 2 * 0.34 + 6 * (1 - u) * u * 0.30 + 3 * u * u * 0.36;
    const next = u - error / derivative;
    if (next < 0 || next > 1) break;
    u = next;
  }
  let low = 0, high = 1;
  for (let i = 0; i < 40; i++) {
    u = (low + high) / 2;
    if (curve(u, 0.34, 0.64) < t) low = u;
    else high = u;
  }
  return curve((low + high) / 2, 1.56, 1);
};

/** Randomness is consumed at build time, never while sampling. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
