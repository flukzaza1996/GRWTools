// Map geometry. Mirrors tools/map-spec.mjs — change both together.

// The tile pyramid is cut from a padded 8192x8192 square so every zoom level
// lands on an exact power-of-two grid. All marker coordinates are pixels in
// this square, measured from the top-left corner.
export const IMG = 8192;

// The real artwork only fills the top-left 7676x7680 of that square. Panning
// and tile requests are clamped here so nobody wanders into the black padding.
export const CONTENT_W = 7676;
export const CONTENT_H = 7680;

export const TILE = 256;
export const MIN_ZOOM = 1;
export const MAX_NATIVE_ZOOM = 5; // log2(IMG / TILE)
export const MAX_ZOOM = 7;        // over-zoom for precise marker placement

// libvips' "google" layout names tiles row-first — the directory is the row (y)
// and the file is the column (x). Reading them as {z}/{x}/{y} transposes the
// map and scatters the black padding tiles through the middle of Bolivia.
export const TILE_URL = 'assets/tiles/{z}/{y}/{x}.jpg';
export const BLANK_TILE = 'assets/tiles/blank.png';

export const STORAGE = {
  found: 'grw:found',
  lang: 'grw:lang',
  theme: 'grw:theme',
  filters: 'grw:filters',
  draft: 'grw:draft',
  regions: 'grw:regions',
};
