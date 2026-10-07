import { App, type Scene } from './ui/app';
import { createPlatform } from './platform';
import { PlayablesPlatform } from './platform/playables';
import { Store } from './state/store';
import { Sfx } from './audio/sfx';
import { loadRig } from './rig/assets';
import { AiClient } from './ai/client';
import type { GameContext } from './scenes/context';
import { LoadingScene } from './scenes/loading';
import { TitleScene } from './scenes/title';

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const app = new App(canvas);
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  const platform = await createPlatform();
  if (platform instanceof PlayablesPlatform) app.onFirstFrame(() => platform.firstFrame());
  platform.onPause(() => app.pause());
  platform.onResume(() => app.resume());

  const store = new Store(platform);
  await store.load();
  const sfx = new Sfx();
  sfx.init(import.meta.env.BASE_URL);
  sfx.enabled = store.soundEnabled();
  platform.onAudioChange(() => (sfx.enabled = store.soundEnabled()));

  const ctx: GameContext = {
    app,
    store,
    sfx,
    platform,
    ai: new AiClient(),
    rig: null as unknown as GameContext['rig'],
    photoModeEnabled: __PHOTO_MODE_ENABLED__,
    go: (scene: Scene) => app.replace(scene),
    overlay: (scene: Scene) => app.push(scene),
  };
  app.replace(new LoadingScene(ctx));
  ctx.rig = await loadRig();
  app.replace(new TitleScene(ctx));

  // Debug/testing hooks (not used by gameplay).
  (window as unknown as { __kisshug: unknown }).__kisshug = {
    app,
    store,
    ctx,
    scene: () => (app.top as { name?: string } | undefined)?.name ?? '',
    top: () => app.top,
    go: (s: Scene) => app.replace(s),
    scenes: () => import('./scenes/debug'),
  };
  window.addEventListener('error', (e) => platform.logError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => platform.logError(e.reason));
}

void boot();
