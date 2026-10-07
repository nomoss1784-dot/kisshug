import { cloneBoard, emptyCells, placeMove } from '../game/board';
import { checkWin } from '../game/winCheck';
import { nextPlayer } from '../game/rules';
import type { Board, Move, Player } from '../game/types';
import type { AiOptions, Difficulty } from './types';

const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
const WIN = 10000000;
const memo = new Map<string, number>();
function minimax(board: Board, player: Player): number {
  const result = checkWin(board);
  if (result.status === 'win') return result.winner === player ? 1 : -1;
  if (result.status === 'draw') return 0;
  const key = board.cells.join('') + player;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let best = -2;
  for (const move of emptyCells(board)) {
    best = Math.max(best, -minimax(placeMove(board, move, player), nextPlayer(player)));
    if (best === 1) break;
  }
  memo.set(key, best);
  return best;
}
function candidates(board: Board): Move[] {
  const size = board.config.size;
  const indices = new Set<number>();
  board.cells.forEach((cell, i) => {
    if (!cell) return;
    const r = Math.floor(i / size), c = i % size;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const row = r + dr, col = c + dc;
      if (row >= 0 && col >= 0 && row < size && col < size && board.cells[row * size + col] === 0) indices.add(row * size + col);
    }
  });
  return [...indices].sort((a, b) => a - b).map(i => ({ row: Math.floor(i / size), col: i % size }));
}
// Score contiguous threats and broken lines inside each k-cell window through a move.
function threat(board: Board, move: Move, player: Player): number {
  const { size, k } = board.config;
  const cell = (r: number, c: number): number => r < 0 || c < 0 || r >= size || c >= size ? -1 : (r === move.row && c === move.col ? player : board.cells[r * size + c]);
  let score = 0;
  for (const [dr, dc] of directions) {
    let before = 0, after = 0;
    while (cell(move.row - (before + 1) * dr, move.col - (before + 1) * dc) === player) before++;
    while (cell(move.row + (after + 1) * dr, move.col + (after + 1) * dc) === player) after++;
    const length = before + after + 1;
    if (length >= k) return WIN;
    const open = Number(cell(move.row - (before + 1) * dr, move.col - (before + 1) * dc) === 0) + Number(cell(move.row + (after + 1) * dr, move.col + (after + 1) * dc) === 0);
    if (length === k - 1) score += open === 2 ? 1000000 : open === 1 ? 100000 : 0;
    else if (length === k - 2) score += open === 2 ? 10000 : open === 1 ? 1000 : 0;
    else if (length >= 2) score += open === 2 ? 200 : open === 1 ? 40 : 0;
    for (let offset = 1 - k; offset <= 0; offset++) {
      let stones = 0, blocked = false;
      for (let j = 0; j < k; j++) {
        const v = cell(move.row + (offset + j) * dr, move.col + (offset + j) * dc);
        if (v === player) stones++; else if (v !== 0) { blocked = true; break; }
      }
      if (!blocked) score += stones === k - 1 ? 50000 : stones === k - 2 ? 500 : stones * stones;
    }
  }
  return score;
}
interface Ranked { move: Move; own: number; opponent: number; score: number }
function rank(board: Board, player: Player, checkDeadline?: () => void): Ranked[] {
  const centre = (board.config.size - 1) / 2;
  return candidates(board).map(move => {
    checkDeadline?.();
    const own = threat(board, move, player), opponent = threat(board, move, nextPlayer(player));
    return { move, own, opponent, score: own + opponent * 1.1 - (Math.abs(move.row - centre) + Math.abs(move.col - centre)) };
  }).sort((a, b) => b.score - a.score);
}
export function chooseMove(board: Board, player: Player, difficulty: Difficulty, opts: AiOptions): Move {
  const started = performance.now();
  const deadline = started + Math.max(0, opts.timeLimitMs);
  const rng = opts.rng ?? Math.random;
  const pick = <T>(items: T[]): T => items[Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)))];
  const legal = emptyCells(board);
  if (!legal.length) throw new Error('No legal moves');
  if (board.config.size === 3 && board.config.k === 3) {
    const wins = legal.filter(move => checkWin(placeMove(board, move, player), move).winner === player);
    if (wins.length) return wins[0];
    const scores = legal.map(move => ({ move, score: -minimax(placeMove(board, move, player), nextPlayer(player)) }));
    const best = Math.max(...scores.map(item => item.score));
    const optimal = scores.filter(item => item.score === best)[0].move;
    if (difficulty === 'normal' && rng() < 0.25) {
      const safe = legal.filter(move => {
        const next = placeMove(board, move, player);
        return !emptyCells(next).some(reply => checkWin(placeMove(next, reply, nextPlayer(player)), reply).winner === nextPlayer(player));
      });
      return safe.length ? pick(safe) : optimal;
    }
    if (difficulty === 'easy') {
      const blocks = legal.filter(move => checkWin(placeMove(board, move, nextPlayer(player)), move).winner === nextPlayer(player));
      if (blocks.length && rng() < 0.5) return blocks[0];
      if (rng() < 0.55) return pick(legal);
    }
    return optimal;
  }
  if (legal.length === board.cells.length) return { row: Math.floor(board.config.size / 2), col: Math.floor(board.config.size / 2) };
  const work = cloneBoard(board);
  const ranked = rank(work, player); // Depth one is always completed, even for a zero budget.
  const win = ranked.find(item => item.own >= WIN);
  if (win) return win.move;
  const block = ranked.find(item => item.opponent >= WIN);
  if (block) return block.move;
  if (difficulty !== 'easy') {
    const four = ranked.find(item => item.own >= 1000000);
    if (four) return four.move;
    const defence = ranked.find(item => item.opponent >= 1000000);
    if (defence) return defence.move;
  }
  if (difficulty === 'easy') return rng() < 0.4 ? pick(ranked).move : ranked[0].move;
  if (difficulty === 'normal' && rng() < 0.15) return pick(ranked.slice(0, 3)).move;
  let bestMove = ranked[0].move;
  const timeout = Symbol('deadline');
  const checkDeadline = () => { if (performance.now() >= deadline) throw timeout; };
  function search(turn: Player, depth: number, alpha: number, beta: number): number {
    checkDeadline();
    const moves = rank(work, turn, checkDeadline);
    checkDeadline();
    if (!moves.length) return 0;
    if (moves.some(item => item.own >= WIN)) return WIN + depth;
    if (depth === 0) return moves[0].own - Math.max(...moves.map(item => item.opponent)) * 1.1;
    let value = -Infinity;
    for (const item of moves.slice(0, depth >= 3 ? 8 : 12)) {
      checkDeadline();
      const i = item.move.row * work.config.size + item.move.col;
      work.cells[i] = turn;
      let score: number;
      try { score = -search(nextPlayer(turn), depth - 1, -beta, -alpha); }
      finally { work.cells[i] = 0; }
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  const maxDepth = difficulty === 'normal' ? 2 : 8;
  for (let depth = 2; depth <= maxDepth; depth++) {
    let iterationBest = bestMove, value = -Infinity;
    try {
      for (const item of ranked.slice(0, 12)) {
        checkDeadline();
        const i = item.move.row * work.config.size + item.move.col;
        work.cells[i] = player;
        let score: number;
        try { score = -search(nextPlayer(player), depth - 1, -Infinity, -value); }
        finally { work.cells[i] = 0; }
        if (score > value) { value = score; iterationBest = item.move; }
      }
      bestMove = iterationBest;
    } catch (error) { if (error !== timeout) throw error; break; }
  }
  return bestMove;
}
