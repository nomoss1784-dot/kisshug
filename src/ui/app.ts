import { Tweens } from './tween';
import type { Ctx } from './draw';

export interface PointerPos {
  x: number;
  y: number;
}

/**
 * A scene draws into the full canvas. Input arrives already normalised into
 * CSS pixels. Overlays (transparent === true) are drawn above the scene below.
 */
export interface Scene {
  readonly transparent?: boolean;
  /** Own tween manager; the app advances it only while the scene is on top (or visible overlay chain). */
  readonly tweens: Tweens;
  enter?(): void;
  exit?(): void;
  layout(w: number, h: number): void;
  update(dt: number): void;
  draw(ctx: Ctx, w: number, h: number): void;
  onPointerDown?(p: PointerPos): void;
  onPointerMove?(p: PointerPos): void;
  onPointerUp?(p: PointerPos): void;
  onTap?(p: PointerPos): void;
  onDoubleTap?(p: PointerPos): void;
  /** dx/dy in CSS pixels since the last pan event. */
  onPan?(dx: number, dy: number, p: PointerPos): void;
  /** scale: multiplicative factor since the last pinch event, around (cx, cy). */
  onPinch?(scale: number, cx: number, cy: number): void;
  onWheel?(deltaY: number, p: PointerPos): void;
  /** Return true if handled. Never call preventDefault on Escape. */
  onKey?(e: KeyboardEvent): boolean;
  onPause?(): void;
  onResume?(): void;
}

interface ActivePointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 320;

/** Canvas host: DPR-aware resizing, gesture recognition, scene stack, main loop. */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
  width = 0;
  height = 0;
  dpr = 1;
  paused = false;
  private scenes: Scene[] = [];
  private pointers = new Map<number, ActivePointer>();
  private lastTap: { x: number; y: number; time: number } | null = null;
  private pinchDist = 0;
  private pinchCenter: PointerPos = { x: 0, y: 0 };
  private lastFrame = 0;
  private frameCount = 0;
  private firstFrameCb: (() => void) | null = null;
  private resizeListeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    (canvas.style as unknown as Record<string, string>).webkitUserSelect = 'none';
    (canvas.style as unknown as Record<string, string>).webkitTouchCallout = 'none';
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  onFirstFrame(cb: () => void): void {
    if (this.frameCount > 0) cb();
    else this.firstFrameCb = cb;
  }

  onResize(cb: () => void): void {
    this.resizeListeners.push(cb);
  }

  /** SPEC §8.1: never size the canvas while innerHeight is 0; wait for a resize. */
  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    this.width = w;
    this.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    for (const s of this.scenes) s.layout(w, h);
    this.resizeListeners.forEach((cb) => cb());
  }

  get top(): Scene | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  replace(scene: Scene): void {
    while (this.scenes.length) this.scenes.pop()?.exit?.();
    this.push(scene);
  }

  push(scene: Scene): void {
    this.scenes.push(scene);
    scene.layout(this.width, this.height);
    scene.enter?.();
  }

  pop(): void {
    const s = this.scenes.pop();
    s?.exit?.();
  }

  /** Pops until `scene` is on top (no-op if it is not in the stack). */
  popTo(scene: Scene): void {
    if (!this.scenes.includes(scene)) return;
    while (this.top !== scene) this.pop();
  }

  hasOverlay(): boolean {
    return (this.top?.transparent ?? false) && this.scenes.length > 1;
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.scenes.forEach((s) => s.onPause?.());
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = 0;
    this.scenes.forEach((s) => s.onResume?.());
  }

  private frame(t: number): void {
    requestAnimationFrame((n) => this.frame(n));
    if (this.width === 0) {
      this.resize();
      if (this.width === 0) return;
    }
    const dt = this.lastFrame ? Math.min(100, t - this.lastFrame) : 16;
    this.lastFrame = t;
    if (!this.paused) {
      // Advance the top scene and any transparent overlays' underlying scene.
      let i = this.scenes.length - 1;
      while (i >= 0) {
        const s = this.scenes[i];
        s.tweens.update(dt);
        s.update(dt);
        if (!s.transparent) break;
        i--;
      }
    }
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let start = this.scenes.length - 1;
    while (start > 0 && this.scenes[start].transparent) start--;
    for (let i = Math.max(0, start); i < this.scenes.length; i++) {
      ctx.save();
      this.scenes[i].draw(ctx, this.width, this.height);
      ctx.restore();
    }
    this.frameCount++;
    if (this.frameCount === 1 && this.firstFrameCb) {
      const cb = this.firstFrameCb;
      this.firstFrameCb = null;
      cb();
    }
  }

  private pos(e: PointerEvent | WheelEvent): PointerPos {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const p = this.pos(e);
      this.pointers.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, startTime: performance.now(), moved: false });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else if (this.pointers.size === 1) {
        this.top?.onPointerDown?.(p);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const ap = this.pointers.get(e.pointerId);
      const p = this.pos(e);
      if (!ap) {
        this.top?.onPointerMove?.(p);
        return;
      }
      e.preventDefault();
      const dx = p.x - ap.x;
      const dy = p.y - ap.y;
      ap.x = p.x;
      ap.y = p.y;
      if (!ap.moved && Math.hypot(p.x - ap.startX, p.y - ap.startY) > TAP_SLOP) ap.moved = true;
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.pinchDist > 0 && dist > 0) this.top?.onPinch?.(dist / this.pinchDist, center.x, center.y);
        this.top?.onPan?.(center.x - this.pinchCenter.x, center.y - this.pinchCenter.y, center);
        this.pinchDist = dist;
        this.pinchCenter = center;
      } else {
        this.top?.onPointerMove?.(p);
        if (ap.moved) this.top?.onPan?.(dx, dy, p);
      }
    });
    const end = (e: PointerEvent) => {
      const ap = this.pointers.get(e.pointerId);
      if (!ap) return;
      this.pointers.delete(e.pointerId);
      const p = this.pos(e);
      const wasMulti = this.pointers.size >= 1;
      if (wasMulti) {
        // Remaining pointer continues as a single-pointer pan without tapping.
        const rest = [...this.pointers.values()][0];
        rest.moved = true;
        this.pinchDist = 0;
        return;
      }
      this.top?.onPointerUp?.(p);
      if (!ap.moved && e.type !== 'pointercancel' && performance.now() - ap.startTime < 700) {
        const now = performance.now();
        const lt = this.lastTap;
        if (lt && now - lt.time < DOUBLE_TAP_MS && Math.hypot(lt.x - p.x, lt.y - p.y) < 40) {
          this.lastTap = null;
          this.top?.onDoubleTap?.(p);
        } else {
          this.lastTap = { x: p.x, y: p.y, time: now };
          this.top?.onTap?.(p);
        }
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.top?.onWheel?.(e.deltaY, this.pos(e));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      // SPEC §8.1: Esc closes dialogs and we must NOT preventDefault it.
      const handled = this.top?.onKey?.(e) ?? false;
      if (handled && e.key !== 'Escape') e.preventDefault();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
