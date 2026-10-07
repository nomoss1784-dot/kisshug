import type { Platform } from '../platform/types';
import type { MatchConfig, SavedPhotos, Settings, Stats } from './types';
import { setLang, normaliseLang, type Lang } from '../i18n';

const KEY_SETTINGS = 'settings.v1';
const KEY_STATS = 'stats.v1';
const KEY_PHOTOS = 'photos.v1';

const defaultSettings = (): Settings => ({
  sound: true,
  lang: 'auto',
  lv3Size: 15,
  seen: { kiss: false, hug: false, shake: false },
});

/** Central mutable game state + persistence through the Platform. */
export class Store {
  settings: Settings = defaultSettings();
  stats: Stats = { hardStreak: 0, matches: 0 };
  /** Photos the player opted in to keep. */
  photos: SavedPhotos = { p1: null, p2: null };
  /** Photos for this session (in memory only unless opted in). */
  sessionPhotos: SavedPhotos = { p1: null, p2: null };
  match: MatchConfig | null = null;
  /** Alternates each match so the first player changes (SPEC §4). */
  nextFirst: 1 | 2 = 1;

  constructor(public platform: Platform) {}

  async load(): Promise<void> {
    const s = await this.platform.load(KEY_SETTINGS);
    if (s) {
      try {
        const parsed = JSON.parse(s) as Partial<Settings>;
        this.settings = { ...defaultSettings(), ...parsed, seen: { ...defaultSettings().seen, ...(parsed.seen ?? {}) } };
      } catch {
        /* keep defaults */
      }
    }
    const st = await this.platform.load(KEY_STATS);
    if (st) {
      try {
        this.stats = { ...this.stats, ...(JSON.parse(st) as Partial<Stats>) };
      } catch {
        /* keep defaults */
      }
    }
    const ph = await this.platform.load(KEY_PHOTOS);
    if (ph) {
      try {
        this.photos = { ...this.photos, ...(JSON.parse(ph) as Partial<SavedPhotos>) };
        this.sessionPhotos = { ...this.photos };
      } catch {
        /* ignore */
      }
    }
    this.applyLang();
  }

  resolvedLang(): Lang {
    return this.settings.lang === 'auto' ? normaliseLang(this.platform.language()) : this.settings.lang;
  }

  applyLang(): void {
    setLang(this.resolvedLang());
  }

  saveSettings(): Promise<void> {
    this.applyLang();
    return this.platform.save(KEY_SETTINGS, JSON.stringify(this.settings));
  }

  saveStats(): Promise<void> {
    return this.platform.save(KEY_STATS, JSON.stringify(this.stats));
  }

  savePhotos(): Promise<void> {
    return this.platform.save(KEY_PHOTOS, JSON.stringify(this.photos));
  }

  async deleteSavedPhotos(): Promise<void> {
    this.photos = { p1: null, p2: null };
    await this.platform.remove(KEY_PHOTOS);
  }

  soundEnabled(): boolean {
    return this.settings.sound && this.platform.isAudioEnabled();
  }
}
