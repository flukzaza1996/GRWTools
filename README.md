# GRWTools — Ghost Recon Wildlands interactive map

A static, offline-capable map of Bolivia showing where collectibles, rebel
resources, vehicles and mission targets are. Thai and English, searchable,
zoomable, with per-marker pictures and "I already picked this up" tracking.

It ships with **an editor built in**, because the hard part of this project is
not the website — it is the data. You click pins onto the map, hit Export, and
commit the JSON. See **Data sources** below before you publish anything.

## Getting started

```bash
npm install          # sharp (tiler) + leaflet (vendored into vendor/)
npm run vendor       # copy Leaflet + MarkerCluster into vendor/
npm run tiles        # download the source map and cut the tile pyramid
npm run serve        # http://localhost:5173
```

`npm run tiles` downloads a ~10 MB source image to `source/` (git-ignored) and
writes ~1200 tiles totalling ~17 MB into `assets/tiles/`. Run it once.

## Data sources

**`data/markers.json`** — the committed marker set, 980 markers, imported from
[guides4gamers](https://guides4gamers.com/ghost-recon-wildlands/maps/bolivia/):

```bash
npm run markers          # writes data/markers.local.json
cp data/markers.local.json data/markers.json
```

> **Know what you are publishing.** guides4gamers' [terms](https://guides4gamers.com/terms/)
> permit *"view, download, or print content for personal, non-commercial use"*
> and forbid redistribution; their `robots.txt` disallows `/json/`. This repo
> ships the coordinates anyway, at the repo owner's decision, credited in the
> site footer. If you fork this, that call is yours to make — the alternative is
> to empty `data/markers.json` and place the pins yourself with the editor.

The importer writes `data/markers.local.json`, which is git-ignored and which
the app prefers over `data/markers.json` when present. That gives you somewhere
to try an import without disturbing the published file; the sidebar shows a red
notice while the override is live. Copy it over `markers.json` when happy.

Re-running the importer is safe: province assignments, Thai translations and
image filenames you added are carried across by marker id.

**`data/items.json`** — 122 weapons and attachments, committed. Names, types and
in-game blurbs come from the case markers themselves; guns you unlock by rank or
DLC are topped up from [Ghost Recon Wiki](https://ghostrecon.fandom.com/) (CC BY-SA,
credited in the site footer).

```bash
npm run items    # names, types, blurbs
npm run images   # gun renders     -> assets/items/<id>.jpg
npm run icons    # map icons + boss portraits
```

## Pictures

Every one of the 980 markers shows something when you open it:

| What you clicked | What you see |
| --- | --- |
| Weapon case (51 of 51) | the gun's in-game render |
| Accessory case | the attachment's render, or a drawing of that kind of part |
| Buchón (26 of 28) | the boss's portrait |
| Everything else | the in-game HUD icon for that marker type |

Nothing falls through to "no image yet".

`fetch-item-images.mjs` works through four sources in order:

1. **Infobox images** on the pages in `Category:Ghost Recon Wildlands Weapons`.
2. **[Weapons of Wildlands](https://ghostrecon.fandom.com/wiki/Weapons_of_Wildlands)**,
   a table written as `[[Real designation|In-game name]]`. That is how it knows
   the game's "SR-1" is the wiki's "DSR-1" and "5.7 USG" is "FN Five-seveN" —
   no hand-maintained alias list.
3. **Ghost Pack galleries**, captioned `Foregrip V4 (Underbarrel)` — the same
   name-and-type pair the catalogue ids are built from. This is the only place
   attachment renders exist.
4. **Exact filename matches** (`File:Suppressor.png`), skipped when a weapon
   already owns that name, since the wiki's `G28.png` is the rifle rather than
   the G28 scope.

All 75 guns are covered.

`fetch-category-icons.mjs` grabs one HUD symbol per marker type from the
Wildlands wiki, falling back to the POI dump for the four types the wiki does
not document (rebel radios, antennas, network stations, parachute drops). Boss
portraits are written straight into each marker's `images` array.

**Most attachments were never rendered.** Only the parts sold in Ghost Packs
have wiki artwork, so 13 of the 43 scopes, magazines, muzzles, grips and stocks
get a real picture. Checked and ruled out: both wikis, the Gunsmith article,
every gunsmith template, and a File-namespace sweep — the base-game parts simply
do not exist as images anywhere. Files like `AK200 Extended Magazine.png` are a
trap: that is the AK-200's magazine, not the game's 200-round ammo box.

The remaining 30 fall back to `assets/parttypes/*.svg` — our own drawings of a
scope, magazine, muzzle, barrel, stock, rail, foregrip and gadget. Not the exact
model, but paired with the in-game name and description ("7.62x51 Ammo Box
(200), Light Machine Gun") the popup says what the case holds. These are drawn
here rather than downloaded, so they are committed like any other source file.

Drop your own screenshot in as `assets/items/<id>.jpg` and re-run `npm run items`
to replace a drawing with the real thing.

The downloaded artwork is committed so a clone renders every popup straight
away. That is a call made for a **private** repo: the pictures come from Fandom
under CC BY-SA (credited in the footer), but the game renders inside them belong
to Ubisoft. Before making the repo public, either drop `assets/icons`,
`assets/items` and `assets/portraits` back into `.gitignore` and let people
rebuild them with `npm run images && npm run icons`, or satisfy yourself that
publishing them is allowed.

## Provinces

The POI dump has no province field, but most POI names give it away —
`Kingslayer File, Koani`, `Tabacal Alpha`, `Koani #1`. The importer reads the
province off the name for **666 of the 980 markers**, then places each province
by the centroid of its own markers and assigns the remaining 314 to the nearest
one. All 21 provinces come out populated, with no manual work.

`data/regions.json` carries a `center` per province so the editor's **Assign
provinces** button works on a fresh pin without any setup. The centres are the
mean position of each province's own markers:

```bash
npm run centres    # recompute from whatever marker file is present
```

Nearest-centre agrees with the name-derived province for **880 of the 980**
markers. The 100 it gets wrong all sit near a border between two provinces, so
treat the button as a fast first pass and fix the strays by hand. The editor
still has the manual path too: pan to a province, **Set centre here**, then
**Export regions.json**.

A re-import recomputes provinces from scratch — translations, pictures and item
links are preserved, provinces are not.

## Building the dataset

Open **<http://localhost:5173/?edit=1>**.

- **Click the map** to place a marker and fill in its details.
- **Rapid place**: tick it, lock a type and a province, then click repeatedly.
  Pins drop instantly with no form — this is how you get through a province of
  rebel supplies without going insane. Name them later, or not at all.
- **Drag a pin** to nudge it; **Ctrl+Z** undoes the last 20 operations.
- **Export JSON** downloads `markers.json` — drop it over `data/markers.json`.
- Edits live in `localStorage` until exported. The panel shows how many changes
  are still unexported, so you know when it is safe to close the tab.

Pictures: drop screenshots into `assets/items/` and reference them by bare
filename (`p227.jpg`). A marker can also link to an entry in `data/items.json`,
which shares one name and picture across every place that item appears.

Province centres in `data/regions.json` are already filled in (see **Provinces**).
To move one, pan to the province and use **Set centre here**, then **Export
regions.json**.

## Layout

| Path | What it is |
| --- | --- |
| `js/config.js` | Map geometry — mirrors `tools/map-spec.mjs` |
| `js/categories.js` | Every marker type. The only file to touch when adding one |
| `js/data.js` | Loads `data/*.json`, owns the editor's draft |
| `js/layers.js` | Leaflet marker layers and clustering |
| `js/filters.js` | Sidebar tree, visibility predicate |
| `js/search.js` | Cross-language search index |
| `js/editor.js` | `?edit=1` |
| `js/i18n.js` | Thai/English UI strings |
| `tools/make-tiles.mjs` | Source image → tile pyramid |
| `tools/check-tiles.mjs` | Re-stitch a zoom level to eyeball the pyramid |
| `tools/import-guides4gamers.mjs` | POI dump → `data/markers.local.json` |
| `tools/build-items.mjs` | Case POIs + wiki → `data/items.json` |
| `tools/fetch-item-images.mjs` | Wiki gun renders → `assets/items/` |
| `tools/fetch-category-icons.mjs` | HUD icons + boss portraits |
| `tools/g4g-source.mjs` | Shared fetch/cache and name parsing |
| `tools/set-region-centres.mjs` | Province centres from marker averages |

### Coordinates

Markers store **pixel coordinates in an 8192×8192 square**, measured from the
top-left. The artwork itself is 7676×7680 and sits in the top-left of that
square; the padding exists so every zoom level divides evenly into 256 px tiles.
Leaflet runs on `CRS.Simple` with `js/map.js` converting via `px2ll`/`ll2px`.

libvips writes its "google" tile layout as `{z}/{row}/{column}.jpg`, so the tile
URL template is `{z}/{y}/{x}.jpg` — not the `{z}/{x}/{y}` you might expect.
Getting this backwards transposes the map and scatters black padding tiles
through the middle of Bolivia.

## Deploying

Live at **<https://flukzaza1996.github.io/GRWTools/>**.

It is a static site with no build step, so GitHub Pages serves the repository as
it stands: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
The empty `.nojekyll` file stops Jekyll from touching `assets/tiles`, and the
whole payload is ~23 MB against a 1 GB limit.

Every path in the app is relative, so it works from a project subpath
(`/GRWTools/`) without a `base` setting.

Before publishing a fork, re-read **Data sources** and **Pictures** — this repo
publishes marker coordinates and wiki artwork that are not ours.

## Credits

Fan project, not affiliated with Ubisoft. Ghost Recon Wildlands is a trademark
of Ubisoft Entertainment. Map artwork is a community scan of the in-game map.
