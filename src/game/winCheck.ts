import { getCell, isFull } from './board';
import type { Board, GameResult, Move, Player } from './types';
const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
export function findLine(board: Board, player: Player, move: Move): Move[] | null {
  const size = board.config.size;
  const matches = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && getCell(board, r, c) === player;
  if (!matches(move.row, move.col)) return null;
  for (const [dr, dc] of directions) {
    let r = move.row, c = move.col;
    while (matches(r - dr, c - dc)) { r -= dr; c -= dc; }
    const line: Move[] = [];
    while (matches(r, c)) { line.push({ row: r, col: c }); r += dr; c += dc; }
    if (line.length >= board.config.k) return line;
  }
  return null;
}
export function checkWin(board: Board, lastMove?: Move): GameResult {
  const moves = lastMove ? [lastMove] : board.cells.flatMap((cell, i) => cell ? [{ row: Math.floor(i / board.config.size), col: i % board.config.size }] : []);
  for (const move of moves) {
    const player = getCell(board, move.row, move.col);
    const line = player ? findLine(board, player, move) : null;
    if (line && player) return { status: 'win', winner: player, line };
  }
  return { status: isFull(board) ? 'draw' : 'playing', winner: null, line: null };
}
