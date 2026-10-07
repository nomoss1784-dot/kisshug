import type { Board, Move, Player } from '../game/types';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface AiOptions {
  /** Hard wall-clock limit; the engine must return its best move so far before this elapses. */
  timeLimitMs: number;
  /** Deterministic RNG in [0,1). Defaults to Math.random. */
  rng?: () => number;
}

/** Message sent from the main thread to the AI worker. */
export interface AiRequest {
  type: 'move';
  id: number;
  board: Board;
  player: Player;
  difficulty: Difficulty;
  timeLimitMs: number;
}

export interface AiCancel {
  type: 'cancel';
  id: number;
}

export type AiWorkerInbound = AiRequest | AiCancel;

/** Message sent from the AI worker back to the main thread. */
export interface AiResponse {
  type: 'move';
  id: number;
  move: Move;
  elapsedMs: number;
}
