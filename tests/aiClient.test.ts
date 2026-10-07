import { afterEach, expect, it, vi } from 'vitest';
import { AiClient } from '../src/ai/client';
import { createBoard } from '../src/game/board';
const board = createBoard({ size: 3, k: 3 });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('falls back asynchronously when workers are unavailable', async () => {
  vi.stubGlobal('Worker', undefined); vi.useFakeTimers();
  const client = new AiClient();
  const promise = client.requestMove(board, 1, 'hard');
  await vi.runAllTimersAsync();
  expect(board.cells[(await promise).row * 3 + (await promise).col]).toBe(0);
  client.dispose();
  await expect(client.requestMove(board, 1, 'hard')).rejects.toThrow('disposed');
});
it('cancels fallback work and rejects superseded requests', async () => {
  vi.stubGlobal('Worker', undefined); vi.useFakeTimers();
  const client = new AiClient();
  const first = client.requestMove(board, 1, 'hard');
  const rejected = expect(first).rejects.toThrow(/^cancelled$/);
  const second = client.requestMove(board, 1, 'hard');
  await rejected;
  const cancelled = expect(second).rejects.toThrow(/^cancelled$/);
  client.cancel(); await cancelled;
  await vi.runAllTimersAsync(); client.dispose();
});
it('matches worker responses by id and ignores stale results', async () => {
  class MockWorker {
    static instance: MockWorker;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { MockWorker.instance = this; }
  }
  vi.stubGlobal('Worker', MockWorker);
  const client = new AiClient();
  const first = client.requestMove(board, 1, 'hard');
  const rejected = expect(first).rejects.toThrow('cancelled');
  const second = client.requestMove(board, 1, 'hard');
  await rejected;
  const worker = MockWorker.instance;
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'cancel', id: 1 });
  worker.onmessage?.({ data: { type: 'move', id: 1, move: { row: 0, col: 0 } } });
  worker.onmessage?.({ data: { type: 'move', id: 2, move: { row: 1, col: 1 } } });
  await expect(second).resolves.toEqual({ row: 1, col: 1 });
  const failed = client.requestMove(board, 1, 'hard');
  worker.onmessage?.({ data: { type: 'error', id: 3, message: 'No legal moves' } });
  await expect(failed).rejects.toThrow('No legal moves');
  client.dispose(); expect(worker.terminate).toHaveBeenCalledOnce();
});
