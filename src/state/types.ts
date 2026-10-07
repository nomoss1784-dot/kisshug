import type { BoardConfig, Player } from '../game/types';
import type { Difficulty } from '../ai/types';

export type AnimalId = 'cat' | 'dog' | 'rabbit' | 'bear';
export const ANIMALS: AnimalId[] = ['cat', 'dog', 'rabbit', 'bear'];

export type Reward = 'kiss' | 'hug';
export type GameMode = 'classic' | 'chars' | 'photo';
export type Opponent = 'ai' | 'human';
export type Level = 'lv1' | 'lv2' | 'lv3';
export type Lv3Size = 15 | 17 | 19;
export type BodyTint = 'pink' | 'mint' | 'lavender' | 'lemon';

export const BODY_TINTS: Record<BodyTint, string> = {
  pink: '#F9C6D3',
  mint: '#BFEBDB',
  lavender: '#D6CCF2',
  lemon: '#F9EFB0',
};

export interface PlayerConfig {
  /** Which board side/player number (1 or 2). */
  id: Player;
  isAi: boolean;
  animal: AnimalId;
  /** 0 or 30: hue shift in degrees when both players chose the same animal. */
  hueShift: number;
  /** Photo mode: a 256x256 circular PNG data URL. */
  photo: string | null;
  bodyTint: BodyTint;
  reward: Reward;
  /** Classic mode mark. */
  mark: 'o' | 'x';
}

export interface MatchConfig {
  mode: GameMode;
  opponent: Opponent;
  level: Level;
  board: BoardConfig;
  difficulty: Difficulty;
  players: [PlayerConfig, PlayerConfig];
  first: Player;
}

export interface Settings {
  sound: boolean;
  lang: 'ja' | 'en' | 'auto';
  lv3Size: Lv3Size;
  /** Ceremonies already watched to the end (skip is allowed afterwards). */
  seen: { kiss: boolean; hug: boolean; shake: boolean };
}

export interface Stats {
  hardStreak: number;
  matches: number;
}

export interface SavedPhotos {
  p1: string | null;
  p2: string | null;
}
