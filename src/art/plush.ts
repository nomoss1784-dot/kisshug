/**
 * "Plush toy" vector fallback characters (SPEC §6). Used whenever a pose image
 * is missing from assets/characters/<animal>/. Each pose is an SVG string on a
 * 600x600 canvas with the feet at (300, 560); anchors are computed from the
 * same geometry so overlays (blush, blink, hearts, badges) line up.
 */
import type { Pose } from '../fx/types';
import { shiftHex } from '../ui/draw';

export type ArtAnimal = 'cat' | 'dog' | 'rabbit' | 'bear';
export const CANVAS = 600;
export const FEET = { x: 300, y: 560 };

export interface Palette {
  body: string;
  accent: string;
  inner: string;
  dark: string;
}

export const PALETTES: Record<ArtAnimal, Palette> = {
  cat: { body: '#F9E4BC', accent: '#F4A86A', inner: '#FFC4C4', dark: '#5A3A48' },
  dog: { body: '#E0B383', accent: '#B07B4A', inner: '#F5D1A8', dark: '#4E3322' },
  rabbit: { body: '#FFFFFF', accent: '#F7B9CC', inner: '#FFD3DE', dark: '#5A3A48' },
  bear: { body: '#AD7A52', accent: '#7C5233', inner: '#E8C9A8', dark: '#3E2718' },
};

export function shiftPalette(p: Palette, degrees: number): Palette {
  if (!degrees) return p;
  return { body: shiftHex(p.body, degrees), accent: shiftHex(p.accent, degrees), inner: shiftHex(p.inner, degrees), dark: p.dark };
}

/** Pose recipe: how the base figure is varied. */
interface PoseSpec {
  lean: number; // degrees about the feet, + leans right (towards the partner)
  headTilt: number;
  armL: number; // rotation of the left (back) arm, 0 = hanging down, negative = forward/up
  armR: number; // right (front) arm
  eyes: 'open' | 'closed' | 'wink';
  mouth: 'smile' | 'open' | 'pucker' | 'grin';
  blush: number; // 0..1
  bodyY: number; // vertical offset of the whole figure (negative = up)
}

const POSE_SPECS: Record<Pose, PoseSpec> = {
  idle: { lean: 0, headTilt: 0, armL: 0, armR: 0, eyes: 'open', mouth: 'smile', blush: 0.35, bodyY: 0 },
  happy: { lean: 0, headTilt: -4, armL: 150, armR: -150, eyes: 'open', mouth: 'open', blush: 0.6, bodyY: -6 },
  kiss_give: { lean: 9, headTilt: 6, armL: 25, armR: -35, eyes: 'wink', mouth: 'pucker', blush: 0.5, bodyY: 0 },
  kiss_receive: { lean: -6, headTilt: -5, armL: 110, armR: -110, eyes: 'closed', mouth: 'smile', blush: 1, bodyY: 0 },
  hug_give: { lean: 7, headTilt: 5, armL: -85, armR: -70, eyes: 'closed', mouth: 'grin', blush: 0.6, bodyY: 0 },
  hug_receive: { lean: -4, headTilt: -6, armL: 60, armR: -40, eyes: 'closed', mouth: 'open', blush: 1, bodyY: 0 },
  handshake: { lean: 4, headTilt: 3, armL: 10, armR: -95, eyes: 'open', mouth: 'grin', blush: 0.5, bodyY: 0 },
};

/** Base anchors (pose = idle, no lean). */
const BASE = {
  head: { x: 300, y: 215, r: 150 },
  forehead: { x: 300, y: 118 },
  eyes: [
    { x: 252, y: 226 },
    { x: 348, y: 226 },
  ],
  cheeks: [
    { x: 214, y: 272 },
    { x: 386, y: 272 },
  ],
  top: { x: 300, y: 50 },
};

export interface PoseAnchors {
  head: { x: number; y: number; r: number };
  forehead: { x: number; y: number };
  eyes: [{ x: number; y: number }, { x: number; y: number }];
  cheeks: [{ x: number; y: number }, { x: number; y: number }];
  top: { x: number; y: number };
}

export interface CharacterAnchors {
  $comment?: string;
  canvas: number;
  feet: { x: number; y: number };
  /** Colour used to paint eyelids over the eyes when blinking. */
  eyelid: string;
  /** Eye width in px (for the blink overlay). */
  eyeWidth: number;
  poses: Record<Pose, PoseAnchors>;
}

function rotAboutFeet(p: { x: number; y: number }, deg: number, dy: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - FEET.x;
  const dyy = p.y + dy - FEET.y;
  return { x: Math.round(FEET.x + dx * Math.cos(a) - dyy * Math.sin(a)), y: Math.round(FEET.y + dx * Math.sin(a) + dyy * Math.cos(a)) };
}

export function poseAnchors(pose: Pose): PoseAnchors {
  const s = POSE_SPECS[pose];
  const r = (p: { x: number; y: number }) => rotAboutFeet(p, s.lean, s.bodyY);
  return {
    head: { ...r(BASE.head), r: BASE.head.r },
    forehead: r(BASE.forehead),
    eyes: [r(BASE.eyes[0]), r(BASE.eyes[1])],
    cheeks: [r(BASE.cheeks[0]), r(BASE.cheeks[1])],
    top: r(BASE.top),
  };
}

