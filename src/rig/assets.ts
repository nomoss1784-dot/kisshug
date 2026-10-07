import type { RigDef } from './types';
import type { AnimalId } from '../state/types';
import { ANIMAL_COLORS } from '../ui/theme';
import { hueShiftImage, shiftHex, tintImage } from '../ui/draw';

export type Drawable = HTMLImageElement | HTMLCanvasElement;

const BASE = import.meta.env.BASE_URL;
export const assetUrl = (rel: string): string => `${BASE}characters/${rel}`;

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

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo decode failed'));
    img.src = dataUrl;
  });
}

let rigPromise: Promise<RigDef> | null = null;
export function loadRig(): Promise<RigDef> {
  if (!rigPromise) rigPromise = fetch(assetUrl('_rig/rig.json')).then((r) => r.json() as Promise<RigDef>);
  return rigPromise;
}

/** What a character looks like: animal parts (+ optional hue shift) or a photo head. */
export interface SkinSpec {
  animal: AnimalId;
  hueShift: number;
  photo: string | null;
  /** Body colour override (photo mode pastel). */
  bodyColor?: string;
}

export interface Skin {
  spec: SkinSpec;
  parts: Record<string, Drawable>;
  headBlush: Drawable;
  /** Photo head (already circular) or null for animal heads. */
  photoHead: Drawable | null;
  iconFull: Drawable;
  iconFace: Drawable;
  color: string;
}

const skinCache = new Map<string, Promise<Skin>>();

export function skinKey(s: SkinSpec): string {
  return `${s.animal}|${s.hueShift}|${s.bodyColor ?? ''}|${s.photo ? s.photo.length + ':' + s.photo.slice(-32) : ''}`;
}

export async function loadSkin(rig: RigDef, spec: SkinSpec): Promise<Skin> {
  const key = skinKey(spec);
  let p = skinCache.get(key);
  if (!p) {
    p = buildSkin(rig, spec);
    skinCache.set(key, p);
  }
  return p;
}

async function buildSkin(rig: RigDef, spec: SkinSpec): Promise<Skin> {
  const pal = ANIMAL_COLORS[spec.animal];
  const bodyColor = spec.bodyColor ?? (spec.hueShift ? shiftHex(pal.body, spec.hueShift) : pal.body);
  const parts: Record<string, Drawable> = {};
  const entries = Object.entries(rig.parts);
  const images = await Promise.all(entries.map(([, def]) => loadImage(assetUrl(def.image.replace('{animal}', spec.animal)))));
  entries.forEach(([name, def], i) => {
    let img: Drawable = images[i];
    if (def.tint) img = tintImage(img, bodyColor);
    else if (spec.hueShift) img = hueShiftImage(img, spec.hueShift);
    parts[name] = img;
  });
  const [blushImg, iconFull, iconFace] = await Promise.all([
    loadImage(assetUrl(`${spec.animal}/head_blush.png`)),
    loadImage(assetUrl(`${spec.animal}/icon.png`)),
    loadImage(assetUrl(`${spec.animal}/icon_face.png`)),
  ]);
  const headBlush = spec.hueShift ? hueShiftImage(blushImg, spec.hueShift) : blushImg;
  let photoHead: Drawable | null = null;
  if (spec.photo) {
    try {
      photoHead = await loadImageFromDataUrl(spec.photo);
    } catch {
      photoHead = null;
    }
  }
  return {
    spec,
    parts,
    headBlush,
    photoHead,
    iconFull: spec.hueShift ? hueShiftImage(iconFull, spec.hueShift) : iconFull,
    iconFace: spec.hueShift ? hueShiftImage(iconFace, spec.hueShift) : iconFace,
    color: bodyColor,
  };
}
