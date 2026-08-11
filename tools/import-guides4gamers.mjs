// Turns the guides4gamers Bolivia POI dump into data/markers.local.json.
//
//   node tools/import-guides4gamers.mjs [--refresh] [--scale-x]
//
// --refresh   re-fetch instead of using source/g4g-bolivia.json
// --scale-x   multiply x by 7676/7680, for the case where their map turns out
//             to be 4px wider than ours rather than the same artwork padded
//
// PERSONAL USE ONLY — the output is git-ignored. See README "Data sources".

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  ROOT, ICON_TO_CAT, loadDataset, htmlToText, parseItemName, poiList, legendNames,
} from './g4g-source.mjs';
import { SOURCE_W } from './map-spec.mjs';

const refresh = process.argv.includes('--refresh');
const scaleX = process.argv.includes('--scale-x');

const THEIR_WIDTH = 7680;
const OUT = path.join(ROOT, 'data', 'markers.local.json');

// name_sub often just repeats the category ("Weapon Case" on a weapon case).
// Anything else — a mission name, a sub-type — is worth keeping in the note.
function subtitleWorthKeeping(sub, legendName) {
  if (!sub) return '';
  const singular = legendName.replace(/s$/, '');
  return sub === legendName || sub === singular ? '' : sub;
}

/**
 * Anything you added by hand — Thai translations, image filenames, item links —
 * survives a re-import, keyed by marker id.
 */
async function previousEdits() {
  if (!existsSync(OUT)) return new Map();
  try {
    const { markers = [] } = JSON.parse(await readFile(OUT, 'utf8'));
    return new Map(markers.map((m) => [m.id, m]));
  } catch (err) {
    console.warn(`could not read existing ${path.basename(OUT)}: ${err.message}`);
    return new Map();
  }
}

/**
 * Most POI names carry their province: "Kingslayer File, Koani", "Tabacal
 * Alpha", "Koani #1". Longest name first so "Media Luna" is not shadowed by a
 * shorter province that happens to be a substring.
 */
async function provinceMatcher() {
  const { regions = [] } = JSON.parse(
    await readFile(path.join(ROOT, 'data', 'regions.json'), 'utf8')
  );
  const sorted = regions
    .map((r) => ({ id: r.id, needle: r.name.en.toLowerCase() }))
    .sort((a, b) => b.needle.length - a.needle.length);

  return (...texts) => {
    for (const text of texts) {
      if (!text) continue;
      const hay = String(text).toLowerCase();
      const hit = sorted.find((p) => hay.includes(p.needle));
      if (hit) return hit.id;
    }
    return '';
  };
}

const dataset = await loadDataset({ refresh });
const legend = legendNames(dataset);
const pois = poiList(dataset);
const previous = await previousEdits();
const findProvince = await provinceMatcher();

const seq = Object.create(null);
const skipped = [];
const markers = [];

for (const poi of pois) {
  const cat = ICON_TO_CAT[poi.icon];
  if (!cat) {
    skipped.push(poi.icon);
    continue;
  }

  const n = (seq[cat] = (seq[cat] ?? 0) + 1);
  const sub = subtitleWorthKeeping(poi.name_sub, legend[poi.icon] ?? '');
  const body = htmlToText(poi.description);
  const note = [sub, body].filter(Boolean).join(' · ');

  // Both coordinate systems are pixels from the top-left of the same map scan.
  const x = scaleX ? Math.round((poi.x * SOURCE_W) / THEIR_WIDTH) : poi.x;

  const marker = {
    id: `${cat}-${String(n).padStart(3, '0')}`,
    cat,
    region: findProvince(poi.name, poi.name_sub),
    x,
    y: poi.y,
    name: { en: poi.name || legend[poi.icon] || '', th: '' },
    note: { en: note, th: '' },
    item: '',
    images: [],
  };

  // Weapon and accessory cases name the thing they contain, so point them at a
  // catalogue entry; tools/build-items.mjs creates the matching records.
  if (cat === 'weaponCase' || cat === 'accessoryCase') {
    const parsed = parseItemName(poi.name);
    if (parsed.type) marker.item = parsed.id;
  }

  // Province is derived, not preserved: the name parse below is deterministic
  // and better than anything a previous run had. Translations and pictures you
  // added by hand are carried across.
  const before = previous.get(marker.id);
  if (before) {
    if (before.name?.th) marker.name.th = before.name.th;
    if (before.note?.th) marker.note.th = before.note.th;
    if (before.images?.length) marker.images = before.images;
    if (before.item && !marker.item) marker.item = before.item;
  }

  markers.push(marker);
}

// Markers whose name gave away a province pin down where each province sits;
// everything else takes the closest of those centres. Cheaper and far more
// accurate than placing 21 centres by hand.
const named = markers.filter((m) => m.region);
const centres = new Map();
for (const m of named) {
  const c = centres.get(m.region) ?? { x: 0, y: 0, n: 0 };
  c.x += m.x;
  c.y += m.y;
  c.n++;
  centres.set(m.region, c);
}
const centroids = [...centres].map(([id, c]) => ({ id, x: c.x / c.n, y: c.y / c.n }));

let inferred = 0;
if (centroids.length) {
  for (const m of markers) {
    if (m.region) continue;
    let best = '';
    let bestDistance = Infinity;
    for (const c of centroids) {
      const d = (m.x - c.x) ** 2 + (m.y - c.y) ** 2;
      if (d < bestDistance) { bestDistance = d; best = c.id; }
    }
    m.region = best;
    inferred++;
  }
}

await writeFile(OUT, JSON.stringify({ version: 1, markers }, null, 2) + '\n', 'utf8');

const counts = {};
for (const m of markers) counts[m.cat] = (counts[m.cat] ?? 0) + 1;

console.log(`\nwrote data/markers.local.json — ${markers.length} markers`);
console.log(
  `provinces: ${named.length} read straight off the marker name, ` +
  `${inferred} inferred from the nearest of ${centroids.length} province centroids`
);
for (const [cat, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${cat}`);
}
if (skipped.length) {
  console.warn(`\nskipped ${skipped.length} POIs with unmapped icons: ${[...new Set(skipped)].join(', ')}`);
}
console.log(
  '\n  PERSONAL USE ONLY. This data comes from guides4gamers.com, whose terms\n' +
  '  forbid redistribution. data/markers.local.json is git-ignored — keep it\n' +
  '  that way, and do not publish a build that carries it.\n'
);
