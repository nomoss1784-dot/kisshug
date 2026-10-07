// Builds the Playables variant into dist-playables/ and zips it with index.html at the root.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist-playables');
const zip = join(root, 'kisshug-playables.zip');

execSync('npx vite build --mode playables', { cwd: root, stdio: 'inherit' });

// Sanity checks required by SPEC §8.1: no external URLs, size limits.
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(out);
let total = 0;
for (const f of files) {
  const size = statSync(f).size;
  total += size;
  if (size > 10 * 1024 * 1024) throw new Error(`file over 10MB: ${f}`);
  if (/\.(html|js|css|json)$/.test(f)) {
    const text = readFileSync(f, 'utf8');
    const ext = text.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
    const bad = ext.filter((u) => !/^https?:\/\/(developers\.google\.com|github\.com)/.test(u) && !/\$comment/.test(u));
    // Only comments/docs may contain URLs; scripts must not fetch anything external.
    if (bad.length && /\.(js|html)$/.test(f)) {
      const fetching = bad.filter((u) => !/w3\.org|xmlns/.test(u));
      if (fetching.length) throw new Error(`external URL in ${f}: ${fetching.join(', ')}`);
    }
  }
}
console.log(`dist-playables: ${files.length} files, ${(total / 1024).toFixed(0)} KB total`);
if (total > 30 * 1024 * 1024) throw new Error('bundle over 30MB');

if (existsSync(zip)) rmSync(zip);
execSync(`cd "${out}" && zip -qr "${zip}" . -x ".*" -x "__MACOSX/*"`, { stdio: 'inherit' });
console.log(`wrote ${zip} (${(statSync(zip).size / 1024).toFixed(0)} KB)`);
