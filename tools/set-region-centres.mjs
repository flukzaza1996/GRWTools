// Fill in `center` for every province in data/regions.json by averaging the
// markers already assigned to it.
//
// The editor needs these centres for its "Assign provinces" button, and setting
// 21 of them by hand from the map is half an hour of clicking. Once markers
// carry a region — which the guides4gamers importer works out from the POI
// names — the centre of each province is just the mean of its own markers.
//
//   node tools/set-region-centres.mjs [--dry]
//
// Rewrites only the `null` (or existing) centre values, leaving the file's
// hand-aligned columns alone.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(ROOT, p);
const dry = process.argv.includes('--dry');

const MARKER_FILES = ['data/markers.local.json', 'data/markers.json'];
const src = MARKER_FILES.find((f) => existsSync(at(f)));
if (!src) {
  console.error('No marker file found. Run `npm run markers` or place pins with the editor first.');
  process.exit(1);
}

const markers = JSON.parse(readFileSync(at(src), 'utf8')).markers;
const regionsRaw = readFileSync(at('data/regions.json'), 'utf8');
const regions = JSON.parse(regionsRaw).regions;

// Mean position per region. The mean sits inside the province for any shape
// that is roughly convex, which every Wildlands province is.
const sums = new Map();
for (const m of markers) {
  if (!m.region) continue;
  const s = sums.get(m.region) || { x: 0, y: 0, n: 0 };
  s.x += m.x;
  s.y += m.y;
  s.n += 1;
  sums.set(m.region, s);
}

let out = regionsRaw;
let set = 0;
const skipped = [];

for (const r of regions) {
  const s = sums.get(r.id);
  if (!s) {
    skipped.push(r.id);
    continue;
  }
  const centre = `[${Math.round(s.x / s.n)}, ${Math.round(s.y / s.n)}]`;
  // Anchor on the id so a province can never take another one's coordinates.
  const line = new RegExp(`("id":\\s*"${r.id}"[^\\n]*?"center":\\s*)(null|\\[[^\\]]*\\])`);
  if (!line.test(out)) {
    skipped.push(`${r.id} (no matching line)`);
    continue;
  }
  out = out.replace(line, `$1${centre}`);
  console.log(`  ${r.id.padEnd(15)} ${centre.padEnd(14)} from ${s.n} markers`);
  set += 1;
}

out = out.replace(
  /"note": "[^"]*"/,
  '"note": "The 21 provinces of Bolivia. `center` is a pixel coordinate in the 8192 map square, used by the editor to assign a province to a marker by nearest centre. Recompute with `npm run centres`."'
);

if (dry) {
  console.log(`\n[dry run] would set ${set}/${regions.length} centres from ${src}`);
} else {
  writeFileSync(at('data/regions.json'), out, 'utf8');
  console.log(`\nset ${set}/${regions.length} centres from ${markers.length} markers in ${src}`);
}
if (skipped.length) console.log(`no markers for: ${skipped.join(', ')}`);
