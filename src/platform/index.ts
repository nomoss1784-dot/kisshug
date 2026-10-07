import type { Platform } from './types';
import { WebPlatform } from './web';
import { PlayablesPlatform } from './playables';
import { installYtGameMock } from './mock';

export type { Platform } from './types';

/**
 * Picks the platform. The Playables host injects `window.ytgame`; locally the
 * mock can be enabled with `?mock=playables` (any build).
 */
export async function createPlatform(): Promise<Platform> {
  const params = new URLSearchParams(location.search);
  if (params.get('mock') === 'playables' && !window.ytgame) {
    installYtGameMock(params.get('lang') ?? 'ja');
  }
  const sdk = window.ytgame;
  if (sdk && sdk.IN_PLAYABLES_ENV) {
    const p = new PlayablesPlatform(sdk);
    await p.init();
    return p;
  }
  if (__PLAYABLES__) console.warn('[kisshug] playables build running without ytgame; using WebPlatform');
  return new WebPlatform();
}
