// Writes assets/characters/<animal>/anchors.json and photo/anchors.json from the fallback geometry.
// Run after changing src/art/plush.ts: node scripts/gen-anchors.mjs (requires tsx-free build: uses the dist bundle? no → simple re-implementation below)
import { mkdirSync, writeFileSync } from 'node:fs';
const FEET = { x: 300, y: 560 };
const SPECS = { idle: [0, 0], happy: [0, -6], kiss_give: [9, 0], kiss_receive: [-6, 0], hug_give: [7, 0], hug_receive: [-4, 0], handshake: [4, 0] };
const BASE = { head: { x: 300, y: 215, r: 150 }, forehead: { x: 300, y: 118 }, eyes: [{ x: 252, y: 226 }, { x: 348, y: 226 }], cheeks: [{ x: 214, y: 272 }, { x: 386, y: 272 }], top: { x: 300, y: 50 } };
const rot = (p, deg, dy) => { const a = deg * Math.PI / 180, dx = p.x - FEET.x, dyy = p.y + dy - FEET.y; return { x: Math.round(FEET.x + dx * Math.cos(a) - dyy * Math.sin(a)), y: Math.round(FEET.y + dx * Math.sin(a) + dyy * Math.cos(a)) }; };
const eyelids = { cat: '#F9E4BC', dog: '#E0B383', rabbit: '#FFFFFF', bear: '#AD7A52', photo: '#F9C6D3' };
for (const [who, eyelid] of Object.entries(eyelids)) {
  const poses = {};
  for (const [pose, [lean, dy]] of Object.entries(SPECS)) {
    const r = (p) => rot(p, lean, dy);
    poses[pose] = { head: { ...r(BASE.head), r: BASE.head.r }, forehead: r(BASE.forehead), eyes: [r(BASE.eyes[0]), r(BASE.eyes[1])], cheeks: [r(BASE.cheeks[0]), r(BASE.cheeks[1])], top: r(BASE.top) };
  }
  const json = {
    $comment: 'Pixel positions on the 600x600 pose images. feet = bottom-centre of the character (same in every pose). head = centre/radius of the face circle (photo mode pastes the photo here). forehead = where the X/O badge sits in classic mode. eyes/cheeks = blink and blush overlays. Edit these when you replace the art.',
    canvas: 600, feet: FEET, eyelid, eyeWidth: 46, poses,
  };
  mkdirSync(`assets/characters/${who}`, { recursive: true });
  writeFileSync(`assets/characters/${who}/anchors.json`, JSON.stringify(json, null, 2) + '\n');
  console.log('wrote', who);
}
