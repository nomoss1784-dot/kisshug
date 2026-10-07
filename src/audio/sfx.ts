import manifest from '../../assets/sfx/manifest.json';

/**
 * Sound effects. Real files can be dropped into assets/sfx/<name>.mp3 and
 * listed in assets/sfx/manifest.json (e.g. "place": "./sfx/place.mp3");
 * anything missing is synthesised with WebAudio so the game ships with zero
 * audio bytes.
 */
export type SfxName = 'place' | 'win' | 'draw' | 'button' | 'kiss' | 'hug' | 'shake';
const NAMES: SfxName[] = ['place', 'win', 'draw', 'button', 'kiss', 'hug', 'shake'];

export class Sfx {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  private files: Partial<Record<SfxName, string>> = {};
  enabled = true;

  init(baseUrl: string): void {
    const m = manifest as Record<string, string>;
    for (const name of NAMES) {
      if (typeof m[name] === 'string') this.files[name] = m[name].replace(/^\.\//, baseUrl);
    }
  }

  /** Must be called from a user gesture on iOS. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const file = this.files[name];
    if (file) {
      void this.playFile(name, file);
      return;
    }
    this.synth(name);
  }

  private async playFile(name: SfxName, url: string): Promise<void> {
    const ctx = this.ctx!;
    let buf = this.buffers.get(name);
    if (!buf) {
      try {
        const res = await fetch(url);
        buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(name, buf);
      } catch {
        this.synth(name);
        return;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    const t0 = ctx.currentTime + start;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private synth(name: SfxName): void {
    switch (name) {
      case 'place':
        this.tone(660, 0, 0.08, 'triangle', 0.25, 440);
        break;
      case 'button':
        this.tone(880, 0, 0.06, 'sine', 0.15);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.18, 'triangle', 0.2));
        break;
      case 'draw':
        this.tone(440, 0, 0.2, 'sine', 0.15);
        this.tone(392, 0.2, 0.3, 'sine', 0.15);
        break;
      case 'kiss':
        this.tone(1200, 0, 0.05, 'sine', 0.2, 1800);
        this.tone(900, 0.06, 0.12, 'sine', 0.2, 1500);
        break;
      case 'hug':
        this.tone(330, 0, 0.5, 'sine', 0.15, 520);
        this.tone(495, 0.1, 0.5, 'sine', 0.1, 660);
        break;
      case 'shake':
        [0, 0.15, 0.3].forEach((d) => this.tone(500, d, 0.07, 'square', 0.08, 420));
        break;
    }
  }
}
