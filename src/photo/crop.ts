/** Circular crop of an image to a 256x256 transparent PNG data URL. Everything stays in memory. */
export const PHOTO_SIZE = 256;

export function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

export interface CropState {
  /** Image centre offset relative to the circle centre, in circle-radius units. */
  ox: number;
  oy: number;
  /** Image scale: 1 = image's shorter side equals the circle diameter. */
  zoom: number;
}

/** Renders the crop to a PHOTO_SIZE square canvas with a circular alpha mask. */
export function renderCrop(img: HTMLImageElement, st: CropState): string {
  const c = document.createElement('canvas');
  c.width = PHOTO_SIZE;
  c.height = PHOTO_SIZE;
  const ctx = c.getContext('2d')!;
  const R = PHOTO_SIZE / 2;
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  drawCropped(ctx, img, st, R, R, R);
  return c.toDataURL('image/png');
}

/** Shared drawing for the preview and the final render. */
export function drawCropped(ctx: CanvasRenderingContext2D, img: HTMLImageElement, st: CropState, cx: number, cy: number, R: number): void {
  const short = Math.min(img.naturalWidth, img.naturalHeight);
  const s = ((R * 2) / short) * st.zoom;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, cx + st.ox * R - w / 2, cy + st.oy * R - h / 2, w, h);
}
