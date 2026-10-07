import { placeMove } from './board';
import { checkWin } from './winCheck';
import type { Board, GameResult, Move, Player } from './types';
export function applyMove(board: Board, move: Move, player: Player): { board: Board; result: GameResult } {
  const next = placeMove(board, move, player);
  return { board: next, result: checkWin(next, move) };
}
export function nextPlayer(p: Player): Player { return p === 1 ? 2 : 1; }
