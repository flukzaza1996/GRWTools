// Gives the 930 markers that are not a weapon case something to show.
//
//   node tools/fetch-category-icons.mjs [--force]
//
// Two kinds of picture:
//   assets/icons/<cat>.png       the in-game map icon for a marker type, from
//                                the Wildlands wiki's "Map icons" category
//   assets/portraits/<slug>.jpg  a Buchon's mugshot, matched by marker name
//
// Portraits are written straight into markers.local.json's `images` array, so
// they behave like any other marker picture. The importer preserves that field.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, slug, loadDataset, ICON_TO_CAT } from './g4g-source.mjs';

const force = process.argv.includes('--force');
const UA = 'GRWTools/0.1 (personal, non-commercial map project)';
const ARCHIVE = 'https://ghostreconwildlands-archive.fandom.com/api.php';
const MAIN = 'https://ghostrecon.fandom.com/api.php';

const ICON_DIR = path.join(ROOT, 'assets', 'icons');
const PORTRAIT_DIR = path.join(ROOT, 'assets', 'portraits');
const MARKERS = path.join(ROOT, 'data', 'markers.local.json');

// Our category -> the wiki file that depicts it. Several categories share an
// icon because the game itself uses one symbol for them.
const CATEGORY_ICONS = {
  weaponCase: 'Icon weapon case.png',
  accessoryCase: 'Icon accessory case.png',
  skillPoint: 'Icon skill point.png',
  bonusMedal: 'Icon bonus medal.png',
  kingslayerFile: 'Icon kingslayer file.png',
  intel: 'Icon information.png',
  mainMission: 'Icon main mission.png',
  rallyPoint: 'Icon rally point.png',
  rebelSupply: 'Icon rebel ops.png',
  rebelSkill: 'Icon support.png',
  suppliesAir: 'Icon air.png',
  helicopter: 'Icon air.png',
  plane: 'Icon air.png',
  landVehicle: 'Icon vehicle.png',
  boat: 'Icon vehicle.png',
  sicario: 'Icon Skull.png',
  buchon: 'Icon Skull.png',
};

async function api(endpoint, params) {
  const url = `${endpoint}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** File titles -> download URLs. */
async function fileUrls(endpoint, titles) {
  const urls = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api(endpoint, {
      action: 'query', prop: 'imageinfo', iiprop: 'url',
      titles: titles.slice(i, i + 50).map((t) => `File:${t}`).join('|'),
    });
    for (const page of Object.values(json.query.pages)) {
      const url = page.imageinfo?.[0]?.url;
      if (url) urls.set(page.title.replace(/^File:/, '').replace(/_/g, ' ').toLowerCase(), url);
    }
  }
  return urls;
}

const download = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

// ---------------------------------------------------------- map icons

async function fetchIcons() {
  await mkdir(ICON_DIR, { recursive: true });
  const wanted = Object.entries(CATEGORY_ICONS)
    .filter(([cat]) => force || !existsSync(path.join(ICON_DIR, `${cat}.png`)));
  if (!wanted.length) return 0;

  const urls = await fileUrls(ARCHIVE, [...new Set(wanted.map(([, file]) => file))]);
  let saved = 0;

  for (const [cat, file] of wanted) {
    const url = urls.get(file.replace(/_/g, ' ').toLowerCase());
    if (!url) { console.warn(`  ${cat}: no URL for ${file}`); continue; }
    try {
      // These are 21-50px HUD symbols. Keep them at native size — upscaling
      // a 30px icon to fill a popup just makes it mush.
      await writeFile(path.join(ICON_DIR, `${cat}.png`), await download(url));
      saved++;
      console.log(`  icons/${cat}.png`);
    } catch (err) {
      console.warn(`  ${cat}: ${err.message}`);
    }
  }
  return saved;
}

// -------------------------------------------------- icons the wiki lacks

/**
 * Rebel radios, antennas, network stations and parachute drops have no wiki
 * page at all, so their symbols come from the same POI dump the markers did.
 * Personal use only, like the rest of it.
 */
async function fetchMissingIconsFromDump() {
  const missing = Object.entries(ICON_TO_CAT)
    .filter(([, cat]) => force || !existsSync(path.join(ICON_DIR, `${cat}.png`)));
  if (!missing.length) return 0;

  const dataset = await loadDataset();
  let saved = 0;

  for (const [legendId, cat] of missing) {
    const gfx = dataset.icons?.[legendId]?.gfx;
    if (!gfx) continue;
    try {
      const buffer = await download(`https://guides4gamers.com/sites/4/icons/${gfx}`);
      await writeFile(path.join(ICON_DIR, `${cat}.png`), buffer);
      saved++;
      console.log(`  icons/${cat}.png  (from the POI dump)`);
    } catch (err) {
      console.warn(`  ${cat}: ${err.message}`);
    }
  }
  return saved;
}

