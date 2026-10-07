import { BaseScene } from './base';
import { Button, inRect, type Rect } from '../ui/widgets';
import { fillRoundRect, roundRect, text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { MatchConfig, PlayerConfig } from '../state/types';
import { BODY_TINTS } from '../state/types';
import { applyMove, createBoard, isValidMove, nextPlayer } from '../game';
import type { Board, GameResult, Move, Player } from '../game/types';
import { RigPlayer } from '../rig/player';
import { loadSkin, type Skin } from '../rig/assets';
import { drawPiece } from './pieces';
import { ModeSelectScene } from './modeSelect';
import { ResultScene } from './result';
import { playerName } from './context';
import type { PointerPos } from '../ui/app';
import { t } from '../i18n';

const AI_TIME_LIMIT = 1500;

/** The match: board with zoom/pan + two-step input, characters, AI turns. */
export class MatchScene extends BaseScene {
  name = 'Match';
  board: Board;
  current: Player;
  result: GameResult = { status: 'playing', winner: null, line: null };
  lastMove: Move | null = null;
  pending: Move | null = null;
  private cam = { zoom: 1, ox: 0, oy: 0 };
  private boardRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rigs: [RigPlayer | null, RigPlayer | null] = [null, null];
  private skins: [Skin | undefined, Skin | undefined] = [undefined, undefined];
  private aiToken = 0;
  private aiThinking = false;
  private pops = new Map<number, { s: number }>();
  private banner = 2200;
  private phase: 'play' | 'over' = 'play';
  private confirmBtn: Button | null = null;
  private cancelBtn: Button | null = null;
  private lens: { x: number; y: number; r: number } | null = null;
  private zoomBtn: Button | null = null;
  private pendingSetAt = 0;
  private portrait = true;
  private hintTimer = 4000;

  constructor(g: import('./context').GameContext, public cfg: MatchConfig) {
    super(g);
    this.board = createBoard(cfg.board);
    this.current = cfg.first;
  }

  get size(): number {
    return this.cfg.board.size;
  }
  get twoStep(): boolean {
    return this.size > 3;
  }
  private player(p: Player): PlayerConfig {
    return this.cfg.players[p - 1];
  }

  enter(): void {
    const specs = this.cfg.players.map((p) => ({ animal: p.animal, hueShift: p.hueShift, photo: p.photo, bodyColor: p.photo ? BODY_TINTS[p.bodyTint] : undefined }));
    void Promise.all(specs.map((s) => loadSkin(this.g.rig, s))).then((skins) => {
      this.skins = [skins[0], skins[1]];
      this.rigs = [new RigPlayer(this.g.rig, skins[0], this.cfg.players[0].animal), new RigPlayer(this.g.rig, skins[1], this.cfg.players[1].animal)];
      this.layout(this.w, this.h);
      this.refreshPoses();
    });
    if (this.player(this.current).isAi) this.startAi();
  }

  exit(): void {
    this.g.ai.cancel();
    this.aiToken++;
  }

  onPause(): void {
    // SPEC §8.3: stop AI thinking on pause; resume() re-requests.
    if (this.aiThinking) {
      this.g.ai.cancel();
      this.aiToken++;
      this.aiThinking = false;
    }
  }
  onResume(): void {
    if (this.phase === 'play' && this.player(this.current).isAi && !this.aiThinking) this.startAi();
  }

  build(): void {
    const { safe, u } = this;
    this.portrait = this.h >= this.w;
    this.addBack(() => this.g.go(new ModeSelectScene(this.g)));
    this.addGear();
    const headerH = 60 * u;
    if (this.portrait) {
      const side = Math.min(this.w - 12 * u, this.h - headerH - 150 * u, safe.h * 0.62);
      this.boardRect = { x: this.w / 2 - side / 2, y: this.h / 2 - side / 2 + headerH * 0.25, w: side, h: side };
    } else {
      const side = Math.min(this.h - headerH - 16 * u, this.w * 0.56);
      this.boardRect = { x: this.w / 2 - side / 2, y: headerH + (this.h - headerH - side) / 2, w: side, h: side };
    }
    this.cam = { zoom: 1, ox: 0, oy: 0 };
    this.placeRigs();
    this.confirmBtn = null;
    this.cancelBtn = null;
    this.zoomBtn = null;
    if (this.twoStep) {
      const zb = 40 * u;
      this.zoomBtn = new Button({ label: '⤢', style: 'ghost', fontSize: 20 * u, id: 'zoom-reset', onClick: () => this.resetCam() }).set(this.boardRect.x + this.boardRect.w - zb - 6 * u, this.boardRect.y + 6 * u, zb, zb);
      const bw = Math.min(170 * u, this.boardRect.w * 0.48);
      const bh = 44 * u;
      const by = this.portrait ? this.boardRect.y + this.boardRect.h + 8 * u : this.boardRect.y + this.boardRect.h - bh;
      const bx = this.portrait ? this.w / 2 - bw - 6 * u : this.boardRect.x + this.boardRect.w + 12 * u;
      this.confirmBtn = new Button({ label: t('match.place'), style: 'primary', fontSize: 16 * u, id: 'confirm', onClick: () => this.confirmPending() }).set(bx, by, bw, bh);
      this.cancelBtn = new Button({ label: t('match.cancel'), style: 'ghost', fontSize: 14 * u, id: 'cancel', onClick: () => (this.pending = null) }).set(
        this.portrait ? this.w / 2 + 6 * u : bx,
        this.portrait ? by : by - bh - 8 * u,
        this.portrait ? bw * 0.7 : bw,
        bh,
      );
    }
  }

  private placeRigs(): void {
    const { u } = this;
    const b = this.boardRect;
    const [r1, r2] = this.rigs;
    if (!r1 || !r2) return;
    if (this.portrait) {
      const topZone = b.y - 60 * u;
      const bottomZone = this.h - (b.y + b.h) - (this.twoStep ? 56 * u : 0);
      const hTop = Math.max(40 * u, Math.min(130 * u, topZone * 0.95));
      const hBot = Math.max(40 * u, Math.min(130 * u, bottomZone * 0.9));
      r2.height = hTop;
      r2.groundY = b.y - 6 * u;
      r2.x = this.w * 0.72;
      r2.facing = -1;
      r1.height = hBot;
      r1.groundY = this.h - 6 * u;
      r1.x = this.w * 0.28;
      r1.facing = 1;
    } else {
      const zoneW = b.x - 12 * u;
      const hh = Math.max(60 * u, Math.min(this.h * 0.42, zoneW * 0.9, 220 * u));
      r1.height = hh;
      r1.groundY = b.y + b.h;
      r1.x = b.x / 2;
      r1.facing = 1;
      r2.height = hh;
      r2.groundY = b.y + b.h;
      r2.x = b.x + b.w + (this.w - b.x - b.w) / 2;
      r2.facing = -1;
    }
  }

  private refreshPoses(): void {
    const [r1, r2] = this.rigs;
    if (!r1 || !r2) return;
    if (this.phase === 'over') return;
    const rigOf = (p: Player) => (p === 1 ? r1 : r2);
    const cur = rigOf(this.current);
    const other = rigOf(nextPlayer(this.current));
    if (this.aiThinking && this.player(this.current).isAi) {
      if (cur.current !== 'think') cur.play('think');
    } else if (cur.current !== 'idle') cur.play('idle');
    if (other.current !== 'idle') other.play('idle');
  }

  // ---- camera ---------------------------------------------------------------
  private cellPx(): number {
    return (this.boardRect.w * this.cam.zoom) / this.size;
  }
  private maxZoom(): number {
    return Math.max(1, this.size / 6);
  }
  private clampCam(): void {
    const b = this.boardRect;
    const z = this.cam.zoom;
    const minO = b.w - b.w * z;
    this.cam.ox = Math.min(0, Math.max(minO, this.cam.ox));
    this.cam.oy = Math.min(0, Math.max(minO, this.cam.oy));
  }
  private zoomAt(factor: number, sx: number, sy: number): void {
    const b = this.boardRect;
    const old = this.cam.zoom;
    const nz = Math.max(1, Math.min(this.maxZoom(), old * factor));
    const lx = (sx - b.x - this.cam.ox) / old;
    const ly = (sy - b.y - this.cam.oy) / old;
    this.cam.zoom = nz;
    this.cam.ox = sx - b.x - lx * nz;
    this.cam.oy = sy - b.y - ly * nz;
    this.clampCam();
  }
  /** Screen centre of a cell. */
  private cellCenter(m: Move): PointerPos {
    const b = this.boardRect;
    const c = this.cellPx();
    return { x: b.x + this.cam.ox + (m.col + 0.5) * c, y: b.y + this.cam.oy + (m.row + 0.5) * c };
  }
  private cellAt(p: PointerPos): Move | null {
    const b = this.boardRect;
    if (!inRect(p, b)) return null;
    const c = this.cellPx();
    const col = Math.floor((p.x - b.x - this.cam.ox) / c);
    const row = Math.floor((p.y - b.y - this.cam.oy) / c);
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return null;
    return { row, col };
  }

  // ---- gameplay -------------------------------------------------------------
  private humanTurn(): boolean {
    return this.phase === 'play' && !this.player(this.current).isAi && !this.aiThinking;
  }

  private place(m: Move): void {
    if (this.phase !== 'play' || !isValidMove(this.board, m)) return;
    const { board, result } = applyMove(this.board, m, this.current);
    this.board = board;
    this.lastMove = m;
    this.pending = null;
    this.lens = null;
    const idx = m.row * this.size + m.col;
    const pop = { s: 0 };
    this.pops.set(idx, pop);
    this.tweens.to(pop, { s: 1 }, 220, { onComplete: () => this.pops.delete(idx) });
    this.g.sfx.play('place');
    if (result.status !== 'playing') {
      this.finish(result);
      return;
    }
    this.current = nextPlayer(this.current);
    this.refreshPoses();
    if (this.player(this.current).isAi) this.startAi();
  }

  private confirmPending(): void {
    if (this.pending && this.humanTurn()) this.place(this.pending);
  }

  private startAi(): void {
    if (this.phase !== 'play') return;
    const token = ++this.aiToken;
    this.aiThinking = true;
    this.refreshPoses();
    const started = performance.now();
    const minDelay = this.size === 3 ? 550 : 350;
    this.g.ai
      .requestMove(this.board, this.current, this.cfg.difficulty, AI_TIME_LIMIT)
      .then((move) => {
        if (token !== this.aiToken) return;
        const wait = Math.max(0, minDelay - (performance.now() - started));
        this.tweens.to({}, {}, wait, {
          onComplete: () => {
            if (token !== this.aiToken) return;
            this.aiThinking = false;
            this.place(move);
          },
        });
      })
      .catch((e: Error) => {
        if (token !== this.aiToken) return;
        this.aiThinking = false;
        if (e.message !== 'cancelled') this.g.platform.logError(e);
      });
  }

  private finish(result: GameResult): void {
    this.result = result;
    this.phase = 'over';
    this.g.ai.cancel();
    const store = this.g.store;
    store.stats.matches++;
    if (result.status === 'win' && result.winner) {
      this.g.sfx.play('win');
      const winner = this.player(result.winner);
      const loser = this.player(nextPlayer(result.winner));
      this.rigs[result.winner - 1]?.play('happy');
      this.rigs[nextPlayer(result.winner) - 1]?.play('sad');
      if (this.cfg.opponent === 'ai' && this.cfg.difficulty === 'hard') {
        if (loser.isAi) {
          store.stats.hardStreak++;
          this.g.platform.sendScore(store.stats.hardStreak);
        } else if (winner.isAi) store.stats.hardStreak = 0;
      }
    } else {
      this.g.sfx.play('draw');
    }
    void store.saveStats();
    this.tweens.to({}, {}, 1300, { onComplete: () => this.g.go(new ResultScene(this.g, this.cfg, result)) });
  }

  // ---- update / draw --------------------------------------------------------
  update(dt: number): void {
    this.rigs.forEach((r) => r?.update(dt));
    if (this.banner > 0) this.banner -= dt;
    if (this.hintTimer > 0) this.hintTimer -= dt;
  }

  draw(ctx: Ctx): void {
    this.drawBg(ctx);
    this.drawBoard(ctx);
    this.rigs.forEach((r) => r?.draw(ctx));
    this.drawHeader(ctx);
    if (this.cam.zoom > 1.01) this.zoomBtn?.draw(ctx);
    if (this.pending) {
      this.drawLens(ctx);
      this.confirmBtn?.draw(ctx);
      this.cancelBtn?.draw(ctx);
    } else if (this.twoStep && this.hintTimer > 0 && this.humanTurn()) {
      const u = this.u;
      ctx.globalAlpha = Math.min(1, this.hintTimer / 500);
      text(ctx, t('match.zoomHint'), this.w / 2, this.boardRect.y + this.boardRect.h + 24 * u, { size: 12 * u, color: COLORS.textSoft, weight: 'normal', maxWidth: this.w - 20 });
      ctx.globalAlpha = 1;
    }
    this.buttons.draw(ctx);
  }

  private drawHeader(ctx: Ctx): void {
    const u = this.u;
    const [p1, p2] = this.cfg.players;
    const cur = this.player(this.current);
    const other = this.player(nextPlayer(this.current));
    let label: string;
    if (this.phase === 'over') label = this.result.status === 'draw' ? t('result.draw') : t('result.win', { name: playerName(this.player(this.result.winner!), this.player(nextPlayer(this.result.winner!))) });
    else if (this.aiThinking) label = t('match.thinking');
    else if (this.cfg.opponent === 'ai') label = t('match.yourTurn');
    else label = t('match.turn', { name: playerName(cur, other) });
    const size = this.cfg.opponent === 'human' && this.phase === 'play' ? 26 * u : 22 * u;
    const w = Math.min(this.safe.w - 130 * u, 420 * u);
    fillRoundRect(ctx, this.w / 2 - w / 2, this.safe.y + 12 * u, w, 44 * u, 22 * u, 'rgba(255,255,255,0.85)');
    if (this.phase === 'play') {
      // small piece preview of the current player
      drawPiece(ctx, this.cfg, cur, this.skins[this.current - 1], this.w / 2 - w / 2 + 26 * u, this.safe.y + 34 * u, 34 * u);
    }
    text(ctx, label, this.w / 2 + 12 * u, this.safe.y + 34 * u, { size, color: COLORS.text, maxWidth: w - 70 * u });
    if (this.banner > 0 && this.phase === 'play') {
      const a = Math.min(1, this.banner / 400);
      ctx.globalAlpha = a;
      const first = this.player(this.cfg.first);
      const firstName = playerName(first, first === p1 ? p2 : p1);
      const bw = Math.min(this.safe.w - 40 * u, 300 * u);
      const by = this.boardRect.y + 28 * u;
      fillRoundRect(ctx, this.w / 2 - bw / 2, by - 16 * u, bw, 32 * u, 16 * u, COLORS.accent);
      text(ctx, t('match.first', { name: firstName }), this.w / 2, by, { size: 15 * u, color: COLORS.text, maxWidth: bw - 20 });
      ctx.globalAlpha = 1;
    }
  }

  private drawBoard(ctx: Ctx): void {
    const b = this.boardRect;
    const u = this.u;
    const n = this.size;
    ctx.save();
    ctx.shadowColor = 'rgba(80,40,60,0.2)';
    ctx.shadowBlur = 16 * u;
    fillRoundRect(ctx, b.x, b.y, b.w, b.h, 12 * u, COLORS.board);
    ctx.restore();
    ctx.save();
    roundRect(ctx, b.x, b.y, b.w, b.h, 12 * u);
    ctx.clip();
    const c = this.cellPx();
    const ox = b.x + this.cam.ox;
    const oy = b.y + this.cam.oy;
    // grid
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = n === 3 ? 4 * u : Math.max(1, Math.min(2, c * 0.05));
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      ctx.moveTo(ox + i * c, oy);
      ctx.lineTo(ox + i * c, oy + n * c);
      ctx.moveTo(ox, oy + i * c);
      ctx.lineTo(ox + n * c, oy + i * c);
    }
    ctx.stroke();
    // star points for big boards
    if (n >= 9) {
      ctx.fillStyle = COLORS.boardLine;
      const stars = n === 9 ? [2, 4, 6] : n === 15 ? [3, 7, 11] : n === 17 ? [3, 8, 13] : [3, 9, 15];
      for (const r of stars) for (const col of stars) {
        ctx.beginPath();
        ctx.arc(ox + (col + 0.5) * c, oy + (r + 0.5) * c, Math.max(2, c * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // win line
    if (this.result.line) {
      const first = this.cellCenter(this.result.line[0]);
      const last = this.cellCenter(this.result.line[this.result.line.length - 1]);
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
      ctx.lineWidth = c * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    // pending highlight
    if (this.pending) {
      const p = this.cellCenter(this.pending);
      ctx.fillStyle = COLORS.highlight;
      ctx.fillRect(p.x - c / 2, p.y - c / 2, c, c);
    }
    // pieces (only those on screen)
    const minCol = Math.max(0, Math.floor(-this.cam.ox / c));
    const maxCol = Math.min(n - 1, Math.ceil((b.w - this.cam.ox) / c));
    const minRow = Math.max(0, Math.floor(-this.cam.oy / c));
    const maxRow = Math.min(n - 1, Math.ceil((b.h - this.cam.oy) / c));
    for (let r = minRow; r <= maxRow; r++) {
      for (let col = minCol; col <= maxCol; col++) {
        const v = this.board.cells[r * n + col];
        if (!v) continue;
        const pop = this.pops.get(r * n + col);
        const sc = pop ? 0.4 + 0.6 * pop.s : 1;
        drawPiece(ctx, this.cfg, this.player(v), this.skins[v - 1], ox + (col + 0.5) * c, oy + (r + 0.5) * c, c, sc);
      }
    }
    // last move marker
    if (this.lastMove && this.phase === 'play') {
      const p = this.cellCenter(this.lastMove);
      ctx.strokeStyle = COLORS.lastMove;
      ctx.lineWidth = Math.max(2, c * 0.08);
      ctx.beginPath();
      ctx.arc(p.x, p.y, c * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // tap hint for empty 3x3 board
    if (n === 3 && !this.lastMove && this.humanTurn()) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 300);
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 3 * u;
      roundRect(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 12 * u);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** Magnified view around the pending cell (SPEC §5.1, mis-tap prevention). */
  private drawLens(ctx: Ctx): void {
    if (!this.pending) return;
    const u = this.u;
    const b = this.boardRect;
    const R = Math.min(b.w * 0.26, 110 * u);
    const center = this.cellCenter(this.pending);
    const above = center.y - R * 2.4 > this.safe.y + 60 * u;
    const lx = Math.max(b.x + R, Math.min(b.x + b.w - R, center.x));
    const ly = above ? center.y - R * 1.5 : center.y + R * 1.5;
    this.lens = { x: lx, y: ly, r: R };
    const span = 5; // 5x5 cells
    const lc = (R * 2) / span;
    ctx.save();
    ctx.shadowColor = 'rgba(60,30,45,0.35)';
    ctx.shadowBlur = 14 * u;
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.board;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.clip();
    const n = this.size;
    const r0 = this.pending.row - 2;
    const c0 = this.pending.col - 2;
    ctx.strokeStyle = COLORS.boardLine;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < span; i++) {
      for (let j = 0; j < span; j++) {
        const r = r0 + i;
        const col = c0 + j;
        const x = lx - R + j * lc;
        const y = ly - R + i * lc;
        if (r < 0 || col < 0 || r >= n || col >= n) {
          ctx.fillStyle = '#EADDE2';
          ctx.fillRect(x, y, lc, lc);
          continue;
        }
        ctx.strokeRect(x, y, lc, lc);
        if (r === this.pending.row && col === this.pending.col) {
          ctx.fillStyle = COLORS.highlight;
          ctx.fillRect(x, y, lc, lc);
        }
        const v = this.board.cells[r * n + col];
        if (v) drawPiece(ctx, this.cfg, this.player(v), this.skins[v - 1], x + lc / 2, y + lc / 2, lc);
        if (this.lastMove && this.lastMove.row === r && this.lastMove.col === col) {
          ctx.strokeStyle = COLORS.lastMove;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + lc / 2, y + lc / 2, lc * 0.44, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = COLORS.boardLine;
          ctx.lineWidth = 1.5;
        }
      }
    }
    // ghost piece in the pending cell
    ctx.globalAlpha = 0.55;
    drawPiece(ctx, this.cfg, this.player(this.current), this.skins[this.current - 1], lx, ly, lc);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 3 * u;
    ctx.stroke();
  }

  private lensCellAt(p: PointerPos): Move | null {
    if (!this.lens || !this.pending) return null;
    const { x, y, r } = this.lens;
    if (Math.hypot(p.x - x, p.y - y) > r) return null;
    const lc = (r * 2) / 5;
    const j = Math.floor((p.x - (x - r)) / lc);
    const i = Math.floor((p.y - (y - r)) / lc);
    const m = { row: this.pending.row - 2 + i, col: this.pending.col - 2 + j };
    if (m.row < 0 || m.col < 0 || m.row >= this.size || m.col >= this.size) return null;
    return m;
  }

  // ---- input ----------------------------------------------------------------
  onPointerDown(p: PointerPos): void {
    super.onPointerDown(p);
    if (this.pending) {
      this.confirmBtn && inRect(p, this.confirmBtn.rect) && (this.confirmBtn.pressed = true);
      this.cancelBtn && inRect(p, this.cancelBtn.rect) && (this.cancelBtn.pressed = true);
    }
  }
  onPointerUp(): void {
    super.onPointerUp();
    if (this.confirmBtn) this.confirmBtn.pressed = false;
    if (this.cancelBtn) this.cancelBtn.pressed = false;
  }

  onTap(p: PointerPos): void {
    if (this.buttons.tap(p)) {
      this.g.sfx.play('button');
      return;
    }
    if (this.zoomBtn && this.cam.zoom > 1.01 && inRect(p, this.zoomBtn.rect)) {
      this.resetCam();
      return;
    }
    if (!this.humanTurn()) return;
    if (this.pending) {
      if (this.confirmBtn && inRect(p, this.confirmBtn.rect)) {
        this.confirmPending();
        return;
      }
      if (this.cancelBtn && inRect(p, this.cancelBtn.rect)) {
        this.pending = null;
        this.lens = null;
        return;
      }
      const lm = this.lensCellAt(p);
      if (lm) {
        this.selectCell(lm);
        return;
      }
    }
    const m = this.cellAt(p);
    if (!m) return;
    this.selectCell(m);
  }

  private selectCell(m: Move): void {
    if (!isValidMove(this.board, m)) {
      // SPEC §4: occupied cells don't react.
      return;
    }
    if (!this.twoStep) {
      this.place(m);
      return;
    }
    if (this.pending && this.pending.row === m.row && this.pending.col === m.col) {
      this.confirmPending();
      return;
    }
    this.pending = m;
    this.pendingSetAt = performance.now();
    this.g.sfx.play('button');
  }

  /**
   * Double tap (SPEC §5.1): resets zoom. The first tap of the pair already
   * selected a cell, so a fresh double tap just clears that selection. If the
   * highlighted cell was chosen earlier (the player paused to check the lens)
   * and is tapped twice, that is a confirmation.
   */
  onDoubleTap(p: PointerPos): void {
    if (!this.twoStep) return;
    if (this.pending && this.humanTurn() && performance.now() - this.pendingSetAt > 300) {
      const m = this.lensCellAt(p) ?? this.cellAt(p);
      if (m && m.row === this.pending.row && m.col === this.pending.col) {
        this.confirmPending();
        return;
      }
    }
    this.pending = null;
    this.lens = null;
    this.resetCam();
  }

  private resetCam(): void {
    this.cam = { zoom: 1, ox: 0, oy: 0 };
  }
  onPan(dx: number, dy: number): void {
    if (!this.twoStep || this.cam.zoom <= 1) return;
    this.cam.ox += dx;
    this.cam.oy += dy;
    this.clampCam();
  }
  onPinch(scale: number, cx: number, cy: number): void {
    if (this.twoStep) this.zoomAt(scale, cx, cy);
  }
  onWheel(deltaY: number, p: PointerPos): void {
    if (this.twoStep && inRect(p, this.boardRect)) this.zoomAt(deltaY > 0 ? 0.9 : 1.1, p.x, p.y);
  }
  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.pending) {
      this.pending = null;
      this.lens = null;
      return true;
    }
    if (e.key === 'Enter' && this.pending) {
      this.confirmPending();
      return true;
    }
    return false;
  }
}
