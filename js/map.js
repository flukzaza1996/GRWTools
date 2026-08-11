// Leaflet setup for a flat game map: CRS.Simple plus a pixel <-> LatLng pair
// so the rest of the app never has to think in Leaflet coordinates.

import {
  IMG, CONTENT_W, CONTENT_H, TILE,
  MIN_ZOOM, MAX_NATIVE_ZOOM, MAX_ZOOM,
  TILE_URL, BLANK_TILE,
} from './config.js';

export const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  zoomSnap: 0.25,
  zoomControl: false,
  attributionControl: false,
  preferCanvas: false,
});

/** Image pixel (x, y) in the 8192 square -> Leaflet LatLng. */
export const px2ll = (x, y) => map.unproject([x, y], MAX_NATIVE_ZOOM);

/** Leaflet LatLng -> image pixel {x, y}, rounded to whole pixels. */
export function ll2px(latlng) {
  const p = map.project(latlng, MAX_NATIVE_ZOOM);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Bounds of the actual artwork, not the padded square. */
export const contentBounds = L.latLngBounds(px2ll(0, 0), px2ll(CONTENT_W, CONTENT_H));

L.tileLayer(TILE_URL, {
  tileSize: TILE,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  maxNativeZoom: MAX_NATIVE_ZOOM,
  noWrap: true,
  bounds: contentBounds,
  // All-black padding tiles were dropped at build time; anything Leaflet still
  // asks for at the ragged edge resolves to a 1px transparent placeholder.
  errorTileUrl: BLANK_TILE,
  keepBuffer: 3,
}).addTo(map);

map.setMaxBounds(contentBounds.pad(0.15));
map.fitBounds(contentBounds);

L.control.zoom({ position: 'bottomright' }).addTo(map);

/** True while the map is showing more detail than the tiles actually have. */
export const isOverZoomed = () => map.getZoom() > MAX_NATIVE_ZOOM;

/** Centre the view on a pixel coordinate at a sensible inspection zoom. */
export function flyToPixel(x, y, zoom = 5) {
  map.flyTo(px2ll(x, y), Math.min(zoom, MAX_ZOOM), { duration: 0.6 });
}

export { IMG, MAX_NATIVE_ZOOM, MAX_ZOOM, MIN_ZOOM };
