/** Pure board types shared by game logic, AI, and UI. No DOM dependencies. */

export type Player = 1 | 2;
export type Cell = 0 | Player;

export interface BoardConfig {
  /** Board is size x size. */
  size: number;
  /** Number in a row needed to win (k or more counts). */
  k: number;
}

export interface Move {
  row: number;
  col: number;
}

/** Immutable board snapshot. cells is row-major, length size*size. */
export interface Board {
  config: BoardConfig;
  cells: Cell[];
}

export type GameStatus = 'playing' | 'win' | 'draw';

export interface GameResult {
  status: GameStatus;
  winner: Player | null;
  /** Winning line cells (length >= k) when status === 'win'. */
  line: Move[] | null;
}

export const BOARD_PRESETS = {
  lv1: { size: 3, k: 3 },
  lv2: { size: 9, k: 5 },
  lv3_15: { size: 15, k: 5 },
  lv3_17: { size: 17, k: 5 },
  lv3_19: { size: 19, k: 5 },
} as const satisfies Record<string, BoardConfig>;
