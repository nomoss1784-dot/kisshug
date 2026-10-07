// Generates placeholder character PNGs following SPEC §6.3. Run: node scripts/gen-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, hex } from './png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'characters');
const WHITE = hex('#FFFFFF');
const OUTLINE = hex('#5A3A48', 0.9);
const EYE = hex('#3B2430');
const BLUSH = hex('#FF6E8C', 0.55);

const animals = {
  cat: { body: '#F8E8C6', accent: '#F2A65A', dark: '#C77A2E' },
  dog: { body: '#DDAE74', accent: '#B98250', dark: '#8A5A2E' },
  rabbit: { body: '#FFFFFF', accent: '#F7B4C8', dark: '#D98AA3' },
  bear: { body: '#A5744A', accent: '#7A5030', dark: '#4E3119' },
};

function save(rel, canvas) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, canvas.render().toPNG());
  console.log('wrote', rel);
}

// ---- common parts (white; tinted at runtime) -------------------------------
{
  // body 512x512: torso capsule, pivot (256,440), neck at (256,70)
  const c = new Canvas(512, 512);
  c.roundRect(150, 62, 212, 380, 110, OUTLINE).roundRect(156, 68, 200, 368, 104, WHITE);
  // belly patch
  c.ellipse(256, 300, 70, 95, hex('#000000', 0.06));
  save('common/body.png', c);
  for (const side of ['l', 'r']) {
    // arm 256x256: pivot (128,30), hangs to (128,215)
    const a = new Canvas(256, 256);
    a.capsule(128, 40, 128, 200, 40, OUTLINE).capsule(128, 40, 128, 200, 34, WHITE).circle(128, 206, 36, OUTLINE).circle(128, 206, 30, WHITE);
    save(`common/arm_${side}.png`, a);
    // leg 256x256: pivot (128,30), down to foot at (128,200)
    const l = new Canvas(256, 256);
    l.capsule(128, 40, 128, 190, 44, OUTLINE).capsule(128, 40, 128, 190, 38, WHITE).ellipse(132, 208, 58, 32, OUTLINE).ellipse(132, 206, 52, 26, WHITE);
    save(`common/leg_${side}.png`, l);
  }
}

// ---- animal heads / ears / tails ------------------------------------------
function face(c, pal, blush) {
  c.circle(256, 240, 226, OUTLINE).circle(256, 240, 220, hex(pal.body));
  // muzzle
  c.ellipse(256, 300, 95, 70, hex('#FFFFFF', 0.45));
  // eyes
  c.circle(188, 220, 24, EYE).circle(324, 220, 24, EYE).circle(198, 210, 8, WHITE).circle(334, 210, 8, WHITE);
  // nose + mouth
  c.ellipse(256, 282, 18, 12, hex(pal.dark));
  c.capsule(236, 306, 256, 318, 5, hex(pal.dark)).capsule(256, 318, 276, 306, 5, hex(pal.dark));
  if (blush) c.ellipse(150, 290, 42, 24, BLUSH).ellipse(362, 290, 42, 24, BLUSH);
}

for (const [id, pal] of Object.entries(animals)) {
  for (const blush of [false, true]) {
    const c = new Canvas(512, 512);
    face(c, pal, blush);
    save(`${id}/head${blush ? '_blush' : ''}.png`, c);
  }
  // ears 256x256, pivot (128,230) at the base, pointing up
  for (const side of ['l', 'r']) {
    const e = new Canvas(256, 256);
    const mirror = side === 'l' ? -1 : 1;
    if (id === 'cat') {
      e.polygon([[60, 236], [196, 236], [128 + mirror * 20, 30]], OUTLINE).polygon([[72, 228], [184, 228], [128 + mirror * 18, 48]], hex(pal.body)).polygon([[96, 220], [160, 220], [128 + mirror * 12, 90]], hex(pal.accent, 0.8));
    } else if (id === 'dog') {
      e.ellipse(128, 150, 52, 110, OUTLINE, mirror * 0.25).ellipse(128, 150, 46, 104, hex(pal.accent), mirror * 0.25);
    } else if (id === 'rabbit') {
      e.ellipse(128, 120, 46, 122, OUTLINE, mirror * 0.08).ellipse(128, 120, 40, 116, hex(pal.body), mirror * 0.08).ellipse(128, 125, 22, 90, hex(pal.accent), mirror * 0.08);
    } else {
      e.circle(128, 160, 70, OUTLINE).circle(128, 160, 64, hex(pal.body)).circle(128, 165, 36, hex(pal.accent, 0.7));
    }
    save(`${id}/ear_${side}.png`, e);
  }
  // tail 256x256, pivot (40,128) at the base, extends right
  const t = new Canvas(256, 256);
  if (id === 'cat') t.capsule(40, 128, 200, 100, 28, OUTLINE).capsule(40, 128, 200, 100, 22, hex(pal.body)).circle(200, 100, 22, hex(pal.accent));
  else if (id === 'dog') t.capsule(40, 128, 190, 70, 30, OUTLINE).capsule(40, 128, 190, 70, 24, hex(pal.body));
  else if (id === 'rabbit') t.circle(80, 128, 46, OUTLINE).circle(80, 128, 40, WHITE);
  else t.circle(80, 128, 40, OUTLINE).circle(80, 128, 34, hex(pal.body));
  save(`${id}/tail.png`, t);
  // icons: full body 256 and face 128
  const icon = new Canvas(256, 256);
  icon.roundRect(96, 120, 64, 110, 32, OUTLINE).roundRect(100, 124, 56, 102, 28, hex(pal.body));
  icon.circle(128, 96, 70, OUTLINE).circle(128, 96, 64, hex(pal.body));
  icon.circle(108, 90, 8, EYE).circle(148, 90, 8, EYE).ellipse(128, 110, 7, 5, hex(pal.dark));
  save(`${id}/icon.png`, icon);
  const faceIcon = new Canvas(128, 128);
  faceIcon.circle(64, 64, 60, OUTLINE).circle(64, 64, 55, hex(pal.body)).circle(44, 56, 8, EYE).circle(84, 56, 8, EYE).ellipse(64, 78, 7, 5, hex(pal.dark));
  save(`${id}/icon_face.png`, faceIcon);
}
console.log('done');
