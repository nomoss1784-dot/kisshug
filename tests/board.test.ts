import { describe, expect, it } from 'vitest';
import { cloneBoard, countStones, createBoard, emptyCells, getCell, indexOf, isFull, isValidMove, placeMove } from '../src/game/board';
import { applyMove, nextPlayer } from '../src/game/rules';
describe('board', () => {
  for (const size of [3, 9, 15, 19]) it(`creates and fills ${size}`, () => {
    let board = createBoard({ size, k: Math.min(5, size) });
    expect(emptyCells(board)).toHaveLength(size * size);
    const original = board;
    board = placeMove(board, { row: 0, col: 0 }, 1);
    expect(getCell(original, 0, 0)).toBe(0);
    expect(getCell(board, 0, 0)).toBe(1);
    expect(countStones(board)).toBe(1);
    expect(indexOf(board.config, size - 1, size - 1)).toBe(size * size - 1);
    const copy = cloneBoard(board); copy.cells[0] = 2; expect(board.cells[0]).toBe(1);
    for (const move of [{ row: 0, col: 0 }, { row: -1, col: 0 }, { row: size, col: 0 }, { row: 0, col: 0.5 }, { row: NaN, col: 0 }]) {
      expect(isValidMove(board, move)).toBe(false);
      expect(() => placeMove(board, move, 2)).toThrow();
    }
    for (const move of emptyCells(board)) board = placeMove(board, move, 2);
    expect(isFull(board)).toBe(true); expect(emptyCells(board)).toEqual([]);
  });
  it('validates configuration and applies rules', () => {
    expect(() => createBoard({ size: 3, k: 4 })).toThrow();
    const result = applyMove(createBoard({ size: 3, k: 3 }), { row: 1, col: 1 }, 1);
    expect(result.result.status).toBe('playing'); expect(nextPlayer(1)).toBe(2); expect(nextPlayer(2)).toBe(1);
  });
});
