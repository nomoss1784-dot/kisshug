import { BaseScene } from './base';
import { Button, inRect, type Rect } from '../ui/widgets';
import { panel, text, textBlock, fillRoundRect, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import { BODY_TINTS, type BodyTint } from '../state/types';
import type { SetupDraft } from './setup';
import { CharSelectScene } from './charSelect';
import { drawCropped, loadFile, renderCrop, type CropState } from '../photo/crop';
import type { PointerPos } from '../ui/app';
import { t } from '../i18n';

/**
 * Photo mode import + circular crop (SPEC §7). The image never leaves the
 * device: it is read from a <input type=file>, cropped on a canvas, and kept
 * in memory unless the player opts in to saving it.
 */
export class PhotoScene extends BaseScene {
  name = 'Photo';
  private input: HTMLInputElement;
  private img: HTMLImageElement | null = null;
  private crop: CropState = { ox: 0, oy: 0, zoom: 1 };
  private circle = { x: 0, y: 0, r: 0 };
  private slider: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private swatches: Array<{ rect: Rect; tint: BodyTint }> = [];
  private remember = false;
  private status: 'empty' | 'loading' | 'ready' | 'error' = 'empty';
  private draggingSlider = false;

  constructor(g: import('./context').GameContext, private draft: SetupDraft, private idx: 0 | 1) {
    super(g);
    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.accept = 'image/*';
    this.input.style.position = 'fixed';
    this.input.style.left = '-9999px';
    this.input.style.opacity = '0';
    this.input.setAttribute('aria-hidden', 'true');
    this.input.addEventListener('change', () => this.onFile());
    document.body.appendChild(this.input);
    const key = idx === 0 ? 'p1' : 'p2';
    this.remember = !!g.store.photos[key];
  }

  enter(): void {
    const key = this.idx === 0 ? 'p1' : 'p2';
    const existing = this.draft.players[this.idx].photo ?? this.g.store.sessionPhotos[key];
    if (existing) {
      this.status = 'loading';
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.crop = { ox: 0, oy: 0, zoom: 1 };
        this.status = 'ready';
      };
      img.onerror = () => (this.status = 'empty');
      img.src = existing;
    }
  }

  exit(): void {
    this.input.remove();
  }

  private async onFile(): Promise<void> {
    const file = this.input.files?.[0];
    this.input.value = '';
    if (!file) return;
    this.status = 'loading';
    try {
      this.img = await loadFile(file);
      this.crop = { ox: 0, oy: 0, zoom: 1 };
      this.status = 'ready';
    } catch (e) {
      this.status = 'error';
      this.g.platform.logWarning(`photo load failed: ${String(e)}`);
    }
  }

  build(): void {
    const { safe, u } = this;
    const p = this.draft.players[this.idx];
    this.addBack(() => this.g.go(new CharSelectScene(this.g, this.draft, this.idx)));
    const portrait = this.h > this.w;
    const r = Math.min(safe.w * 0.3, safe.h * (portrait ? 0.16 : 0.22), 120 * u);
    const cx = portrait ? this.w / 2 : safe.x + safe.w * 0.3;
    const cy = portrait ? safe.y + 80 * u + r + 10 * u : safe.y + safe.h * 0.42;
    this.circle = { x: cx, y: cy, r };
    const colW = portrait ? Math.min(safe.w - 32 * u, 340 * u) : Math.min(safe.w * 0.42, 340 * u);
    const colX = portrait ? this.w / 2 - colW / 2 : safe.x + safe.w * 0.56;
    let y = portrait ? cy + r + 18 * u : safe.y + 70 * u;
    const bh = Math.min(44 * u, safe.h / 13);
    const gap = 8 * u;
    // slider
    this.slider = { x: colX, y, w: colW, h: 28 * u };
    y += 28 * u + gap;
    this.buttons.add(new Button({ label: this.img ? t('photo.change') : t('photo.pick'), style: 'secondary', fontSize: 16 * u, id: 'pick', onClick: () => this.input.click() }).set(colX, y, colW, bh));
    y += bh + gap;
    // body colour swatches
    this.swatches = [];
    const tints = Object.keys(BODY_TINTS) as BodyTint[];
    const sw = (colW - gap * 3) / 4;
    tints.forEach((tint, i) => this.swatches.push({ rect: { x: colX + i * (sw + gap), y, w: sw, h: bh * 0.8 }, tint }));
    y += bh * 0.8 + gap;
    // remember toggle
    this.buttons.add(
      new Button({
        label: `${this.remember ? '☑' : '☐'} ${t('photo.remember')}`,
        style: this.remember ? 'choiceSelected' : 'choice',
        fontSize: 13 * u,
        id: 'remember',
        onClick: () => {
          this.remember = !this.remember;
          this.layout(this.w, this.h);
        },
      }).set(colX, y, colW, bh),
    );
    y += bh + gap;
    this.privacyY = y;
    y += 64 * u;
    const okY = Math.min(y, safe.y + safe.h - bh * 2 - gap - 12 * u);
    this.buttons.add(new Button({ label: t('common.ok'), style: 'primary', enabled: this.status === 'ready', fontSize: 18 * u, id: 'ok', onClick: () => this.confirm() }).set(colX, okY, colW, bh));
    this.buttons.add(new Button({ label: t('photo.useAnimal'), style: 'ghost', fontSize: 14 * u, id: 'use-animal', onClick: () => {
      p.photo = null;
      this.g.go(new CharSelectScene(this.g, this.draft, this.idx));
    } }).set(colX, okY + bh + gap, colW, bh * 0.9));
  }

  private privacyY = 0;

  private confirm(): void {
    if (!this.img) return;
    const p = this.draft.players[this.idx];
    const dataUrl = renderCrop(this.img, this.crop);
    p.photo = dataUrl;
    const key = this.idx === 0 ? 'p1' : 'p2';
    this.g.store.sessionPhotos[key] = dataUrl;
    if (this.remember) {
      this.g.store.photos[key] = dataUrl;
      void this.g.store.savePhotos();
    } else if (this.g.store.photos[key]) {
      this.g.store.photos[key] = null;
      void this.g.store.savePhotos();
    }
    const scene = new CharSelectScene(this.g, this.draft, this.idx);
    scene.next();
  }

  update(): void {
    const okBtn = this.buttons.buttons.find((b) => b.opts.id === 'ok');
    if (okBtn) okBtn.opts.enabled = this.status === 'ready';
    const pick = this.buttons.buttons.find((b) => b.opts.id === 'pick');
    if (pick) pick.opts.label = this.img ? t('photo.change') : t('photo.pick');
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    const u = this.u;
    const p = this.draft.players[this.idx];
    this.header(ctx, t('photo.title', { player: this.idx === 0 ? t('common.player1') : t('common.player2') }));
    const { x, y, r } = this.circle;
    // preview (body colour ring + image clipped to circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 8 * u, 0, Math.PI * 2);
    ctx.fillStyle = BODY_TINTS[p.bodyTint];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();
    if (this.img) drawCropped(ctx, this.img, this.crop, x, y, r);
    else text(ctx, this.status === 'loading' ? t('photo.loading') : this.status === 'error' ? t('photo.error') : '📷', x, y, { size: this.status === 'empty' ? r * 0.6 : 14 * u, color: COLORS.textSoft, weight: 'normal' });
    ctx.restore();
    if (this.img) text(ctx, t('photo.hint'), x, y + r + 8 * u, { size: 11 * u, color: COLORS.textSoft, weight: 'normal', baseline: 'top' });
    // zoom slider
    const s = this.slider;
    text(ctx, t('photo.zoom'), s.x, s.y + s.h / 2, { size: 12 * u, align: 'left', color: COLORS.textSoft, weight: 'normal' });
    const trackX = s.x + 54 * u;
    const trackW = s.w - 54 * u;
    fillRoundRect(ctx, trackX, s.y + s.h / 2 - 3 * u, trackW, 6 * u, 3 * u, COLORS.boardLine);
    const kn = trackX + ((this.crop.zoom - 1) / 3) * trackW;
    ctx.beginPath();
    ctx.arc(kn, s.y + s.h / 2, 11 * u, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.primary;
    ctx.fill();
    // swatches
    for (const sw of this.swatches) {
      fillRoundRect(ctx, sw.rect.x, sw.rect.y, sw.rect.w, sw.rect.h, 10 * u, BODY_TINTS[sw.tint]);
      if (p.bodyTint === sw.tint) {
        ctx.strokeStyle = COLORS.primaryDark;
        ctx.lineWidth = 3 * u;
        ctx.strokeRect(sw.rect.x, sw.rect.y, sw.rect.w, sw.rect.h);
      }
      text(ctx, t(`color.${sw.tint}`), sw.rect.x + sw.rect.w / 2, sw.rect.y + sw.rect.h / 2, { size: 11 * u, color: COLORS.text, weight: 'normal', maxWidth: sw.rect.w - 6 });
    }
    // privacy notice (MUST, SPEC §7.2)
    const colW = this.slider.w;
    panel(ctx, this.slider.x, this.privacyY, colW, 58 * u, 10 * u, '#FFF8FA');
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.slider.x, this.privacyY, colW, 58 * u);
    ctx.clip();
    const h1 = textBlock(ctx, t('photo.privacy1'), this.slider.x + colW / 2, this.privacyY + 12 * u, colW - 16 * u, { size: 10.5 * u, color: COLORS.text, weight: 'normal' });
    textBlock(ctx, t('photo.privacy2'), this.slider.x + colW / 2, this.privacyY + 12 * u + h1 + 2 * u, colW - 16 * u, { size: 10.5 * u, color: COLORS.textSoft, weight: 'normal' });
    ctx.restore();
    this.buttons.draw(ctx);
  }

  private inCircle(p: PointerPos): boolean {
    return Math.hypot(p.x - this.circle.x, p.y - this.circle.y) <= this.circle.r * 1.1;
  }

  onPointerDown(p: PointerPos): void {
    super.onPointerDown(p);
    this.draggingSlider = inRect(p, { ...this.slider, y: this.slider.y - 10, h: this.slider.h + 20 });
    if (this.draggingSlider) this.setSlider(p.x);
  }
  onPointerUp(): void {
    super.onPointerUp();
    this.draggingSlider = false;
  }
  private setSlider(x: number): void {
    const trackX = this.slider.x + 54 * this.u;
    const trackW = this.slider.w - 54 * this.u;
    this.crop.zoom = 1 + Math.max(0, Math.min(1, (x - trackX) / trackW)) * 3;
  }
  onPan(dx: number, dy: number, p: PointerPos): void {
    if (this.draggingSlider) {
      this.setSlider(p.x);
      return;
    }
    if (this.img && this.inCircle(p)) {
      this.crop.ox += dx / this.circle.r;
      this.crop.oy += dy / this.circle.r;
    }
  }
  onPinch(scale: number): void {
    this.crop.zoom = Math.max(1, Math.min(4, this.crop.zoom * scale));
  }
  onWheel(deltaY: number, p: PointerPos): void {
    if (this.inCircle(p)) this.crop.zoom = Math.max(1, Math.min(4, this.crop.zoom * (deltaY > 0 ? 0.95 : 1.05)));
  }
  onTap(p: PointerPos): void {
    if (this.buttons.tap(p)) {
      this.g.sfx.play('button');
      return;
    }
    const sw = this.swatches.find((s) => inRect(p, s.rect));
    if (sw) {
      this.draft.players[this.idx].bodyTint = sw.tint;
      this.g.sfx.play('button');
    }
  }
  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.g.go(new CharSelectScene(this.g, this.draft, this.idx));
      return true;
    }
    return false;
  }
}
