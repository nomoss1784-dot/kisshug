import { chooseMove } from './engine';
import type { AiResponse, AiWorkerInbound } from './types';
const cancelled = new Set<number>();
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<AiWorkerInbound>) => {
  const request = event.data;
  if (request.type === 'cancel') { cancelled.add(request.id); return; }
  if (cancelled.has(request.id)) return;
  try {
    const started = performance.now();
    const move = chooseMove(request.board, request.player, request.difficulty, { timeLimitMs: request.timeLimitMs });
    const response: AiResponse = { type: 'move', id: request.id, move, elapsedMs: performance.now() - started };
    if (!cancelled.has(request.id)) scope.postMessage(response);
  } catch (error) {
    if (!cancelled.has(request.id)) scope.postMessage({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) });
  }
};
