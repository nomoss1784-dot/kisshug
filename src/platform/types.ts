/**
 * Platform abstraction (SPEC §9.3). The game never touches the Playables SDK
 * except through this interface.
 */
export interface Platform {
  /** Call once the title screen is interactive: firstFrameReady + gameReady. */
  ready(): void;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  isAudioEnabled(): boolean;
  onAudioChange(cb: (enabled: boolean) => void): void;
  /** BCP-47 tag, e.g. "ja" or "en-US". */
  language(): string;
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  sendScore(n: number): void;
  showInterstitial(): Promise<void>;
  /** Resolves true when the player earned the reward. */
  showRewarded(rewardId: string): Promise<boolean>;
  isPlayables(): boolean;
  logError(err: unknown): void;
  logWarning(message: string): void;
}

/** Shape of the `ytgame` global provided by the YouTube Playables host. */
export interface YtGame {
  IN_PLAYABLES_ENV: boolean;
  SDK_VERSION: string;
  game: {
    firstFrameReady(): void;
    gameReady(): void;
    loadData(): Promise<string>;
    saveData(data: string): Promise<void>;
  };
  system: {
    getLanguage(): Promise<string>;
    isAudioEnabled(): boolean;
    onAudioEnabledChange(cb: (enabled: boolean) => void): void;
    onPause(cb: () => void): void;
    onResume(cb: () => void): void;
  };
  engagement: {
    sendScore(score: { value: number }): Promise<void>;
  };
  ads: {
    requestInterstitialAd(): Promise<void>;
    requestRewardedAd(rewardId: string): Promise<boolean>;
  };
  health: {
    logError(): void;
    logWarning(): void;
  };
}

declare global {
  interface Window {
    ytgame?: YtGame;
  }
  const __PLAYABLES__: boolean;
  const __PHOTO_MODE_ENABLED__: boolean;
}
