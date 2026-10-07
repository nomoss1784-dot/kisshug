import { expect, it } from 'vitest';
import { chooseMove } from '../src/ai/engine';
import { createBoard, emptyCells, isValidMove, placeMove } from '../src/game/board';
import { checkWin } from '../src/game/winCheck';
import { nextPlayer } from '../src/game/rules';
import type { Player } from '../src/game/types';
function mulberry32(seed: number): () => number { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
for (const size of [9, 15]) {
  it(`takes wins and blocks open and closed fours on ${size}`, () => {
    for (const owner of [1, 2] as const) for (const closed of [false, true]) {
      let board = createBoard({ size, k: 5 });
      for (let col = 2; col < 6; col++) board = placeMove(board, { row: 4, col }, owner);
      if (closed) board = placeMove(board, { row: 4, col: 1 }, nextPlayer(owner));
      const move = chooseMove(board, 1, 'hard', { timeLimitMs: 300 });
      expect(move.row).toBe(4); expect(closed ? [6] : [1, 6]).toContain(move.col);
    }
  });
  it(`returns legal, pure, deterministic moves within 300ms on ${size}`, () => {
    let board = createBoard({ size, k: 5 });
    for (const [row, col, player] of [[4, 4, 1], [4, 5, 2], [5, 5, 1], [3, 3, 2]] as const) board = placeMove(board, { row, col }, player);
    const before = [...board.cells], started = performance.now();
    const move = chooseMove(board, 1, 'hard', { timeLimitMs: 300, rng: mulberry32(1) });
    expect(performance.now() - started).toBeLessThan(400);
    expect(isValidMove(board, move)).toBe(true); expect(board.cells).toEqual(before);
    expect(chooseMove(board, 1, 'normal', { timeLimitMs: 300, rng: mulberry32(12) })).toEqual(chooseMove(board, 1, 'normal', { timeLimitMs: 300, rng: mulberry32(12) }));
  });
}
it('hard beats a seeded random mover in 20/20 games on 9x9', () => {
  const rng = mulberry32(32);
  for (let game = 0; game < 20; game++) {
    const ai: Player = game % 2 ? 2 : 1;
    let board = createBoard({ size: 9, k: 5 }), turn: Player = 1;
    while (checkWin(board).status === 'playing') {
      const legal = emptyCells(board);
      const move = turn === ai ? chooseMove(board, turn, 'hard', { timeLimitMs: 20, rng }) : legal[Math.floor(rng() * legal.length)];
      expect(isValidMove(board, move)).toBe(true);
      board = placeMove(board, move, turn); turn = nextPlayer(turn);
    }
    expect(checkWin(board).winner).toBe(ai);
  }
}, 30000);
