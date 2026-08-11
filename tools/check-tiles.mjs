// Development aid: re-stitch one zoom level from its tiles so you can eyeball
// whether the pyramid lines up with the source.
//
//   node tools/check-tiles.mjs [zoom]

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE } from './map-spec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Z = Number(process.argv[2] ?? 2);
const N = 2 ** Z;
const SIZE = N * TILE;

// libvips writes {z}/{row}/{column}.jpg, so the directory is y and the file x.
const composites = [];
let missing = 0;
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const p = path.join(ROOT, 'assets', 'tiles', String(Z), String(y), `${x}.jpg`);
    if (!existsSync(p)) { missing++; continue; }
    composites.push({ input: p, left: x * TILE, top: y * TILE });
  }
}

const out = path.join(ROOT, `stitched-z${Z}.jpg`);
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#000' } })
  .composite(composites)
  .jpeg({ quality: 90 })
  .toFile(out);

console.log(`zoom ${Z}: ${N}x${N} grid, ${missing} tiles missing, wrote ${out}`);
