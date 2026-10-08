/**
 * Ceremony/idle animation contract (SPEC §6, image-pose edition).
 *
 * The engine is PURE: it turns a time (ms) into a list of sprite states. The
 * renderer draws pose images and overlays using ONLY these transform/opacity
 * properties, so everything stays GPU-friendly and testable.
 */

/** Pose image slots per character (SPEC §6.3). */
export type Pose = 'idle' | 'happy' | 'kiss_give' | 'kiss_receive' | 'hug_give' | 'hug_receive' | 'handshake';
export const POSES: Pose[] = ['idle', 'happy', 'kiss_give', 'kiss_receive', 'hug_give', 'hug_receive', 'handshake'];

export type CeremonyKind = 'kiss' | 'hug' | 'shake';

export type Who = 'actor' | 'target';

/** The ONLY animatable properties. Anything else on a sprite is static identity. */
export interface Transform {
  /** Screen px. For pose sprites: the feet point (bottom-centre of the image). For overlays: see `attach`. */
  x: number;
  y: number;
  /** Scale about the feet point (pose sprites) or about the overlay's own centre. */
  sx: number;
  sy: number;
  /** Degrees, clockwise, about the same pivot as the scale. */
  rot: number;
  /** 0..1 */
  opacity: number;
}
export const TRANSFORM_KEYS = ['x', 'y', 'sx', 'sy', 'rot', 'opacity'] as const;

export type OverlayKind = 'blush' | 'blink' | 'heart' | 'sparkle';

/** Anchor points on a character, resolved by the renderer from anchors.json. */
export type AnchorName = 'head' | 'forehead' | 'cheeks' | 'eyes' | 'top';

export interface SpriteBase {
  /** Stable id, e.g. "actor:idle", "target:kiss_receive", "heart:3". */
  id: string;
  /** Draw order (higher on top). */
  z: number;
}

export interface PoseSprite extends SpriteBase, Transform {
  kind: 'pose';
  who: Who;
  pose: Pose;
}

/**
 * Overlay attached to a character anchor. x/y are OFFSETS (px) from that anchor
 * in the character's local space; the renderer composes them with the
 * character's current pose transform. Hearts/sparkles usually use attach =
 * { who, anchor: 'top' } and drift upwards with growing y offsets (negative).
 */
export interface OverlaySprite extends SpriteBase, Transform {
  kind: OverlayKind;
  attach: { who: Who; anchor: AnchorName };
  /** Overlay size in px (hearts/sparkles). Static. */
  size?: number;
}

export type SpriteState = PoseSprite | OverlaySprite;

export interface Timeline {
  /** Total length in ms. For loops, the period. */
  duration: number;
  loop: boolean;
  /** Pure: same t → same states. t is clamped to [0, duration] for non-loops and wrapped for loops. */
  sample(t: number): SpriteState[];
}

/** Screen layout handed to the builders (all px). */
export interface CeremonyLayout {
  /** Feet x of the actor and target at the start. */
  actorX: number;
  targetX: number;
  /** Feet y (ground line). */
  groundY: number;
  /** Rendered character height in px (600px image scaled to this). */
  charHeight: number;
  /** +1 if the actor stands left of the target (moves right), -1 otherwise. */
  dir: 1 | -1;
  /** Deterministic randomness for heart/sparkle scatter. */
  seed?: number;
}

/** Easing: t in [0,1] → progress. */
export type Ease = (t: number) => number;
