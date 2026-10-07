import { chooseMove } from './engine';
import { cloneBoard } from '../game/board';
import type { Board, Move, Player } from '../game/types';
import type { AiResponse, Difficulty } from './types';

interface Pending {
  id: number;
  resolve: (move: Move) => void;
  reject: (error: Error) => void;
}
interface Request {
  id: number;
  board: Board;
  player: Player;
  difficulty: Difficulty;
  timeLimitMs: number;
}

/** Runs the AI in a Web Worker; falls back to the main thread if the worker is unavailable. */
export class AiClient {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private lastRequest: Request | null = null;
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
      this.worker.onerror = (event) => {
        // Worker unavailable (e.g. file:// or CSP): finish this request on the main thread and stop using the worker.
        event.preventDefault?.();
        const pending = this.pending;
        this.pending = null;
        this.worker?.terminate();
        this.worker = null;
        const r = this.lastRequest;
        if (pending && r && r.id === pending.id) this.runSync(r, pending);
        else pending?.reject(new Error(event.message || 'AI worker failed'));
      };
    } catch {
      this.worker = null;
    }
  }

  private runSync(r: Request, pending: Pending): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        pending.resolve(chooseMove(r.board, r.player, r.difficulty, { timeLimitMs: r.timeLimitMs }));
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, 0);
  }

  requestMove(board: Board, player: Player, difficulty: Difficulty, timeLimitMs = 1500): Promise<Move> {
    if (this.disposed) return Promise.reject(new Error('disposed'));
    this.cancel();
    const id = ++this.sequence;
    const snapshot = cloneBoard(board);
    return new Promise((resolve, reject) => {
      const pending: Pending = { id, resolve, reject };
      this.pending = pending;
      const req: Request = { id, board: snapshot, player, difficulty, timeLimitMs };
      this.lastRequest = req;
      if (this.worker) {
        try {
          this.worker.postMessage({ type: 'move', id, board: snapshot, player, difficulty, timeLimitMs });
        } catch (error) {
          this.pending = null;
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      } else {
        this.runSync(req, {
          id,
          resolve: (m) => {
            if (this.pending?.id !== id) return;
            this.pending = null;
            resolve(m);
          },
          reject: (e) => {
            if (this.pending?.id !== id) return;
            this.pending = null;
            reject(e);
          },
        });
      }
    });
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    pending.reject(new Error('cancelled'));
    this.worker?.postMessage({ type: 'cancel', id: pending.id });
  }

  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.disposed = true;
  }
}
