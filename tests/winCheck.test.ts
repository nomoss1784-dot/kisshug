import { expect, it } from 'vitest';
import { createBoard, emptyCells, placeMove } from '../src/game/board';
import { checkWin, findLine } from '../src/game/winCheck';
import { nextPlayer } from '../src/game/rules';
import type { Player } from '../src/game/types';
function mulberry32(seed: number): () => number { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(82);
it('arbitrary configurations, directions, lengths and interrupted lines', () => {
  for (let size = 3; size <= 19; size++) for (let k = 3; k <= Math.min(size, 6); k++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) for (const length of [k - 1, k, ...(k < size ? [k + 1] : [])]) {
      let board = createBoard({ size, k });
      const row = Math.floor(rng() * (dr ? size - length + 1 : size));
      const col = dc === -1 ? length - 1 + Math.floor(rng() * (size - length + 1)) : Math.floor(rng() * (dc ? size - length + 1 : size));
      for (let i = 0; i < length; i++) board = placeMove(board, { row: row + dr * i, col: col + dc * i }, 1);
      expect(checkWin(board).status).toBe(length >= k ? 'win' : 'playing');
      if (length >= k) {
        expect(findLine(board, 1, { row, col })).toHaveLength(length);
        const interrupted = { ...board, cells: [...board.cells] };
        interrupted.cells[(row + dr * Math.floor(length / 2)) * size + col + dc * Math.floor(length / 2)] = 2;
        expect(checkWin(interrupted).status).toBe('playing');
      }
    }
  }
});
it('draw on a full board without a winner', () => {
  const board = createBoard({ size: 3, k: 3 });
  board.cells = [1, 2, 1, 1, 2, 2, 2, 1, 1];
  expect(checkWin(board)).toEqual({ status: 'draw', winner: null, line: null });
});
it('last move agrees with full scan on 200 random legal histories', () => {
  for (let game = 0; game < 200; game++) {
    const size = 3 + Math.floor(rng() * 17), k = 3 + Math.floor(rng() * (Math.min(6, size) - 2));
    let board = createBoard({ size, k }), player: Player = 1;
    while (checkWin(board).status === 'playing') {
      const legal = emptyCells(board), move = legal[Math.floor(rng() * legal.length)];
      board = placeMove(board, move, player);
      const fast = checkWin(board, move), full = checkWin(board);
      expect(fast.status).toBe(full.status); expect(fast.winner).toBe(full.winner);
      player = nextPlayer(player);
    }
  }
});
