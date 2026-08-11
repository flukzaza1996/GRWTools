// Single source of truth for every marker type on the map.
//
// Adding, removing or renaming a category is a change to THIS FILE ONLY —
// the filter tree, editor dropdowns, counters, legend and popups all read
// from here. Translated labels live in js/i18n.js under `cat.<id>`.
//
// `shape` picks one of the primitives drawn in makeGlyph() below. Drop a PNG
// or SVG into assets/icons/ and set `icon: 'assets/icons/foo.svg'` to override
// the generated glyph for a category.

// Colour carries the group, shape separates types inside it.

export const GROUPS = [
  { id: 'collectibles', cats: ['weaponCase', 'accessoryCase', 'skillPoint', 'bonusMedal', 'kingslayerFile'] },
  { id: 'rebel', cats: ['rebelSupply', 'suppliesAir', 'intel', 'rebelRadio', 'rebelSkill'] },
  { id: 'sabotage', cats: ['networkAntenna', 'networkStation'] },
  { id: 'travel', cats: ['rallyPoint', 'parachuteDrop', 'fastTravel', 'helicopter', 'plane', 'boat', 'landVehicle'] },
  { id: 'missions', cats: ['mainMission', 'sideMission', 'buchon', 'sicario'] },
];

export const CATS = {
  // Collectibles — amber
  weaponCase: { group: 'collectibles', color: '#f0a726', shape: 'square' },
  accessoryCase: { group: 'collectibles', color: '#d4762a', shape: 'hex' },
  skillPoint: { group: 'collectibles', color: '#ffd54a', shape: 'star' },
  bonusMedal: { group: 'collectibles', color: '#c9a227', shape: 'ring' },
  kingslayerFile: { group: 'collectibles', color: '#e05c3e', shape: 'diamond' },

  // Rebel resources — green
  rebelSupply: { group: 'rebel', color: '#4caf72', shape: 'square' },
  suppliesAir: { group: 'rebel', color: '#2e9e6b', shape: 'triangle' },
  intel: { group: 'rebel', color: '#86c232', shape: 'circle' },
  rebelRadio: { group: 'rebel', color: '#7cb342', shape: 'ring' },
  rebelSkill: { group: 'rebel', color: '#59a14f', shape: 'star' },

  // Cartel infrastructure worth blowing up — cyan
  networkAntenna: { group: 'sabotage', color: '#26c6da', shape: 'triangle' },
  networkStation: { group: 'sabotage', color: '#0e8ea3', shape: 'hex' },

  // Getting around — blue
  rallyPoint: { group: 'travel', color: '#4a90d9', shape: 'circle' },
  parachuteDrop: { group: 'travel', color: '#6f8fe0', shape: 'triangle' },
  fastTravel: { group: 'travel', color: '#3f51b5', shape: 'ring' },
  helicopter: { group: 'travel', color: '#64b5f6', shape: 'hex' },
  plane: { group: 'travel', color: '#5c6bc0', shape: 'diamond' },
  boat: { group: 'travel', color: '#1e88e5', shape: 'square' },
  landVehicle: { group: 'travel', color: '#9fa8da', shape: 'star' },

  // Missions and named targets — red/violet
  mainMission: { group: 'missions', color: '#e0455e', shape: 'diamond' },
  sideMission: { group: 'missions', color: '#b05ec9', shape: 'hex' },
  buchon: { group: 'missions', color: '#d1495b', shape: 'star' },
  sicario: { group: 'missions', color: '#8e5ba6', shape: 'circle' },
};

export const CAT_IDS = Object.keys(CATS);

/** Categories in the order they appear in the sidebar. */
export const ORDERED_CAT_IDS = GROUPS.flatMap((g) => g.cats);

// Categories with a real in-game map icon sitting in assets/icons/, put there
// by tools/fetch-category-icons.mjs. Popups fall back to it when a marker has
// no picture of its own, so a Kingslayer File still shows what it looks like.
const WITH_ICON = new Set([
  'weaponCase', 'accessoryCase', 'skillPoint', 'bonusMedal', 'kingslayerFile',
  'intel', 'mainMission', 'rallyPoint', 'rebelSupply', 'rebelSkill', 'suppliesAir',
  'helicopter', 'plane', 'landVehicle', 'boat', 'sicario', 'buchon',
  'rebelRadio', 'networkAntenna', 'networkStation', 'parachuteDrop',
]);

export const categoryPhoto = (catId) => (WITH_ICON.has(catId) ? `assets/icons/${catId}.png` : '');

const SHAPES = {
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/>',
  triangle: '<polygon points="12,3.5 20,18.5 4,18.5"/>',
  diamond: '<polygon points="12,3 21,12 12,21 3,12"/>',
  hex: '<polygon points="21,12 16.5,19.79 7.5,19.79 3,12 7.5,4.21 16.5,4.21"/>',
  star: '<polygon points="12,3 14.29,8.85 20.56,9.22 15.71,13.21 17.29,19.28 12,15.9 6.71,19.28 8.29,13.21 3.44,9.22 9.71,8.85"/>',
  ring: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="5"/>',
};

/** Inline SVG glyph for a category, sized to fill its container. */
export function makeGlyph(catId) {
  const cat = CATS[catId];
  if (!cat) return '';
  if (cat.icon) return `<img class="glyph-img" src="${cat.icon}" alt="" />`;
  return `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${SHAPES[cat.shape] ?? SHAPES.circle}</svg>`;
}

/** HTML for one map pin. `found` dims the pin once the user has ticked it off. */
export function makePinHtml(catId, { found = false } = {}) {
  const cat = CATS[catId];
  const color = cat?.color ?? '#888';
  return (
    `<span class="pin${found ? ' pin--found' : ''}" style="--pin:${color}">` +
    `${makeGlyph(catId)}</span>`
  );
}

/** Small swatch used in the sidebar legend, search results and popups. */
export function makeSwatchHtml(catId) {
  const color = CATS[catId]?.color ?? '#888';
  return `<span class="swatch" style="--pin:${color}">${makeGlyph(catId)}</span>`;
}
