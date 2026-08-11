// Builds data/items.json — the catalogue of guns and attachments a marker can
// hand you.
//
//   node tools/build-items.mjs [--refresh] [--no-wiki]
//
// Two sources:
//   1. The weapon/accessory case POIs, which name their contents exactly as the
//      game does ("Sniper Rifle: MSR") along with the in-game blurb.
//   2. Ghost Recon Wiki, for the guns you unlock by rank or DLC and therefore
//      never find in a case. CC BY-SA — the site footer credits it.
//
// Unlike markers.local.json this output IS committed: weapon names are facts and
// the wiki text is openly licensed.

import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadDataset, htmlToText, parseItemName, slug, bareKey } from './g4g-source.mjs';

const refresh = process.argv.includes('--refresh');
const useWiki = !process.argv.includes('--no-wiki');

const OUT = path.join(ROOT, 'data', 'items.json');

// Only point at a picture that is really there — an empty string makes the
// popup say "no image yet" instead of showing a broken thumbnail.
// tools/fetch-item-images.mjs fills assets/items/ in.
const imageFor = (id) => {
  const rel = `assets/items/${id}.jpg`;
  return existsSync(path.join(ROOT, rel)) ? rel : '';
};
const WIKI = 'https://ghostrecon.fandom.com/api.php';
const WIKI_CATEGORY = 'Category:Ghost Recon Wildlands Weapons';
const UA = 'GRWTools/0.1 (personal, non-commercial map project)';

// Wiki prose gets normalised into the vocabulary the POI names already use.
// Order matters: the last entry is a catch-all, so the specific classes have to
// get their chance first.
const CLASS_PATTERNS = [
  [/designated marksman rifle|marksman rifle/i, 'Designated Marksman Rifle'],
  [/sniper rifle/i, 'Sniper Rifle'],
  [/light machine ?gun|\bLMG\b|squad automatic/i, 'Light Machine Gun'],
  [/compact machine ?gun|machine pistol|\bCMG\b/i, 'Compact Machine Gun'],
  [/sub-?machine ?gun|\bSMG\b/i, 'Submachine Gun'],
  [/shotgun/i, 'Shotgun'],
  [/handgun|\bpistol\b|revolver/i, 'Handgun'],
  [/machine ?gun/i, 'Light Machine Gun'],
  [/assault rifle|battle rifle|\bcarbine\b|bullpup|\brifle\b/i, 'Assault Rifle'],
];

// A couple of wiki stubs say nothing that identifies their class. Naming them
// here beats leaving a rifle filed under "Gadget".
const TYPE_OVERRIDES = {
  G36C: 'Assault Rifle',
  UMP45: 'Submachine Gun',
};

/** Wikitext -> readable prose. */
function stripWiki(s) {
  return String(s)
    .replace(/<ref[^>]*>.*?<\/ref>/gis, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Read the first argument of {{Quote|...}}. A plain split on "|" would cut the
 * blurb in half whenever it contains a piped wiki link, so track nesting.
 */
function quoteArg(text) {
  const start = text.search(/\{\{Quote\|/i);
  if (start < 0) return '';
  let i = start + text.slice(start).indexOf('|') + 1;
  let brackets = 0;
  let braces = 0;
  let out = '';
  for (; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '[[') brackets++;
    else if (two === ']]') brackets--;
    else if (two === '{{') braces++;
    else if (two === '}}') {
      if (braces === 0) break;
      braces--;
    }
    if (text[i] === '|' && brackets === 0 && braces === 0) break;
    out += text[i];
  }
  return stripWiki(out);
}

async function wikiJson(params) {
  const url = `${WIKI}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function wikiWeaponPages() {
  const json = await wikiJson({
    action: 'query',
    list: 'categorymembers',
    cmtitle: WIKI_CATEGORY,
    cmlimit: '500',
  });
  // The category also holds File: pages; only real articles describe a weapon.
  return json.query.categorymembers.filter((m) => m.ns === 0).map((m) => m.title);
}

/** Pull class, in-game blurb and the province the wiki says a gun turns up in. */
function parseWikitext(title, text) {
  const name = (text.match(/\{\{DISPLAYTITLE:([^}]+)\}\}/)?.[1] ?? title.split('/')[0]).trim();

  const note = quoteArg(text);

  // Classify on article prose first — templates are stripped so infobox field
  // names cannot match. Stub pages carry nothing but the quote template, so
  // fall back to the blurb and then to the whole page before giving up.
  const classify = (s) => (s ? CLASS_PATTERNS.find(([re]) => re.test(s))?.[1] : undefined);
  const prose = stripWiki(text.replace(/\{\{[^{}]*\}\}/g, ' ')).slice(0, 1500);
  const type =
    TYPE_OVERRIDES[name] ?? classify(prose) ?? classify(note) ?? classify(stripWiki(text)) ?? '';

  const province = text.match(/acquired in the \[\[([^\]|]+)/)?.[1]?.trim() ?? '';

  return { name, type, note, province };
}

async function wikiWeapons() {
  const titles = await wikiWeaponPages();
  console.log(`wiki: ${titles.length} pages in ${WIKI_CATEGORY}`);
  const out = [];

  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const json = await wikiJson({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: batch.join('|'),
    });
    for (const page of Object.values(json.query.pages)) {
      const text = page.revisions?.[0]?.slots?.main?.['*'];
      if (text) out.push(parseWikitext(page.title, text));
    }
  }
  return out;
}

// ------------------------------------------------------------------- build

const dataset = await loadDataset({ refresh });
const items = {};

for (const poi of Object.values(dataset.pois)) {
  if (poi.icon !== 32 && poi.icon !== 33) continue;
  const { type, name, id } = parseItemName(poi.name);
  if (!type) continue;
  if (items[id]) continue;
  items[id] = {
    type,
    name: { en: name, th: '' },
    note: { en: htmlToText(poi.description), th: '' },
    image: imageFor(id),
    source: 'in-game',
  };
}

const fromCases = Object.keys(items).length;
console.log(`cases: ${fromCases} distinct items`);

if (useWiki) {
  const known = new Set(Object.values(items).map((it) => bareKey(it.name.en)));
  let added = 0;

  for (const w of await wikiWeapons()) {
    if (!w.name || known.has(bareKey(w.name))) continue;
    // Mines, lures and launchers live in the same category but are not guns.
    const type = w.type || 'Gadget';
    const id = slug(`${type}-${w.name}`);
    if (items[id]) continue;
    items[id] = {
      type,
      name: { en: w.name, th: '' },
      note: { en: w.note, th: '' },
      image: imageFor(id),
      source: 'wiki',
      ...(w.province ? { provinceHint: w.province } : {}),
    };
    known.add(bareKey(w.name));
    added++;
  }
  console.log(`wiki: added ${added} items not obtainable from a case`);
}

const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));

await writeFile(
  OUT,
  JSON.stringify(
    {
      version: 1,
      note:
        'Catalogue of things a marker can hand you. Marker.item points at these ids. ' +
        'Entries with source "wiki" come from Ghost Recon Wiki (CC BY-SA); ' +
        'drop pictures into assets/items/<id>.jpg to fill in the images.',
      items: sorted,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

const byType = {};
for (const it of Object.values(sorted)) byType[it.type] = (byType[it.type] ?? 0) + 1;
console.log(`\nwrote data/items.json — ${Object.keys(sorted).length} items`);
for (const [type, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${type}`);
}
