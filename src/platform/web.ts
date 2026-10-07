import type { Platform } from './types';

const PREFIX = 'kisshug:';

/** Browser implementation: localStorage, no ads, browser language. */
export class WebPlatform implements Platform {
  private pauseCbs: Array<() => void> = [];
  private resumeCbs: Array<() => void> = [];
  private readyCalled = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseCbs.forEach((cb) => cb());
      else this.resumeCbs.forEach((cb) => cb());
    });
  }

  ready(): void {
    this.readyCalled = true;
  }
  isReady(): boolean {
    return this.readyCalled;
  }
  onPause(cb: () => void): void {
    this.pauseCbs.push(cb);
  }
  onResume(cb: () => void): void {
    this.resumeCbs.push(cb);
  }
  isAudioEnabled(): boolean {
    return true;
  }
  onAudioChange(): void {
    /* browser audio is always "enabled"; the in-game toggle handles the rest */
  }
  language(): string {
    return navigator.language || 'en';
  }
  async save(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch (e) {
      this.logWarning(`save failed: ${String(e)}`);
    }
  }
  async load(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  }
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
  sendScore(): void {
    /* no-op on the web */
  }
  async showInterstitial(): Promise<void> {
    /* no ads on the web */
  }
  async showRewarded(): Promise<boolean> {
    return false;
  }
  isPlayables(): boolean {
    return false;
  }
  logError(err: unknown): void {
    console.error(err);
  }
  logWarning(message: string): void {
    console.warn(message);
  }
}
