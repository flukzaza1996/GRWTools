// Downloads a picture for every gun in data/items.json so a popup shows what
// the thing actually is, not just its name.
//
//   node tools/fetch-item-images.mjs [--force] [--limit N]
//
// Source is the infobox image on each Ghost Recon Wiki weapon page. Those are
// Ubisoft's renders hosted by the wiki, so treat them the same as the map
// tiles: fine for a personal build, ask before republishing.
//
// Attachments (scopes, magazines, muzzles) have no wiki pages, so they keep
// their in-game description and no picture.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, bareKey, slug } from './g4g-source.mjs';

const force = process.argv.includes('--force');
const limitAt = process.argv.indexOf('--limit');
const limit = limitAt > -1 ? Number(process.argv[limitAt + 1]) : Infinity;

const UA = 'GRWTools/0.1 (personal, non-commercial map project)';
const API = 'https://ghostrecon.fandom.com/api.php';
const CATEGORY = 'Category:Ghost Recon Wildlands Weapons';
const OUT_DIR = path.join(ROOT, 'assets', 'items');
const MAX_WIDTH = 900;
const QUALITY = 82;

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** Weapon page title -> { name, file } taken from the infobox. */
async function wikiImageRefs() {
  const cat = await api({
    action: 'query', list: 'categorymembers',
    cmtitle: CATEGORY, cmlimit: '500',
  });
  const titles = cat.query.categorymembers.filter((m) => m.ns === 0).map((m) => m.title);

  const refs = [];
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      titles: titles.slice(i, i + 50).join('|'),
    });
    for (const page of Object.values(json.query.pages)) {
      const text = page.revisions?.[0]?.slots?.main?.['*'];
      if (!text) continue;
      // `image1` is the stats screenshot; `image` is the weapon itself.
      const file = text.match(/\|\s*image\s*=\s*\[\[File:([^\]|]+)/i)?.[1]?.trim();
      if (!file) continue;
      const name = (text.match(/\{\{DISPLAYTITLE:([^}]+)\}\}/)?.[1] ?? page.title.split('/')[0]).trim();
      refs.push({ name, file });
    }
  }
  return refs;
}

/**
 * "Weapons of Wildlands" is a table of every firearm in the game, written as
 * [[Real World Designation|In-game name]]. That makes it an authoritative
 * in-game-name -> wiki-page index, which beats guessing: it is how we learn
 * that the game's "SR-1" is the wiki's "DSR-1" and "5.7 USG" is "FN Five-seveN".
 */
async function weaponsIndex() {
  const json = await api({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    redirects: '1', titles: 'Weapons of Wildlands',
  });
  const text = Object.values(json.query.pages)[0]?.revisions?.[0]?.slots?.main?.['*'];
  if (!text) return new Map();

  const index = new Map();
  for (const link of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const page = link[1].trim();
    const shown = (link[2] ?? link[1]).trim();
    if (/^(Tom Clancy|Weapons of|Bolivia)/i.test(page)) continue; // navigation, not a gun
    index.set(bareKey(shown), page);
  }
  return index;
}

/**
 * The picture of the weapon itself. Most pages put it in the infobox, but the
 * older ones just drop a thumbnail into the lead, so fall back to the first
 * file in the body — skipping the gallery, which holds detail shots.
 */
function pageImage(text) {
  const infobox = text.match(/\|\s*image\s*=\s*\[\[File:([^\]|]+)/i)?.[1];
  if (infobox) return infobox.trim();
  const body = text.replace(/<gallery[\s\S]*?<\/gallery>/gi, '');
  return body.match(/\[\[File:([^\]|]+\.(?:png|jpe?g|webp))/i)?.[1]?.trim() ?? '';
}

/** Fetch page wikitext for up to 50 titles at a time. */
async function pageText(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      redirects: '1', titles: titles.slice(i, i + 50).join('|'),
    });
    for (const page of Object.values(json.query.pages)) {
      const text = page.revisions?.[0]?.slots?.main?.['*'];
      if (text) out.set(page.title, text);
    }
  }
  return out;
}

/**
 * Guns whose wiki page sits outside the Wildlands category — usually filed
 * under the real-world designation ("Mk 14 EBR" for the in-game "MK14").
 * A candidate is only accepted when its title and the item name overlap, so a
 * loose search hit cannot attach the wrong photo.
 */
