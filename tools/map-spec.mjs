// Map geometry shared between the tile generator and the browser app.
// js/config.js mirrors these values — keep the two in sync.

export const SOURCE_URL = 'https://i.redd.it/vfpcl7f2ew2z.jpg';
export const SOURCE_FILE = 'source/wildlands-map.jpg';

// Original artwork is 7676 x 7680. Padding it out to a power-of-two square
// keeps the tile grid exact at every zoom level.
export const SOURCE_W = 7676;
export const SOURCE_H = 7680;
export const IMG = 8192;
export const TILE = 256;
export const MAX_NATIVE_ZOOM = Math.log2(IMG / TILE); // 5
export const TILE_QUALITY = 82;
