// Draws the markers. Owns the Leaflet layer objects; everybody else talks in
// marker ids.

import { map, px2ll, ll2px } from './map.js';
import { makePinHtml } from './categories.js';
import { getMarker, onDataChange } from './data.js';
import { isFound, onProgressChange } from './progress.js';
import { visibleMarkers, hideFound, onFilterChange } from './filters.js';
import { popupHtml, bindPopup, markerTitle } from './popup.js';
import { onLangChange } from './i18n.js';

const PIN_SIZE = 28;

const cluster = L.markerClusterGroup({
  maxClusterRadius: 48,
  disableClusteringAtZoom: 4,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  chunkedLoading: true,
});

const layerById = new Map();
let editable = false;
let hooks = {};

function iconFor(marker) {
  return L.divIcon({
    className: 'pin-wrap',
    html: makePinHtml(marker.cat, { found: isFound(marker.id) }),
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    popupAnchor: [0, -PIN_SIZE / 2],
  });
}

function makeLayer(marker) {
  const layer = L.marker(px2ll(marker.x, marker.y), {
    icon: iconFor(marker),
    draggable: editable,
    autoPan: false,
    title: markerTitle(marker),
    riseOnHover: true,
  });

  layer.markerId = marker.id;
  layer.bindPopup(() => popupHtml(getMarker(layer.markerId) ?? marker, { editable }), {
    minWidth: 240,
    maxWidth: 320,
    closeButton: true,
    autoPanPadding: [24, 24],
  });

  layer.on('popupopen', (ev) => {
    const current = getMarker(layer.markerId);
    if (current) bindPopup(ev.popup.getElement(), current, { onEdit: hooks.onEdit });
  });

  layer.on('dragend', () => {
    const px = ll2px(layer.getLatLng());
    hooks.onMove?.(layer.markerId, px);
  });

  layer.on('click', () => hooks.onSelect?.(layer.markerId));

  return layer;
}

/** Rebuild the whole layer set from the current filter result. */
export function render() {
  const wanted = visibleMarkers();
  const openId = map._popup?._source?.markerId ?? null;

  cluster.clearLayers();
  layerById.clear();

  const layers = wanted.map((m) => {
    const layer = makeLayer(m);
    layerById.set(m.id, layer);
    return layer;
  });
  cluster.addLayers(layers);

  if (openId && layerById.has(openId)) layerById.get(openId).openPopup();
  hooks.onRender?.(wanted.length);
}

/** Cheap path for "collected" ticks: swap the icon, leave the layer alone. */
function refreshIcons() {
  for (const [id, layer] of layerById) {
    const marker = getMarker(id);
    if (marker) layer.setIcon(iconFor(marker));
  }
}

export function mountLayers(options = {}) {
  hooks = options;
  editable = !!options.editable;
  cluster.addTo(map);

  onDataChange(render);
  onFilterChange(render);
  onLangChange(render);
  onProgressChange(() => (hideFound() ? render() : refreshIcons()));

  render();
}

/** Fly to a marker and pop it open, expanding its cluster if need be. */
export function focusMarker(id, { zoom = 6 } = {}) {
  const marker = getMarker(id);
  if (!marker) return false;
  const layer = layerById.get(id);

  map.flyTo(px2ll(marker.x, marker.y), zoom, { duration: 0.6 });
  if (!layer) return false;

  // A flyTo that has nowhere to fly emits no moveend, so back the listener up
  // with a timer and let whichever arrives first do the work.
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    map.off('moveend', open);
    cluster.zoomToShowLayer(layer, () => layer.openPopup());
  };
  map.once('moveend', open);
  setTimeout(open, 800);
  return true;
}

export const layerFor = (id) => layerById.get(id);

/** Turn dragging on or off when the editor is toggled. */
export function setEditable(on) {
  editable = !!on;
  render();
}
