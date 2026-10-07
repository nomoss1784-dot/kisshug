import { expect, it } from 'vitest';
import { chooseMove } from '../src/ai/engine';
import { createBoard, emptyCells, placeMove } from '../src/game/board';
import { checkWin } from '../src/game/winCheck';
import { nextPlayer } from '../src/game/rules';
import type { Player } from '../src/game/types';
import type { Difficulty } from '../src/ai/types';
function mulberry32(seed: number): () => number { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function game(ai: Player, difficulty: Difficulty, rng: () => number, both = false) {
  let board = createBoard({ size: 3, k: 3 }), turn: Player = 1;
  while (checkWin(board).status === 'playing') {
    const legal = emptyCells(board);
    const move = both || turn === ai ? chooseMove(board, turn, difficulty, { rng, timeLimitMs: 100 }) : legal[Math.floor(rng() * legal.length)];
    board = placeMove(board, move, turn); turn = nextPlayer(turn);
  }
  return checkWin(board);
}
it('hard never loses 1000 seeded games, equally as first and second', () => {
  const rng = mulberry32(123);
  for (const ai of [1, 2] as const) for (let i = 0; i < 500; i++) expect(game(ai, 'hard', rng).winner).not.toBe(nextPlayer(ai));
});
it('hard against hard draws ten games', () => { for (let i = 0; i < 10; i++) expect(game(1, 'hard', mulberry32(i), true).status).toBe('draw'); });
it('easy sometimes loses', () => {
  const rng = mulberry32(72);
  let losses = 0;
  for (let i = 0; i < 100; i++) if (game(1, 'easy', rng).winner === 2) losses++;
  expect(losses).toBeGreaterThan(0);
});
