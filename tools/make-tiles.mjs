// Builds the Leaflet tile pyramid from the full-resolution Bolivia map.
//
//   node tools/make-tiles.mjs [--force]
//
// Downloads the source image on first run, pads it to a power-of-two square so
// every zoom level lands on an exact tile grid, then hands it to libvips'
// "google" dzsave layout, which writes assets/tiles/{z}/{x}/{y}.jpg directly.

import { mkdir, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  SOURCE_URL, SOURCE_FILE, SOURCE_W, SOURCE_H,
  IMG, TILE, MAX_NATIVE_ZOOM, TILE_QUALITY,
} from './map-spec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(ROOT, SOURCE_FILE);
const paddedPath = path.join(ROOT, 'source', 'wildlands-padded.jpg');
const tileDir = path.join(ROOT, 'assets', 'tiles');
const force = process.argv.includes('--force');

async function fetchSource() {
  if (existsSync(srcPath) && !force) {
    const { size } = await stat(srcPath);
    console.log(`source: reusing ${SOURCE_FILE} (${(size / 1e6).toFixed(1)} MB)`);
    return;
  }
  console.log(`source: downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(srcPath), { recursive: true });
  await writeFile(srcPath, buf);
  console.log(`source: saved ${(buf.length / 1e6).toFixed(1)} MB`);
}

async function pad() {
  const meta = await sharp(srcPath).metadata();
  if (meta.width !== SOURCE_W || meta.height !== SOURCE_H) {
    console.warn(
      `warn: source is ${meta.width}x${meta.height}, expected ${SOURCE_W}x${SOURCE_H}. ` +
      `Padding to ${IMG}x${IMG} anyway — check tools/map-spec.mjs if markers look shifted.`
    );
  }
  const right = IMG - meta.width;
  const bottom = IMG - meta.height;
  if (right < 0 || bottom < 0) {
    throw new Error(`source ${meta.width}x${meta.height} is larger than IMG=${IMG}; raise IMG in map-spec.mjs`);
  }
  console.log(`pad: ${meta.width}x${meta.height} -> ${IMG}x${IMG} (+${right} right, +${bottom} bottom)`);
  await sharp(srcPath)
    .extend({ right, bottom, background: { r: 0, g: 0, b: 0 } })
    .jpeg({ quality: 95 })
    .toFile(paddedPath);
}

async function tiles() {
  await rm(tileDir, { recursive: true, force: true });
  await mkdir(path.dirname(tileDir), { recursive: true });
  console.log(`tile: cutting ${TILE}px tiles, zoom 0-${MAX_NATIVE_ZOOM}`);
  await sharp(paddedPath)
    .jpeg({ quality: TILE_QUALITY, progressive: true })
    .tile({ size: TILE, layout: 'google', background: { r: 0, g: 0, b: 0 } })
    .toFile(tileDir);
}

async function report() {
  let count = 0;
  let bytes = 0;
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else { count++; bytes += (await stat(p)).size; }
    }
  };
  await walk(tileDir);

  const full = Array.from({ length: MAX_NATIVE_ZOOM + 1 }, (_, z) => 4 ** z)
    .reduce((a, b) => a + b, 0);
  console.log(`done: ${count} files, ${(bytes / 1e6).toFixed(1)} MB in assets/tiles`);
  console.log(
    `      ${full} tiles for a solid ${IMG}x${IMG} grid; the shortfall is all-black ` +
    `padding tiles that libvips skipped. The app clamps tile requests to the real ` +
    `artwork bounds and falls back to assets/tiles/blank.png.`
  );
}

await fetchSource();
await pad();
await tiles();
await report();
