// Shared helpers for the two scripts that read the guides4gamers POI dump.
//
// PERSONAL USE ONLY. guides4gamers' terms forbid redistributing their data and
// their robots.txt disallows /json/. Everything derived from this file lands in
// git-ignored paths on purpose — see README "Data sources".

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ENDPOINT = 'https://guides4gamers.com/json/map.2.0.php?id=5';
const REFERER = 'https://guides4gamers.com/ghost-recon-wildlands/maps/bolivia/';
const CACHE = path.join(ROOT, 'source', 'g4g-bolivia.json');

/** Their legend id -> our category id. Deliberately 1:1; nothing is merged. */
export const ICON_TO_CAT = {
  32: 'weaponCase',
  33: 'accessoryCase',
  34: 'skillPoint',
  35: 'bonusMedal',
  49: 'kingslayerFile',
  41: 'rebelSupply',
  42: 'suppliesAir',
  37: 'intel',
  43: 'rebelRadio',
  44: 'networkAntenna',
  45: 'networkStation',
  38: 'rallyPoint',
  46: 'parachuteDrop',
  39: 'mainMission',
  40: 'buchon',
  48: 'sicario',
};

/**
 * Read the dump, hitting the network at most once. Re-runs use the cached copy
 * so repeated builds never touch their server.
 */
export async function loadDataset({ refresh = false } = {}) {
  if (existsSync(CACHE) && !refresh) {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  }
  console.log(`fetching ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, {
    headers: {
      'User-Agent': 'GRWTools/0.1 (personal, non-commercial map project)',
      Accept: 'application/json',
      Referer: REFERER,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from guides4gamers`);
  const json = await res.json();
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(json));
  console.log(`cached to source/g4g-bolivia.json`);
  return json;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
};

/** Their descriptions are small HTML fragments; markers store plain text. */
export function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Weapon and accessory case names all read "Type: Name" — "Sniper Rifle: MSR",
 * "Magazine: Extended (30)". Split them so one item can be shared by every
 * marker that hands it out.
 */
export function parseItemName(fullName) {
  // One entry in their data uses a semicolon ("Muzzle; Compensator V2"), so
  // accept either separator rather than dropping that item on the floor.
  const at = String(fullName).search(/[:;]/);
  if (at < 0) return { type: '', name: String(fullName).trim(), id: slug(fullName) };
  const type = fullName.slice(0, at).trim();
  const name = fullName.slice(at + 1).trim();
  return { type, name, id: slug(`${type}-${name}`) };
}

/** Key used to spot the same weapon arriving from two different sources. */
export const bareKey = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

/** POIs as a flat array, sorted so ids stay stable between runs. */
export function poiList(dataset) {
  return Object.entries(dataset.pois)
    .map(([sourceId, poi]) => ({ ...poi, sourceId: Number(sourceId) }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.sourceId - b.sourceId);
}

/** Legend id -> their display name, e.g. 32 -> "Weapon Cases". */
export function legendNames(dataset) {
  const out = {};
  for (const entry of dataset.legend.data) out[entry.id] = entry.name;
  return out;
}
