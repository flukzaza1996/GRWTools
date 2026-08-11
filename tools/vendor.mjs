// Copies the browser runtime bits of Leaflet out of node_modules into vendor/
// so the site stays a self-contained static bundle with no CDN dependency.
//
//   node tools/vendor.mjs

import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(ROOT, 'vendor');

const copies = [
  ['node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js'],
  ['node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css'],
  ['node_modules/leaflet/dist/images', 'vendor/leaflet/images'],
  ['node_modules/leaflet.markercluster/dist/leaflet.markercluster.js', 'vendor/markercluster/leaflet.markercluster.js'],
  ['node_modules/leaflet.markercluster/dist/MarkerCluster.css', 'vendor/markercluster/MarkerCluster.css'],
  ['node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css', 'vendor/markercluster/MarkerCluster.Default.css'],
  // Both licences require the copyright notice to travel with the code. Leaflet
  // keeps its own in a /* @preserve */ header, the markercluster build does not.
  ['node_modules/leaflet/LICENSE', 'vendor/leaflet/LICENSE'],
  ['node_modules/leaflet.markercluster/MIT-LICENCE.txt', 'vendor/markercluster/MIT-LICENCE.txt'],
];

await rm(vendor, { recursive: true, force: true });
for (const [from, to] of copies) {
  const dest = path.join(ROOT, to);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(path.join(ROOT, from), dest, { recursive: true });
  console.log(`vendor: ${to}`);
}
console.log('vendor: done');
