import { COLORS, FONT } from './theme';

export type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function fillRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r = 18, color = COLORS.panel): void {
  ctx.save();
  ctx.shadowColor = COLORS.panelShadow;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  fillRoundRect(ctx, x, y, w, h, r, color);
  ctx.restore();
}

export function font(size: number, weight: 'normal' | 'bold' = 'bold'): string {
  return `${weight} ${Math.round(size)}px ${FONT}`;
}

export interface TextOpts {
  size: number;
  color?: string;
  weight?: 'normal' | 'bold';
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

export function text(ctx: Ctx, s: string, x: number, y: number, o: TextOpts): void {
  ctx.font = font(o.size, o.weight ?? 'bold');
  ctx.fillStyle = o.color ?? COLORS.text;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  if (o.maxWidth !== undefined && ctx.measureText(s).width > o.maxWidth) {
    ctx.fillText(s, x, y, o.maxWidth);
  } else {
    ctx.fillText(s, x, y);
  }
}

/** Word/character wrapping that works for Japanese (no spaces) and English. */
export function wrapLines(ctx: Ctx, s: string, maxWidth: number, size: number, weight: 'normal' | 'bold' = 'normal'): string[] {
  ctx.font = font(size, weight);
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const tokens = /\s/.test(para) ? para.split(/(\s+)/) : Array.from(para);
    let line = '';
    for (const tok of tokens) {
      const cand = line + tok;
      if (ctx.measureText(cand).width > maxWidth && line !== '') {
        out.push(line.trimEnd());
        line = tok.trimStart();
      } else {
        line = cand;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

export function textBlock(ctx: Ctx, s: string, x: number, y: number, maxWidth: number, o: TextOpts): number {
  const lines = wrapLines(ctx, s, maxWidth, o.size, o.weight ?? 'normal');
  const lh = o.size * 1.4;
  lines.forEach((ln, i) => text(ctx, ln, x, y + i * lh, o));
  return lines.length * lh;
}

export function heart(ctx: Ctx, x: number, y: number, size: number, color = COLORS.heart, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(0, 6, -4, -4, -12, -4);
  ctx.bezierCurveTo(-24, -4, -24, 10, -12, 18);
  ctx.bezierCurveTo(-6, 22, 0, 28, 0, 30);
  ctx.bezierCurveTo(0, 28, 6, 22, 12, 18);
  ctx.bezierCurveTo(24, 10, 24, -4, 12, -4);
  ctx.bezierCurveTo(4, -4, 0, 6, 0, 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function sparkle(ctx: Ctx, x: number, y: number, size: number, color = COLORS.accent, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * size * 0.3, Math.sin(a + Math.PI / 4) * size * 0.3);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function circleMark(ctx: Ctx, x: number, y: number, r: number, color: string, lw: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function crossMark(ctx: Ctx, x: number, y: number, r: number, color: string, lw: number): void {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Simple HSL hue rotation applied to an image once (fallback for ctx.filter). */
export function hueShiftImage(img: CanvasImageSource & { width: number; height: number }, degrees: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  if (degrees === 0) return c;
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height);
  } catch {
    return c; // tainted canvas (file://): skip the hue shift
  }
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    const [r, g, b] = hslToRgb((h + degrees / 360) % 1, s, l);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** Multiply-tint a (mostly white) image with a colour, keeping alpha. */
export function tintImage(img: CanvasImageSource & { width: number; height: number }, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  return c;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

export function shiftHex(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb((h + degrees / 360) % 1, s, l);
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