// ---------------------------------------------------------- portraits

async function fetchPortraits() {
  const file = JSON.parse(await readFile(MARKERS, 'utf8'));
  const bosses = file.markers.filter((m) => m.cat === 'buchon' && m.name.en);
  const names = [...new Set(bosses.map((m) => m.name.en))];

  const pages = await api(MAIN, {
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    redirects: '1', titles: names.join('|'),
  });

  // Redirects mean the page title may differ from the name we asked for.
  const askedFor = new Map();
  for (const r of pages.query.redirects ?? []) askedFor.set(r.to, r.from);
  for (const n of pages.query.normalized ?? []) askedFor.set(n.to, n.from);

  const jobs = [];
  for (const page of Object.values(pages.query.pages)) {
    const text = page.revisions?.[0]?.slots?.main?.['*'];
    if (!text) continue;
    const img = text.match(/\|\s*image\s*=\s*\[?\[?(?:File:)?([^\]|\n]+\.(?:png|jpe?g))/i)?.[1]?.trim();
    if (!img) continue;
    jobs.push({ name: askedFor.get(page.title) ?? page.title, file: img });
  }

  await mkdir(PORTRAIT_DIR, { recursive: true });
  const urls = await fileUrls(MAIN, [...new Set(jobs.map((j) => j.file))]);

  let saved = 0;
  const paths = new Map();
  for (const job of jobs) {
    const id = slug(job.name);
    const rel = `assets/portraits/${id}.jpg`;
    const abs = path.join(ROOT, rel);
    paths.set(job.name, rel);
    if (existsSync(abs) && !force) continue;

    const url = urls.get(job.file.replace(/_/g, ' ').toLowerCase());
    if (!url) { console.warn(`  ${job.name}: no URL for ${job.file}`); continue; }
    try {
      await sharp(await download(url))
        .resize({ width: 500, withoutEnlargement: true })
        .flatten({ background: '#12161c' })
        .jpeg({ quality: 84 })
        .toFile(abs);
      saved++;
      console.log(`  portraits/${id}.jpg  (${job.name})`);
    } catch (err) {
      console.warn(`  ${job.name}: ${err.message}`);
      paths.delete(job.name);
    }
  }

  // Attach each portrait to its marker so it renders like any other picture.
  let linked = 0;
  for (const marker of file.markers) {
    const rel = paths.get(marker.name.en);
    if (!rel || !existsSync(path.join(ROOT, rel))) continue;
    if (!marker.images.includes(rel)) marker.images.push(rel);
    linked++;
  }
  await writeFile(MARKERS, JSON.stringify(file, null, 2) + '\n', 'utf8');

  return { saved, linked, total: bosses.length };
}

// ----------------------------------------------------------------- run

console.log('map icons:');
const icons = await fetchIcons();
const extra = await fetchMissingIconsFromDump();
console.log(`  ${icons + extra} new\n`);

console.log('boss portraits:');
const portraits = await fetchPortraits();
console.log(`  ${portraits.saved} new, ${portraits.linked} of ${portraits.total} buchon markers now carry one`);