export function defaultAnchors(eyelid: string): CharacterAnchors {
  const poses = {} as Record<Pose, PoseAnchors>;
  for (const p of Object.keys(POSE_SPECS) as Pose[]) poses[p] = poseAnchors(p);
  return {
    $comment: 'Pixel positions on the 600x600 pose images. feet = bottom-centre of the character (must match in every pose). head = centre/radius of the face circle (photo mode pastes the photo here). forehead = where the X/O badge sits in classic mode. eyes/cheeks = blink and blush overlays.',
    canvas: CANVAS,
    feet: { ...FEET },
    eyelid,
    eyeWidth: 46,
    poses,
  };
}

// ---------------------------------------------------------------------------
// SVG generation

function arm(x: number, y: number, deg: number, pal: Palette, len = 95): string {
  // A capsule (rounded rect) so the gradient has a proper bounding box in every rotation.
  return `<g transform="rotate(${deg} ${x} ${y})"><rect x="${x - 26}" y="${y - 26}" width="52" height="${len + 52}" rx="26" fill="url(#body)"/><rect x="${x - 26}" y="${y - 26}" width="52" height="${len + 52}" rx="26" fill="url(#shade)"/><circle cx="${x}" cy="${y + len}" r="27" fill="url(#body)"/><circle cx="${x}" cy="${y + len}" r="27" fill="${pal.dark}" opacity="0.08"/></g>`;
}

function ears(animal: ArtAnimal, pal: Palette): string {
  const L = 'M 215 118 Q 170 20 150 60 Q 135 100 190 150 Z';
  const R = 'M 385 118 Q 430 20 450 60 Q 465 100 410 150 Z';
  switch (animal) {
    case 'cat':
      return `<path d="${L}" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.25" stroke-width="3"/><path d="${R}" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.25" stroke-width="3"/><path d="M 205 118 Q 175 55 165 75 Q 160 100 192 132 Z" fill="${pal.inner}"/><path d="M 395 118 Q 425 55 435 75 Q 440 100 408 132 Z" fill="${pal.inner}"/>`;
    case 'dog':
      return `<ellipse cx="168" cy="190" rx="42" ry="88" transform="rotate(18 168 190)" fill="${pal.accent}" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/><ellipse cx="432" cy="190" rx="42" ry="88" transform="rotate(-18 432 190)" fill="${pal.accent}" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/>`;
    case 'rabbit':
      return `<ellipse cx="240" cy="40" rx="36" ry="105" transform="rotate(-8 240 40)" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/><ellipse cx="360" cy="40" rx="36" ry="105" transform="rotate(8 360 40)" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/><ellipse cx="242" cy="48" rx="18" ry="80" transform="rotate(-8 242 48)" fill="${pal.inner}"/><ellipse cx="358" cy="48" rx="18" ry="80" transform="rotate(8 358 48)" fill="${pal.inner}"/>`;
    case 'bear':
      return `<circle cx="190" cy="95" r="52" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/><circle cx="410" cy="95" r="52" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/><circle cx="190" cy="98" r="28" fill="${pal.inner}"/><circle cx="410" cy="98" r="28" fill="${pal.inner}"/>`;
  }
}

function tail(animal: ArtAnimal, pal: Palette): string {
  switch (animal) {
    case 'cat':
      return `<path d="M 200 470 C 120 470 100 400 150 380" stroke="url(#body)" stroke-width="34" fill="none" stroke-linecap="round"/><circle cx="150" cy="380" r="19" fill="${pal.accent}"/>`;
    case 'dog':
      return `<path d="M 205 455 C 150 440 140 390 165 372" stroke="url(#body)" stroke-width="30" fill="none" stroke-linecap="round"/>`;
    case 'rabbit':
      return `<circle cx="195" cy="480" r="34" fill="#FFFFFF" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/>`;
    case 'bear':
      return `<circle cx="198" cy="482" r="26" fill="url(#body)" stroke="${pal.dark}" stroke-opacity="0.2" stroke-width="3"/>`;
  }
}

