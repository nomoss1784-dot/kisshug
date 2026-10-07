import type { YtGame } from './types';

/**
 * Local mock of the `ytgame` global for testing PlayablesPlatform without the
 * Developer Portal. Enabled with `?mock=playables`. Exposes a small control
 * API on window.__ytmock for Playwright tests (pause/resume/audio/language).
 */
export interface YtMockControl {
  calls: string[];
  pause(): void;
  resume(): void;
  setAudio(enabled: boolean): void;
  saved: string;
}

export function installYtGameMock(lang = 'ja'): YtMockControl {
  const calls: string[] = [];
  const pauseCbs: Array<() => void> = [];
  const resumeCbs: Array<() => void> = [];
  const audioCbs: Array<(e: boolean) => void> = [];
  let audio = true;
  const control: YtMockControl = {
    calls,
    saved: '',
    pause: () => pauseCbs.forEach((cb) => cb()),
    resume: () => resumeCbs.forEach((cb) => cb()),
    setAudio: (e) => {
      audio = e;
      audioCbs.forEach((cb) => cb(e));
    },
  };
  const log = (name: string) => {
    calls.push(`${name}@${Math.round(performance.now())}`);
  };
  const sdk: YtGame = {
    IN_PLAYABLES_ENV: true,
    SDK_VERSION: 'mock-1.0',
    game: {
      firstFrameReady: () => log('firstFrameReady'),
      gameReady: () => log('gameReady'),
      loadData: async () => {
        log('loadData');
        return control.saved;
      },
      saveData: async (data: string) => {
        log('saveData');
        if (data.length * 2 > 3 * 1024 * 1024) throw new Error('SIZE_LIMIT_EXCEEDED');
        control.saved = data;
      },
    },
    system: {
      getLanguage: async () => {
        log('getLanguage');
        return lang;
      },
      isAudioEnabled: () => audio,
      onAudioEnabledChange: (cb) => audioCbs.push(cb),
      onPause: (cb) => pauseCbs.push(cb),
      onResume: (cb) => resumeCbs.push(cb),
    },
    engagement: {
      sendScore: async (s) => log(`sendScore:${s.value}`),
    },
    ads: {
      requestInterstitialAd: async () => {
        log('interstitial');
        await new Promise((r) => setTimeout(r, 300));
      },
      requestRewardedAd: async (id) => {
        log(`rewarded:${id}`);
        return true;
      },
    },
    health: {
      logError: () => log('logError'),
      logWarning: () => log('logWarning'),
    },
  };
  window.ytgame = sdk;
  (window as unknown as { __ytmock: YtMockControl }).__ytmock = control;
  return control;
}
