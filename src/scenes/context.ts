import type { App, Scene } from '../ui/app';
import type { Store } from '../state/store';
import type { Sfx } from '../audio/sfx';
import type { RigDef } from '../rig/types';
import type { Platform } from '../platform/types';
import type { AiClient } from '../ai/client';
import type { PlayerConfig } from '../state/types';
import { t } from '../i18n';

/** Everything scenes need; passed to every scene constructor. */
export interface GameContext {
  app: App;
  store: Store;
  sfx: Sfx;
  rig: RigDef;
  platform: Platform;
  ai: AiClient;
  photoModeEnabled: boolean;
  /** Replace the whole stack with a new scene. */
  go(scene: Scene): void;
  /** Push an overlay on top. */
  overlay(scene: Scene): void;
}

export function playerName(p: PlayerConfig, other?: PlayerConfig): string {
  if (p.isAi) return `${t('common.ai')} ${t(`char.${p.animal}`)}`;
  if (p.photo) return p.id === 1 ? t('common.player1') : t('common.player2');
  const base = t(`char.${p.animal}`);
  if (other && !other.photo && other.animal === p.animal && !other.isAi) return `${base} ${p.id}`;
  return base;
}
