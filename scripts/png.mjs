// Minimal PNG writer + anti-aliased shape rasteriser (no dependencies).
import { deflateSync } from 'node:zlib';

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Float32Array(w * h * 4); // premultiplied-free RGBA 0..1
    this.shapes = [];
  }
  /** shape: { kind, ...params, color:[r,g,b,a], stroke?:{color,width} } */
  add(shape) {
    this.shapes.push(shape);
    return this;
  }
  circle(cx, cy, r, color) {
    return this.add({ kind: 'circle', cx, cy, r, color });
  }
  ellipse(cx, cy, rx, ry, color, rot = 0) {
    return this.add({ kind: 'ellipse', cx, cy, rx, ry, rot, color });
  }
  roundRect(x, y, w, h, r, color) {
    return this.add({ kind: 'rrect', x, y, w, h, r, color });
  }
  polygon(points, color) {
    return this.add({ kind: 'poly', points, color });
  }
  capsule(x1, y1, x2, y2, r, color) {
    return this.add({ kind: 'capsule', x1, y1, x2, y2, r, color });
  }
  ring(cx, cy, r, width, color) {
    return this.add({ kind: 'ring', cx, cy, r, width, color });
  }
  render(ss = 3) {
    const { w, h, px } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < ss; sy++) {
          for (let sx = 0; sx < ss; sx++) {
            const X = x + (sx + 0.5) / ss;
            const Y = y + (sy + 0.5) / ss;
            // composite shapes back to front
            let cr = 0, cg = 0, cb = 0, ca = 0;
            for (const s of this.shapes) {
              if (!inside(s, X, Y)) continue;
              const [sr, sg, sb, sa] = s.color;
              const oa = ca * (1 - sa);
              const na = sa + oa;
              cr = (sr * sa + cr * oa) / (na || 1);
              cg = (sg * sa + cg * oa) / (na || 1);
              cb = (sb * sa + cb * oa) / (na || 1);
              ca = na;
            }
            r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
          }
        }
        const n = ss * ss;
        const i = (y * w + x) * 4;
        if (a > 0) {
          px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; px[i + 3] = a / n;
        }
      }
    }
    return this;
  }
  toPNG() {
    const { w, h, px } = this;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 4 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const o = y * (w * 4 + 1) + 1 + x * 4;
        raw[o] = Math.round(px[i] * 255);
        raw[o + 1] = Math.round(px[i + 1] * 255);
        raw[o + 2] = Math.round(px[i + 2] * 255);
        raw[o + 3] = Math.round(px[i + 3] * 255);
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function inside(s, x, y) {
  switch (s.kind) {
    case 'circle': {
      const dx = x - s.cx, dy = y - s.cy;
      return dx * dx + dy * dy <= s.r * s.r;
    }
    case 'ring': {
      const d = Math.hypot(x - s.cx, y - s.cy);
      return d <= s.r + s.width / 2 && d >= s.r - s.width / 2;
    }
    case 'ellipse': {
      const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      const dx = x - s.cx, dy = y - s.cy;
      const rx = dx * c - dy * sn, ry = dx * sn + dy * c;
      return (rx * rx) / (s.rx * s.rx) + (ry * ry) / (s.ry * s.ry) <= 1;
    }
    case 'rrect': {
      if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
      const r = Math.min(s.r, s.w / 2, s.h / 2);
      const cx = Math.max(s.x + r, Math.min(x, s.x + s.w - r));
      const cy = Math.max(s.y + r, Math.min(y, s.y + s.h - r));
      return Math.hypot(x - cx, y - cy) <= r;
    }
    case 'capsule': {
      const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (y - s.y1) * vy) / len2));
      return Math.hypot(x - (s.x1 + vx * t), y - (s.y1 + vy * t)) <= s.r;
    }
    case 'poly': {
      let ins = false;
      const p = s.points;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    }
  }
  return false;
}

export function hex(h, a = 1) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}
