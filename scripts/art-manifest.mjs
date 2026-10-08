// Scans assets/characters/ for real pose images and writes src/generated/art-manifest.json.
// Runs before dev/build so the game knows which slots have art (no 404 probing at runtime).
import { existsSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const SLOTS = ['idle', 'happy', 'kiss_give', 'kiss_receive', 'hug_give', 'hug_receive', 'handshake', 'face'];
const WHO = ['cat', 'dog', 'rabbit', 'bear', 'photo'];
const manifest = {};
let total = 0;
for (const who of WHO) {
  const dir = join('assets', 'characters', who);
  manifest[who] = {};
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir);
  for (const slot of SLOTS) {
    const f = files.find((n) => n === `${slot}.webp`) ?? files.find((n) => n === `${slot}.png`);
    if (f) {
      manifest[who][slot] = `characters/${who}/${f}`;
      total += statSync(join(dir, f)).size;
    }
  }
}
mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/art-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
const found = Object.values(manifest).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`art manifest: ${found} image slots, ${(total / 1024).toFixed(0)} KB`);
if (total > 3 * 1024 * 1024) {
  console.error('character images exceed the 3MB budget (SPEC §9.5)');
  process.exit(1);
}