async function searchImageFor(name, index) {
  const listed = index.get(bareKey(name));
  if (listed) {
    for (const text of (await pageText([listed])).values()) {
      const file = pageImage(text);
      if (file) return file;
    }
  }

  const base = name.replace(/\(.*?\)/g, '').trim();
  const key = bareKey(base);
  if (key.length < 3) return '';

  const direct = await pageText([base, `${base}/Ghost Recon Wildlands`]);
  for (const text of direct.values()) {
    const file = pageImage(text);
    if (file) return file;
  }

  const found = await api({ action: 'query', list: 'search', srsearch: base, srlimit: '5' });
  const wholeWord = new RegExp(`(^|[^A-Za-z0-9])${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i');
  const candidates = (found.query?.search ?? [])
    .map((s) => s.title)
    .filter((title) => {
      // "Mk 14 EBR" is the right page for "MK14"; "DSR-1" is NOT right for
      // "SR-1", so a bare substring test is too loose.
      const t = bareKey(title);
      return t === key || t.startsWith(key) || wholeWord.test(title);
    });
  if (!candidates.length) return '';

  for (const [, text] of await pageText(candidates)) {
    const file = pageImage(text);
    if (file) return file;
  }
  return '';
}

/**
 * Attachments have no wiki pages, but the Ghost Pack articles carry galleries
 * captioned "Foregrip V4 (Underbarrel)" — exactly the name and type our
 * catalogue ids are built from. Returns catalogue-id -> file name.
 */
async function ghostPackAttachments() {
  const cat = await api({
    action: 'query', list: 'categorymembers',
    cmtitle: 'Category:Ghost Packs', cmlimit: '500',
  });
  const titles = (cat.query?.categorymembers ?? []).filter((m) => m.ns === 0).map((m) => m.title);

  const found = new Map();
  for (const [, text] of await pageText(titles)) {
    for (const gallery of text.matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi)) {
      for (const line of gallery[1].split('\n')) {
        const entry = line.match(/^\s*(?:File:)?([^|\]]+\.(?:png|jpe?g))\s*\|\s*(.+?)\s*$/i);
        if (!entry) continue;
        const caption = entry[2].trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (!caption) continue;
        const id = slug(`${caption[2].trim()}-${caption[1].trim()}`);
        if (!found.has(id)) found.set(id, entry[1].trim());
      }
    }
  }
  return found;
}

/**
 * Last resort: a File: page whose name is exactly the item's name. Strict
 * equality, and skipped when a weapon of the same name exists — the wiki's
 * "G28.png" is the rifle, not the G28 scope.
 */
async function exactNameFiles(targets) {
  const candidates = targets.flatMap(({ id, name }) =>
    ['png', 'jpg', 'jpeg'].flatMap((ext) => [
      { id, title: `File:${name}.${ext}` },
      { id, title: `File:${name} GRW.${ext}` },
    ])
  );

  const found = new Map();
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.slice(i, i + 50);
    const json = await api({
      action: 'query', prop: 'imageinfo', iiprop: 'url',
      titles: batch.map((c) => c.title).join('|'),
    });
    const normalised = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(json.query.pages)) {
      if (!page.imageinfo?.[0]?.url) continue;
      const asked = normalised.get(page.title) ?? page.title;
      const hit = batch.find((c) => c.title === asked || c.title === page.title);
      if (hit && !found.has(hit.id)) found.set(hit.id, page.title.replace(/^File:/, ''));
    }
  }
  return found;
}

// MediaWiki normalises underscores to spaces in titles, so key the lookup on a
// form that matches however the wikitext happened to write the filename.
const fileKey = (name) => name.replace(/_/g, ' ').trim().toLowerCase();

/** File: names -> direct URLs, 50 at a time. */
async function resolveFiles(files) {
  const urls = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const json = await api({
      action: 'query', prop: 'imageinfo', iiprop: 'url|mime',
      titles: files.slice(i, i + 50).map((f) => `File:${f}`).join('|'),
    });
    for (const page of Object.values(json.query.pages)) {
      const url = page.imageinfo?.[0]?.url;
      if (url) urls.set(fileKey(page.title.replace(/^File:/, '')), url);
    }
  }
  return urls;
}

// ------------------------------------------------------------------- run

const catalogue = JSON.parse(await readFile(path.join(ROOT, 'data', 'items.json'), 'utf8')).items;

// Match on the bare name so wiki titles ("FN Five-seveN") still find the item
// the game calls "5.7 USG" — build-items.mjs already reconciled those names.
const byName = new Map();
for (const [id, item] of Object.entries(catalogue)) byName.set(bareKey(item.name.en), id);

const refs = await wikiImageRefs();
console.log(`wiki: ${refs.length} pages carry an infobox image`);

const needsImage = (id) => force || !existsSync(path.join(OUT_DIR, `${id}.jpg`));

const wanted = refs
  .map((r) => ({ ...r, id: byName.get(bareKey(r.name)) }))
  .filter((r) => r.id && needsImage(r.id));

// Anything the category missed gets a second pass through search.
const GUN_TYPES = new Set([
  'Assault Rifle', 'Sniper Rifle', 'Submachine Gun', 'Light Machine Gun',
  'Compact Machine Gun', 'Shotgun', 'Handgun', 'Designated Marksman Rifle',
]);
const covered = new Set(wanted.map((w) => w.id));
const stragglers = Object.entries(catalogue)
  .filter(([id, item]) => GUN_TYPES.has(item.type) && !covered.has(id) && needsImage(id));

if (stragglers.length) {
  const index = await weaponsIndex();
  console.log(`"Weapons of Wildlands" index: ${index.size} entries`);
  console.log(`resolving ${stragglers.length} guns the category missed`);
  for (const [id, item] of stragglers) {
    const file = await searchImageFor(item.name.en, index);
    if (file) wanted.push({ id, name: item.name.en, file });
    else console.warn(`  ${item.name.en}: no picture found`);
  }
}

// Attachments and anything else the weapon pages do not cover.
const stillMissing = () => {
  const claimed = new Set(wanted.map((w) => w.id));
  return Object.entries(catalogue)
    .filter(([id]) => !claimed.has(id) && needsImage(id))
    .map(([id, item]) => ({ id, name: item.name.en, type: item.type }));
};

const leftovers = stillMissing();
if (leftovers.length) {
  const packs = await ghostPackAttachments();
  const packIds = [...packs.keys()];
  let fromPacks = 0;
  for (const item of leftovers) {
    // A pack caption may qualify the part it shipped with — "Compensated
    // Buttstock - SR25" is our plain "Compensated Buttstock".
    const key = packs.has(item.id)
      ? item.id
      : packIds.find((p) => p.startsWith(`${item.id}-`) || item.id.startsWith(`${p}-`));
    if (key) { wanted.push({ ...item, file: packs.get(key) }); fromPacks++; }
  }
  console.log(`ghost pack galleries: ${fromPacks} attachments`);
}

const stragglers2 = stillMissing();
if (stragglers2.length) {
  // A weapon and an attachment can share a name — the wiki's "G28.png" is the
  // rifle, not the G28 scope — so only the weapon may claim that filename.
  const weaponNames = new Set(
    Object.values(catalogue).filter((i) => GUN_TYPES.has(i.type)).map((i) => bareKey(i.name.en))
  );
  const safe = stragglers2.filter(
    (i) => GUN_TYPES.has(i.type) || !weaponNames.has(bareKey(i.name))
  );
  const exact = await exactNameFiles(safe);
  for (const item of safe) {
    const file = exact.get(item.id);
    if (file) wanted.push({ ...item, file });
  }
  console.log(`exact filename matches: ${exact.size}`);
}

wanted.splice(limit === Infinity ? wanted.length : limit);
console.log(`matched ${wanted.length} catalogue entries needing a picture`);
if (!wanted.length) process.exit(0);

const urls = await resolveFiles([...new Set(wanted.map((w) => w.file))]);
await mkdir(OUT_DIR, { recursive: true });

let saved = 0;
let bytes = 0;
const failed = [];

for (const item of wanted) {
  const url = urls.get(fileKey(item.file));
  if (!url) { failed.push(`${item.name}: no URL for ${item.file}`); continue; }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const out = path.join(OUT_DIR, `${item.id}.jpg`);
    const info = await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#12161c' }) // some renders are transparent PNGs
      .jpeg({ quality: QUALITY, progressive: true })
      .toFile(out);
    saved++;
    bytes += info.size;
    console.log(`  ${item.id}.jpg  (${item.name})`);
  } catch (err) {
    failed.push(`${item.name}: ${err.message}`);
  }
}

console.log(`\nsaved ${saved} images, ${(bytes / 1e6).toFixed(1)} MB into assets/items/`);
if (failed.length) console.warn(`failed ${failed.length}:\n  ${failed.join('\n  ')}`);

// Point the catalogue at only the files that actually exist, so popups show
// "no image yet" instead of a broken thumbnail for everything else.
const items = JSON.parse(await readFile(path.join(ROOT, 'data', 'items.json'), 'utf8'));
let linked = 0;
for (const [id, item] of Object.entries(items.items)) {
  const rel = `assets/items/${id}.jpg`;
  const has = existsSync(path.join(ROOT, rel));
  if (has) linked++;
  item.image = has ? rel : '';
}
await writeFile(path.join(ROOT, 'data', 'items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');
console.log(`items.json: ${linked} of ${Object.keys(items.items).length} entries now have a picture`);

