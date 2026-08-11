// The dataset: markers.json from disk, plus an optional working draft that the
// editor keeps in localStorage until it gets exported back to the file.
//
// The draft is a full snapshot rather than a patch list. Reasoning about "what
// will Export write" is then trivial — it writes the draft, verbatim — and the
// dirty badge is a diff against the on-disk copy.

import { STORAGE } from './config.js';
import { CATS } from './categories.js';

let baseMarkers = [];    // exactly what the loaded marker file holds
let draftMarkers = null; // null until the first edit
let regions = [];
let items = {};
let source = 'repo';     // 'local' when the git-ignored personal set is in use

const listeners = new Set();

export function onDataChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn());
}

const asBilingual = (v) => {
  if (v == null) return { en: '', th: '' };
  if (typeof v === 'string') return { en: v, th: '' };
  return { en: v.en ?? '', th: v.th ?? '' };
};

/** Fill in defaults so the rest of the app never has to null-check a marker. */
function normalize(raw, index) {
  const cat = CATS[raw.cat] ? raw.cat : 'weaponCase';
  return {
    id: raw.id || `${cat}-${raw.region || 'unknown'}-${String(index + 1).padStart(3, '0')}`,
    cat,
    region: raw.region || '',
    x: Math.round(Number(raw.x) || 0),
    y: Math.round(Number(raw.y) || 0),
    name: asBilingual(raw.name),
    note: asBilingual(raw.note),
    item: raw.item || '',
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
  };
}

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE.draft);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.markers)) return null;
    return parsed.markers.map(normalize);
  } catch {
    return null;
  }
}

function writeDraft() {
  if (draftMarkers === null) {
    localStorage.removeItem(STORAGE.draft);
    return;
  }
  try {
    localStorage.setItem(STORAGE.draft, JSON.stringify({ version: 1, markers: draftMarkers }));
  } catch (err) {
    console.error('draft too large for localStorage — export now to avoid losing work', err);
  }
}

/**
 * The personal, git-ignored marker set wins over the one committed to the repo.
 * A public build simply won't have the local file and falls back cleanly.
 */
async function loadMarkerFile() {
  try {
    const res = await fetch('data/markers.local.json', { cache: 'no-cache' });
    if (res.ok) return { file: await res.json(), source: 'local' };
  } catch {
    /* absent is the normal case for a published build */
  }
  return { file: await loadJson('data/markers.json'), source: 'repo' };
}

export async function loadData() {
  const [markerResult, regionFile, itemFile] = await Promise.all([
    loadMarkerFile(),
    loadJson('data/regions.json'),
    loadJson('data/items.json'),
  ]);

  const markerFile = markerResult.file;
  source = markerResult.source;
  baseMarkers = (markerFile.markers ?? []).map(normalize);
  regions = regionFile.regions ?? [];
  const savedCentres = readRegionCentres();
  for (const region of regions) {
    if (Array.isArray(savedCentres[region.id])) region.center = savedCentres[region.id];
  }

  items = itemFile.items ?? {};
  draftMarkers = readDraft();
  emit();
}

/** The markers the app should be showing right now. */
export const allMarkers = () => draftMarkers ?? baseMarkers;

/** 'local' if this build is running on the personal dataset, else 'repo'. */
export const markerSource = () => source;

export const getMarker = (id) => allMarkers().find((m) => m.id === id);

export const allRegions = () => regions;
export const getRegion = (id) => regions.find((r) => r.id === id);

// ------------------------------------------------------------ provinces
//
// The imported dataset carries no province field, so centres are placed by hand
// in the editor and every marker then takes the nearest one. Centres live in
// their own localStorage slot until exported back to data/regions.json.

function readRegionCentres() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.regions) ?? 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/** Remember where a province sits. Pass null to clear it. */
export function setRegionCentre(id, centre) {
  const region = getRegion(id);
  if (!region) return false;
  region.center = centre;

  const saved = readRegionCentres();
  if (centre) saved[id] = centre;
  else delete saved[id];
  localStorage.setItem(STORAGE.regions, JSON.stringify(saved));

  emit();
  return true;
}

