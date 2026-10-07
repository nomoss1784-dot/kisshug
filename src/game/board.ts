import type { Board, BoardConfig, Cell, Move, Player } from './types';

export function createBoard(config: BoardConfig): Board {
  if (!Number.isInteger(config.size) || !Number.isInteger(config.k) || config.size < 1 || config.k < 1 || config.k > config.size) throw new Error('Invalid board configuration');
  return { config: { ...config }, cells: Array<Cell>(config.size * config.size).fill(0) };
}
export function cloneBoard(board: Board): Board {
  return { config: { ...board.config }, cells: [...board.cells] };
}
export function indexOf(config: BoardConfig, row: number, col: number): number {
  return row * config.size + col;
}
export function getCell(board: Board, row: number, col: number): Cell {
  if (!inBounds(board, { row, col })) throw new Error('Cell out of bounds');
  return board.cells[indexOf(board.config, row, col)];
}
function inBounds(board: Board, move: Move): boolean {
  return Number.isInteger(move.row) && Number.isInteger(move.col) && move.row >= 0 && move.col >= 0 && move.row < board.config.size && move.col < board.config.size;
}
export function isValidMove(board: Board, move: Move): boolean {
  return inBounds(board, move) && board.cells[indexOf(board.config, move.row, move.col)] === 0;
}
export function placeMove(board: Board, move: Move, player: Player): Board {
  if (!isValidMove(board, move)) throw new Error('Invalid move');
  const next = cloneBoard(board);
  next.cells[indexOf(board.config, move.row, move.col)] = player;
  return next;
}
export function emptyCells(board: Board): Move[] {
  return board.cells.flatMap((cell, i) => cell === 0 ? [{ row: Math.floor(i / board.config.size), col: i % board.config.size }] : []);
}
export function isFull(board: Board): boolean { return !board.cells.includes(0); }
export function countStones(board: Board): number { return board.cells.reduce<number>((n, cell) => n + Number(cell !== 0), 0); }
