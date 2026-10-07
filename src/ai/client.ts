import { chooseMove } from './engine';
import { cloneBoard } from '../game/board';
import type { Board, Move, Player } from '../game/types';
import type { AiResponse, Difficulty } from './types';
interface Pending { id: number; resolve: (move: Move) => void; reject: (error: Error) => void }
export class AiClient {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private sequence = 0;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor() {
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<AiResponse | { type: 'error'; id: number; message: string }>) => {
        const response = event.data;
        if (this.pending?.id !== response.id) return;
        const pending = this.pending;
        this.pending = null;
        if (response.type === 'error') pending.reject(new Error(response.message));
        else pending.resolve(response.move);
      };
      this.worker.onerror = event => {
        this.pending?.reject(new Error(event.message || 'AI worker failed'));
        this.pending = null;
      };
    } catch { this.worker = null; }
  }
  requestMove(board: Board, player: Player, difficulty: Difficulty, timeLimitMs = 1500): Promise<Move> {
    if (this.disposed) return Promise.reject(new Error('disposed'));
    this.cancel();
    const id = ++this.sequence;
    const snapshot = cloneBoard(board);
    return new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject };
      if (this.worker) {
        try { this.worker.postMessage({ type: 'move', id, board: snapshot, player, difficulty, timeLimitMs }); }
        catch (error) { this.pending = null; reject(error instanceof Error ? error : new Error(String(error))); }
      } else {
        this.timer = setTimeout(() => {
          this.timer = null;
          if (this.pending?.id !== id) return;
          try { resolve(chooseMove(snapshot, player, difficulty, { timeLimitMs })); }
          catch (error) { reject(error instanceof Error ? error : new Error(String(error))); }
          this.pending = null;
        }, 0);
      }
    });
  }
  cancel(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    pending.reject(new Error('cancelled'));
    this.worker?.postMessage({ type: 'cancel', id: pending.id });
  }
  dispose(): void { this.cancel(); this.worker?.terminate(); this.worker = null; this.disposed = true; }
}