export const regionsWithCentres = () => regions.filter((r) => Array.isArray(r.center));

export const exportRegionsJson = () =>
  JSON.stringify({ version: 1, regions }, null, 2) + '\n';

/**
 * Give every marker the province whose centre is closest. Rough near borders,
 * but it makes the province filter useful in one click.
 */
export function assignRegionsByNearestCentre() {
  const centres = regionsWithCentres();
  if (!centres.length) return 0;

  const list = ensureDraft();
  let changed = 0;
  for (const marker of list) {
    let best = null;
    let bestDistance = Infinity;
    for (const region of centres) {
      const dx = marker.x - region.center[0];
      const dy = marker.y - region.center[1];
      const d = dx * dx + dy * dy; // comparing squares avoids 980 sqrt calls
      if (d < bestDistance) {
        bestDistance = d;
        best = region.id;
      }
    }
    if (best && marker.region !== best) {
      marker.region = best;
      changed++;
    }
  }
  writeDraft();
  emit();
  return changed;
}
export const allItems = () => items;
export const getItem = (id) => items[id];

// ---------------------------------------------------------------- editing

function ensureDraft() {
  if (draftMarkers === null) draftMarkers = baseMarkers.map((m) => ({ ...m }));
  return draftMarkers;
}

/** Insert or replace a marker. Returns the stored copy. */
export function upsertMarker(marker) {
  const list = ensureDraft();
  const clean = normalize(marker, list.length);
  const at = list.findIndex((m) => m.id === clean.id);
  if (at >= 0) list[at] = clean;
  else list.push(clean);
  writeDraft();
  emit();
  return clean;
}

export function deleteMarker(id) {
  const list = ensureDraft();
  const at = list.findIndex((m) => m.id === id);
  if (at < 0) return false;
  list.splice(at, 1);
  writeDraft();
  emit();
  return true;
}

/** Replace the whole working set, e.g. from Import or Undo. */
export function replaceMarkers(markers) {
  draftMarkers = markers.map(normalize);
  writeDraft();
  emit();
}

/** Throw the draft away and fall back to what is on disk. */
export function discardDraft() {
  draftMarkers = null;
  writeDraft();
  emit();
}

export const hasDraft = () => draftMarkers !== null;

/** How many markers were added, removed or edited relative to the file. */
export function draftDiffCount() {
  if (draftMarkers === null) return 0;
  const base = new Map(baseMarkers.map((m) => [m.id, JSON.stringify(m)]));
  let changed = 0;
  for (const m of draftMarkers) {
    const before = base.get(m.id);
    if (before === undefined || before !== JSON.stringify(m)) changed++;
    base.delete(m.id);
  }
  return changed + base.size; // leftovers in `base` are deletions
}

/** Stable, human-diffable JSON for the Export button. */
export function exportJson() {
  const ordered = [...allMarkers()].sort(
    (a, b) => a.cat.localeCompare(b.cat) || a.region.localeCompare(b.region) || a.id.localeCompare(b.id)
  );
  return JSON.stringify({ version: 1, markers: ordered }, null, 2) + '\n';
}

/** Next free sequence number for a category/region pair, as a padded id. */
export function nextMarkerId(cat, region) {
  const prefix = `${cat}-${region || 'unknown'}-`;
  const used = new Set(allMarkers().map((m) => m.id));
  for (let n = 1; n < 10000; n++) {
    const id = prefix + String(n).padStart(3, '0');
    if (!used.has(id)) return id;
  }
  return prefix + Date.now();
}

/** Marker counts per category for the sidebar. */
export function countsByCat() {
  const counts = Object.create(null);
  for (const m of allMarkers()) counts[m.cat] = (counts[m.cat] ?? 0) + 1;
  return counts;
}
