// Keeps the URL hash in step with the view and the filters, so any spot on the
// map is a shareable link:  #5/3412/5120?nocat=intel,boat&region=itacua

import { map, px2ll, ll2px } from './map.js';
import { MAX_ZOOM } from './config.js';
import { ORDERED_CAT_IDS } from './categories.js';
import { activeCats, activeRegion, setCats, setRegion, onFilterChange } from './filters.js';

let writing = false;
let bootMarkerId = '';
let onMarker = null;

function parse(hash) {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const [viewPart, queryPart = ''] = raw.split('?');
  const [z, x, y] = viewPart.split('/').map(Number);
  const params = new URLSearchParams(queryPart);
  return {
    view: [z, x, y].every(Number.isFinite) ? { z, x, y } : null,
    params,
    marker: params.get('m') ?? '',
  };
}

/**
 * Write whichever of cat/nocat is shorter. With 17 categories, "hide two of
 * them" would otherwise produce a 200-character URL nobody wants to paste.
 */
function encodeFilters(params) {
  const cats = activeCats();
  if (cats.size !== ORDERED_CAT_IDS.length) {
    const off = ORDERED_CAT_IDS.filter((c) => !cats.has(c));
    if (off.length < cats.size) params.set('nocat', off.join(','));
    else params.set('cat', [...cats].join(','));
  }
  if (activeRegion()) params.set('region', activeRegion());
  return params;
}

function applyFilters(params) {
  if (params.has('cat')) {
    const wanted = params.get('cat');
    setCats(wanted ? wanted.split(',') : []);
  } else if (params.has('nocat')) {
    const off = new Set(params.get('nocat').split(','));
    setCats(ORDERED_CAT_IDS.filter((c) => !off.has(c)));
  }
  if (params.has('region')) setRegion(params.get('region'));
}

function build() {
  const c = ll2px(map.getCenter());
  const z = Math.round(map.getZoom() * 100) / 100;
  const query = encodeFilters(new URLSearchParams()).toString();
  return `#${z}/${c.x}/${c.y}${query ? `?${query}` : ''}`;
}

function write() {
  if (writing) return;
  writing = true;
  history.replaceState(null, '', build());
  writing = false;
}

/** Shareable link that lands on one specific marker. */
export function markerPermalink(marker) {
  const params = encodeFilters(new URLSearchParams());
  params.set('m', marker.id);
  const zoom = Math.min(6, MAX_ZOOM);
  return `${location.origin}${location.pathname}${location.search}#${zoom}/${marker.x}/${marker.y}?${params}`;
}

/** Marker id the incoming URL asked for, if any. Read once at start-up. */
export const requestedMarkerId = () => bootMarkerId;

/**
 * Apply whatever the URL says, then keep mirroring changes back into it.
 * `onMarkerRequest` fires when a later hash change names a marker, so pasting a
 * copied link into the address bar of an already-open tab still works.
 */
export function initPermalink({ onMarkerRequest } = {}) {
  onMarker = onMarkerRequest ?? null;
  const parsed = parse(location.hash);
  let hadView = false;

  if (parsed) {
    bootMarkerId = parsed.marker;
    applyFilters(parsed.params);
    if (parsed.view) {
      map.setView(px2ll(parsed.view.x, parsed.view.y), Math.min(parsed.view.z, MAX_ZOOM));
      hadView = true;
    }
  }

  // replaceState does not fire hashchange, so anything arriving here was typed
  // or pasted by the user.
  window.addEventListener('hashchange', () => {
    if (writing) return;
    const next = parse(location.hash);
    if (!next) return;
    applyFilters(next.params);
    if (next.view) map.setView(px2ll(next.view.x, next.view.y), Math.min(next.view.z, MAX_ZOOM));
    if (next.marker) onMarker?.(next.marker);
  });

  map.on('moveend zoomend', write);
  onFilterChange(write);
  write();
  return hadView;
}
