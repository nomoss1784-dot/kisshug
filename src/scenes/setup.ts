import type { Player } from '../game/types';
import { BOARD_PRESETS } from '../game/types';
import type { Difficulty } from '../ai/types';
import { ANIMALS, type AnimalId, type GameMode, type Level, type MatchConfig, type Opponent, type PlayerConfig } from '../state/types';
import type { Store } from '../state/store';

/** Mutable match configuration built up across the select screens. */
export interface SetupDraft {
  mode: GameMode;
  opponent: Opponent;
  players: [PlayerConfig, PlayerConfig];
  level: Level;
  difficulty: Difficulty;
}

export function defaultPlayer(id: Player, isAi: boolean): PlayerConfig {
  return { id, isAi, animal: 'cat', hueShift: 0, photo: null, bodyTint: 'pink', reward: id === 1 ? 'hug' : 'kiss', mark: id === 1 ? 'o' : 'x' };
}

export function createDraft(mode: GameMode, opponent: Opponent): SetupDraft {
  return {
    mode,
    opponent,
    players: [defaultPlayer(1, false), defaultPlayer(2, opponent === 'ai')],
    level: 'lv1',
    difficulty: 'normal',
  };
}

export function randomAnimal(exclude?: AnimalId): AnimalId {
  const pool = exclude ? ANIMALS.filter((a) => a !== exclude) : ANIMALS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Resolve hue shifts, classic rewards and the AI's random choices. */
export function finalize(draft: SetupDraft, store: Store): MatchConfig {
  const [p1, p2] = draft.players;
  if (p2.isAi) {
    p2.animal = randomAnimal();
    p2.photo = null;
    p2.reward = Math.random() < 0.5 ? 'kiss' : 'hug';
  }
  p1.hueShift = 0;
  p2.hueShift = !p1.photo && !p2.photo && p1.animal === p2.animal ? 30 : 0;
  if (draft.mode === 'classic') {
    // SPEC §3.1: X wins = kiss, O wins = hug. Sides were chosen on the side-select screen.
    p2.mark = p1.mark === 'x' ? 'o' : 'x';
    p1.reward = p1.mark === 'o' ? 'hug' : 'kiss';
    p2.reward = p2.mark === 'o' ? 'hug' : 'kiss';
  }
  const board = draft.level === 'lv1' ? BOARD_PRESETS.lv1 : draft.level === 'lv2' ? BOARD_PRESETS.lv2 : { size: store.settings.lv3Size, k: 5 };
  const first = store.nextFirst;
  store.nextFirst = first === 1 ? 2 : 1;
  return { mode: draft.mode, opponent: draft.opponent, level: draft.level, board, difficulty: draft.difficulty, players: [p1, p2], first };
}
