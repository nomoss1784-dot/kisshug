import { BaseScene } from './base';
import { Button } from '../ui/widgets';
import { panel, text, type Ctx } from '../ui/draw';
import { COLORS } from '../ui/theme';
import type { Lv3Size } from '../state/types';
import type { PointerPos } from '../ui/app';
import { t } from '../i18n';

/** Settings overlay (Esc closes it). Small © NOMOSS credit lives here (SPEC §8.2). */
export class SettingsScene extends BaseScene {
  name = 'Settings';
  transparent = true;
  private deletedFlash = 0;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  build(): void {
    const { safe, u } = this;
    const s = this.g.store.settings;
    const pw = Math.min(safe.w - 32 * u, 360 * u);
    const rowH = Math.min(46 * u, safe.h / 11);
    const gap = 10 * u;
    const rows = 6;
    const ph = rowH * rows + gap * (rows + 1) + 90 * u;
    const px = this.w / 2 - pw / 2;
    const py = Math.max(safe.y + 8 * u, this.h / 2 - ph / 2);
    this.box = { x: px, y: py, w: pw, h: ph };
    const labelW = pw * 0.42;
    const ctlX = px + 16 * u + labelW;
    const ctlW = pw - 32 * u - labelW;
    let y = py + 60 * u;
    // sound
    this.buttons.add(
      new Button({
        label: s.sound ? t('common.on') : t('common.off'),
        style: s.sound ? 'secondary' : 'ghost',
        fontSize: 16 * u,
        id: 'sound',
        onClick: () => {
          s.sound = !s.sound;
          this.g.sfx.enabled = this.g.store.soundEnabled();
          void this.g.store.saveSettings();
          this.layout(this.w, this.h);
        },
      }).set(ctlX, y, ctlW, rowH),
    );
    y += rowH + gap;
    // language
    const langs: Array<'ja' | 'en'> = ['ja', 'en'];
    const lw = (ctlW - gap) / 2;
    const cur = this.g.store.resolvedLang();
    langs.forEach((l, i) => {
      this.buttons.add(
        new Button({
          label: t(`settings.lang.${l}`),
          style: cur === l ? 'choiceSelected' : 'choice',
          fontSize: 15 * u,
          id: `lang-${l}`,
          onClick: () => {
            s.lang = l;
            void this.g.store.saveSettings();
            this.g.app.resize();
          },
        }).set(ctlX + i * (lw + gap), y, lw, rowH),
      );
    });
    y += rowH + gap;
    // lv3 size
    const sizes: Lv3Size[] = [15, 17, 19];
    const sw = (ctlW - gap * 2) / 3;
    sizes.forEach((sz, i) => {
      this.buttons.add(
        new Button({
          label: `${sz}`,
          style: s.lv3Size === sz ? 'choiceSelected' : 'choice',
          fontSize: 15 * u,
          id: `lv3-${sz}`,
          onClick: () => {
            s.lv3Size = sz;
            void this.g.store.saveSettings();
            this.layout(this.w, this.h);
          },
        }).set(ctlX + i * (sw + gap), y, sw, rowH),
      );
    });
    y += rowH + gap;
    // delete photos
    const hasPhotos = !!(this.g.store.photos.p1 || this.g.store.photos.p2);
    this.buttons.add(
      new Button({
        label: this.deletedFlash > 0 ? t('settings.deleted') : t('settings.deletePhotos'),
        style: 'danger',
        enabled: hasPhotos,
        fontSize: 15 * u,
        id: 'delete-photos',
        onClick: () => {
          void this.g.store.deleteSavedPhotos().then(() => {
            this.g.store.sessionPhotos = { p1: null, p2: null };
            this.deletedFlash = 1500;
            this.layout(this.w, this.h);
          });
        },
      }).set(px + 16 * u, y, pw - 32 * u, rowH),
    );
    y += rowH + gap;
    this.streakY = y + rowH * 0.3;
    y += rowH * 0.7 + gap;
    this.creditY = y + rowH * 0.2;
    y += rowH * 0.6 + gap;
    this.buttons.add(new Button({ label: t('settings.close'), style: 'primary', fontSize: 18 * u, id: 'close', onClick: () => this.g.app.pop() }).set(px + 16 * u, y, pw - 32 * u, rowH));
  }

  private streakY = 0;
  private creditY = 0;

  update(dt: number): void {
    if (this.deletedFlash > 0) {
      this.deletedFlash -= dt;
      if (this.deletedFlash <= 0) this.layout(this.w, this.h);
    }
  }

  draw(ctx: Ctx): void {
    ctx.fillStyle = 'rgba(60, 30, 45, 0.45)';
    ctx.fillRect(0, 0, this.w, this.h);
    const { x, y, w, h } = this.box;
    const u = this.u;
    panel(ctx, x, y, w, h, 22 * u);
    text(ctx, t('settings.title'), x + w / 2, y + 30 * u, { size: 22 * u });
    const labels = [t('settings.sound'), t('settings.lang'), t('settings.boardSize')];
    const rowH = Math.min(46 * u, this.safe.h / 11);
    const gap = 10 * u;
    labels.forEach((l, i) => text(ctx, l, x + 16 * u, y + 60 * u + i * (rowH + gap) + rowH / 2, { size: 15 * u, align: 'left', color: COLORS.text, maxWidth: w * 0.4 }));
    text(ctx, t('settings.streak', { n: this.g.store.stats.hardStreak }), x + w / 2, this.streakY, { size: 13 * u, color: COLORS.textSoft, weight: 'normal' });
    text(ctx, `${t('settings.credit')}  ·  ${t('settings.version', { v: '0.2.0' })}`, x + w / 2, this.creditY, { size: 11 * u, color: COLORS.textSoft, weight: 'normal' });
    this.buttons.draw(ctx);
  }

  onTap(p: PointerPos): void {
    if (this.buttons.tap(p)) {
      this.g.sfx.play('button');
      return;
    }
    const { x, y, w, h } = this.box;
    if (p.x < x || p.x > x + w || p.y < y || p.y > y + h) this.g.app.pop();
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.g.app.pop();
      return true;
    }
    return false;
  }
}
