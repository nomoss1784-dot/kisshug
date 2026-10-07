import type { Platform, YtGame } from './types';

/**
 * YouTube Playables implementation. All persistent data lives in one JSON
 * string stored via saveData/loadData (3 MiB limit, UTF-16).
 */
export class PlayablesPlatform implements Platform {
  private store: Record<string, string> = {};
  private lang = 'en';
  private readyCalled = false;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(private sdk: YtGame) {}

  /** Must be awaited before the game starts: loads data + language. */
  async init(): Promise<void> {
    try {
      const raw = await this.sdk.game.loadData();
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') this.store = parsed as Record<string, string>;
      }
    } catch (e) {
      this.logWarning(`loadData failed: ${String(e)}`);
    }
    try {
      this.lang = await this.sdk.system.getLanguage();
    } catch (e) {
      this.logWarning(`getLanguage failed: ${String(e)}`);
    }
  }

  ready(): void {
    if (this.readyCalled) return;
    this.readyCalled = true;
    try {
      this.sdk.game.gameReady();
    } catch (e) {
      this.logError(e);
    }
  }
  firstFrame(): void {
    try {
      this.sdk.game.firstFrameReady();
    } catch (e) {
      this.logError(e);
    }
  }
  onPause(cb: () => void): void {
    this.sdk.system.onPause(cb);
  }
  onResume(cb: () => void): void {
    this.sdk.system.onResume(cb);
  }
  isAudioEnabled(): boolean {
    try {
      return this.sdk.system.isAudioEnabled();
    } catch {
      return true;
    }
  }
  onAudioChange(cb: (enabled: boolean) => void): void {
    this.sdk.system.onAudioEnabledChange(cb);
  }
  language(): string {
    return this.lang;
  }
  private flush(): Promise<void> {
    const data = JSON.stringify(this.store);
    this.saveChain = this.saveChain
      .then(() => this.sdk.game.saveData(data))
      .catch((e) => this.logWarning(`saveData failed: ${String(e)}`));
    return this.saveChain;
  }
  save(key: string, value: string): Promise<void> {
    this.store[key] = value;
    return this.flush();
  }
  async load(key: string): Promise<string | null> {
    return this.store[key] ?? null;
  }
  remove(key: string): Promise<void> {
    delete this.store[key];
    return this.flush();
  }
  sendScore(n: number): void {
    this.sdk.engagement.sendScore({ value: n }).catch((e) => this.logWarning(`sendScore failed: ${String(e)}`));
  }
  async showInterstitial(): Promise<void> {
    try {
      await this.sdk.ads.requestInterstitialAd();
    } catch (e) {
      this.logWarning(`interstitial failed: ${String(e)}`);
    }
  }
  async showRewarded(rewardId: string): Promise<boolean> {
    try {
      return await this.sdk.ads.requestRewardedAd(rewardId);
    } catch (e) {
      this.logWarning(`rewarded failed: ${String(e)}`);
      return false;
    }
  }
  isPlayables(): boolean {
    return true;
  }
  logError(err: unknown): void {
    console.error(err);
    try {
      this.sdk.health.logError();
    } catch {
      /* ignore */
    }
  }
  logWarning(message: string): void {
    console.warn(message);
    try {
      this.sdk.health.logWarning();
    } catch {
      /* ignore */
    }
  }
}