function eyesSvg(spec: PoseSpec, pal: Palette): string {
  const open = (x: number, y: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="21" ry="26" fill="#2E1F2A"/><circle cx="${x - 7}" cy="${y - 9}" r="7.5" fill="#FFFFFF"/><circle cx="${x + 8}" cy="${y + 8}" r="3.5" fill="#FFFFFF" opacity="0.9"/>`;
  const closed = (x: number, y: number) => `<path d="M ${x - 22} ${y + 4} Q ${x} ${y - 20} ${x + 22} ${y + 4}" stroke="${pal.dark}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const [l, r] = BASE.eyes;
  if (spec.eyes === 'open') return open(l.x, l.y) + open(r.x, r.y);
  if (spec.eyes === 'closed') return closed(l.x, l.y) + closed(r.x, r.y);
  return open(l.x, l.y) + closed(r.x, r.y);
}

function mouthSvg(spec: PoseSpec, pal: Palette): string {
  const nose = `<ellipse cx="300" cy="262" rx="12" ry="8" fill="${pal.dark}" opacity="0.85"/>`;
  switch (spec.mouth) {
    case 'smile':
      return nose + `<path d="M 282 282 Q 300 296 318 282" stroke="${pal.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'grin':
      return nose + `<path d="M 272 280 Q 300 308 328 280" stroke="${pal.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'open':
      return nose + `<path d="M 274 282 Q 300 318 326 282 Z" fill="#B23A5A"/><path d="M 286 296 Q 300 306 314 296 Z" fill="#FF8AA8"/>`;
    case 'pucker':
      return nose + `<path d="M 304 290 c -3 -5 -11 -4 -11 3 c 0 5 6 9 11 13 c 5 -4 11 -8 11 -13 c 0 -7 -8 -8 -11 -3 z" fill="#E25C86" transform="translate(16 -4) scale(1.3)"/>`;
  }
}

/** Builds one pose as an SVG document string. `photo` = headless body for photo mode. */
export function plushSvg(animal: ArtAnimal, pose: Pose, pal: Palette, photo = false): string {
  const s = POSE_SPECS[pose];
  const defs = `<defs>
  <radialGradient id="body" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="45%" stop-color="${pal.body}"/><stop offset="100%" stop-color="${pal.body}" stop-opacity="1"/></radialGradient>
  <radialGradient id="shade" cx="50%" cy="50%" r="60%"><stop offset="60%" stop-color="${pal.dark}" stop-opacity="0"/><stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.28"/></radialGradient>
  <radialGradient id="cheek" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FF7D9E" stop-opacity="0.85"/><stop offset="100%" stop-color="#FF7D9E" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
</defs>`;
  const legs = `<ellipse cx="258" cy="540" rx="42" ry="24" fill="url(#body)"/><ellipse cx="342" cy="540" rx="42" ry="24" fill="url(#body)"/><ellipse cx="258" cy="540" rx="42" ry="24" fill="url(#shade)"/><ellipse cx="342" cy="540" rx="42" ry="24" fill="url(#shade)"/>`;
  const body = `<ellipse cx="300" cy="430" rx="112" ry="122" fill="url(#body)"/><ellipse cx="300" cy="430" rx="112" ry="122" fill="url(#shade)"/><ellipse cx="300" cy="455" rx="62" ry="72" fill="#FFFFFF" opacity="0.35"/>`;
  const headFill = photo ? pal.body : 'url(#body)';
  const head = `<circle cx="300" cy="215" r="150" fill="${headFill}"/><circle cx="300" cy="215" r="150" fill="url(#shade)"/>` + (photo ? `<circle cx="300" cy="215" r="150" fill="#FFFFFF" opacity="0.5"/><circle cx="300" cy="215" r="150" fill="none" stroke="${pal.dark}" stroke-opacity="0.15" stroke-width="4"/>` : '');
  const muzzle = photo ? '' : `<ellipse cx="300" cy="275" rx="70" ry="48" fill="#FFFFFF" opacity="0.4"/>`;
  const face = photo ? '' : eyesSvg(s, pal) + mouthSvg(s, pal);
  const blush = `<ellipse cx="214" cy="272" rx="40" ry="24" fill="url(#cheek)" opacity="${s.blush}"/><ellipse cx="386" cy="272" rx="40" ry="24" fill="url(#cheek)" opacity="${s.blush}"/>`;
  const extras = photo ? '' : ears(animal, pal);
  const tl = photo ? '' : tail(animal, pal);
  const headGroup = `<g transform="rotate(${s.headTilt} 300 330)">${extras}${head}${muzzle}${photo ? '' : blush}${face}</g>`;
  const figure = `<g transform="translate(0 ${s.bodyY}) rotate(${s.lean} ${FEET.x} ${FEET.y})">${tl}${arm(205, 372, s.armL, pal)}${legs}${body}${arm(395, 372, s.armR, pal)}${headGroup}</g>`;
  const shadow = `<ellipse cx="300" cy="560" rx="150" ry="18" fill="${pal.dark}" opacity="0.12" filter="url(#soft)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">${defs}${shadow}${figure}</svg>`;
}

/** Face icon (256x256): the head only, zoomed. */
export function plushFaceSvg(animal: ArtAnimal, pal: Palette): string {
  const inner = plushSvg(animal, 'idle', pal);
  // Reuse the full figure but crop to the head via viewBox.
  return inner.replace(`width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}"`, `width="256" height="256" viewBox="120 30 360 360"`);
}

/** Closed-eyelid overlay for blinking (fallback and PNG art alike). */
export function blinkSvg(eyelid: string, dark: string, eyeWidth: number): string {
  const w = eyeWidth / 2 + 6;
  const eye = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 1.25}" fill="${eyelid}"/><path d="M ${x - w + 4} ${y + 4} Q ${x} ${y - 16} ${x + w - 4} ${y + 4}" stroke="${dark}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${eye(52, 50)}${eye(148, 50)}</svg>`;
}
