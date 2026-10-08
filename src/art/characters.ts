/**
 * Character art loader (SPEC §6.3). For each pose slot it uses the real image
 * from assets/characters/<animal>/ when one exists (see art-manifest), else the
 * plush SVG fallback. Photo-mode bodies get the cropped face composited at the
 * head anchor. Only the two characters of the current match are loaded.
 */
import type { Pose } from '../fx/types';
import { POSES } from '../fx/types';
import manifest from '../generated/art-manifest.json';
import catAnchors from '../../assets/characters/cat/anchors.json';
import dogAnchors from '../../assets/characters/dog/anchors.json';
import rabbitAnchors from '../../assets/characters/rabbit/anchors.json';
import bearAnchors from '../../assets/characters/bear/anchors.json';
import photoAnchors from '../../assets/characters/photo/anchors.json';
import { blinkSvg, PALETTES, plushFaceSvg, plushSvg, shiftPalette, type ArtAnimal, type CharacterAnchors, type Palette } from './plush';
import { hueShiftImage, tintImage } from '../ui/draw';

export type Drawable = HTMLImageElement | HTMLCanvasElement;
type Slot = Pose | 'face';

export interface ArtSpec {
  animal: ArtAnimal;
  /** Degrees; used when both players picked the same animal. */
  hueShift: number;
  /** Photo mode: 256x256 circular PNG data URL. */
  photo: string | null;
  /** Photo mode body colour (pastel). */
  bodyColor?: string;
}

export interface CharacterArt {
  spec: ArtSpec;
  anchors: CharacterAnchors;
  poses: Record<Pose, Drawable>;
  face: Drawable;
  blink: Drawable;
  palette: Palette;
  /** True when at least one slot came from a real image file. */
  hasRealArt: boolean;
}

const ANCHORS: Record<ArtAnimal | 'photo', CharacterAnchors> = {
  cat: catAnchors as CharacterAnchors,
  dog: dogAnchors as CharacterAnchors,
  rabbit: rabbitAnchors as CharacterAnchors,
  bear: bearAnchors as CharacterAnchors,
  photo: photoAnchors as CharacterAnchors,
};

const BASE = import.meta.env.BASE_URL;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`image failed: ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

export function svgImage(svg: string): Promise<HTMLImageElement> {
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

const artCache = new Map<string, Promise<CharacterArt>>();

export function artKey(s: ArtSpec): string {
  return `${s.animal}|${s.hueShift}|${s.bodyColor ?? ''}|${s.photo ? s.photo.length + ':' + s.photo.slice(-24) : ''}`;
}

export function loadCharacterArt(spec: ArtSpec): Promise<CharacterArt> {
  const key = artKey(spec);
  let p = artCache.get(key);
  if (!p) {
    p = buildArt(spec).catch((e) => {
      artCache.delete(key);
      throw e;
    });
    artCache.set(key, p);
  }
  return p;
}

/** Quick face-only load for selection screens (all four animals). */
export function loadFace(animal: ArtAnimal): Promise<Drawable> {
  return loadCharacterArt({ animal, hueShift: 0, photo: null }).then((a) => a.face);
}

type Manifest = Record<string, Partial<Record<Slot, string>>>;

async function slotImage(who: ArtAnimal | 'photo', slot: Slot, fallback: () => string): Promise<{ img: HTMLImageElement; real: boolean }> {
  const file = (manifest as Manifest)[who]?.[slot];
  if (file) {
    try {
      return { img: await loadImage(BASE + file), real: true };
    } catch {
      /* fall through to the vector fallback */
    }
  }
  return { img: await svgImage(fallback()), real: false };
}

async function buildArt(spec: ArtSpec): Promise<CharacterArt> {
  const photoMode = !!spec.photo;
  const who: ArtAnimal | 'photo' = photoMode ? 'photo' : spec.animal;
  const anchors = ANCHORS[who];
  const basePal = photoMode ? { ...PALETTES.rabbit, body: spec.bodyColor ?? '#F9C6D3', inner: '#FFFFFF' } : PALETTES[spec.animal];
  const palette = shiftPalette(basePal, spec.hueShift);
  let hasRealArt = false;
  const poses = {} as Record<Pose, Drawable>;
  const photoImg = photoMode ? await loadImage(spec.photo!) : null;
  const results = await Promise.all(POSES.map((pose) => slotImage(who, pose, () => plushSvg(spec.animal, pose, palette, photoMode))));
  results.forEach(({ img, real }, i) => {
    const pose = POSES[i];
    hasRealArt ||= real;
    let d: Drawable = img;
    if (real && spec.hueShift) d = hueShiftImage(img, spec.hueShift);
    if (real && photoMode && spec.bodyColor) d = tintImage(d, spec.bodyColor);
    if (photoImg) d = compositePhoto(d, photoImg, anchors.poses[pose].head);
    poses[pose] = d;
  });
  let face: Drawable;
  if (photoImg) face = photoImg;
  else {
    const f = await slotImage(who, 'face', () => plushFaceSvg(spec.animal, palette));
    hasRealArt ||= f.real;
    face = f.real && spec.hueShift ? hueShiftImage(f.img, spec.hueShift) : f.img;
  }
  const blink = await svgImage(blinkSvg(photoMode ? '#F3D9C6' : palette.body, palette.dark, anchors.eyeWidth));
  return { spec, anchors, poses, face, blink, palette, hasRealArt };
}

/** Draws the circular photo into the head slot of a body image. */
function compositePhoto(body: Drawable, photo: HTMLImageElement, head: { x: number; y: number; r: number }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = body.width;
  c.height = body.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(body, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.arc(head.x, head.y, head.r * 0.96, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(photo, head.x - head.r, head.y - head.r, head.r * 2, head.r * 2);
  ctx.restore();
  return c;
}
