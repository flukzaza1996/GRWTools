// Thai/English UI strings plus the helpers that keep the DOM in sync.
//
// Marker names and notes are NOT here — those live bilingually inside each
// marker record. In-game proper nouns (P227, Kingslayer, Buchón) stay in
// English in both languages so they match what the player sees on screen.

import { STORAGE } from './config.js';

export const LANGS = ['th', 'en'];

const DICT = {
  th: {
    'app.title': 'แผนที่ Ghost Recon Wildlands',
    'app.subtitle': 'ของสะสม · ทรัพยากร · ยานพาหนะ · ภารกิจ',

    'search.placeholder': 'ค้นหาของ / จังหวัด / ชนิด…',
    'search.clear': 'ล้างคำค้น',
    'search.empty': 'ไม่พบผลลัพธ์',
    'search.hint': 'พิมพ์อย่างน้อย 2 ตัวอักษร',
    'search.results': 'พบ {n} รายการ',
    'search.more': 'และอีก {n} รายการ',

    'filter.title': 'ชนิดหมุด',
    'filter.all': 'เลือกทั้งหมด',
    'filter.none': 'ล้างทั้งหมด',
    'filter.hideFound': 'ซ่อนอันที่เก็บแล้ว',

    'group.collectibles': 'ของสะสม',
    'group.rebel': 'ทรัพยากรกบฏ',
    'group.sabotage': 'ก่อวินาศกรรม',
    'group.travel': 'เดินทาง & ยานพาหนะ',
    'group.missions': 'ภารกิจ & เป้าหมาย',

    'cat.weaponCase': 'กล่องปืน',
    'cat.accessoryCase': 'กล่องอะไหล่ปืน',
    'cat.skillPoint': 'แต้มสกิล',
    'cat.bonusMedal': 'เหรียญโบนัส',
    'cat.kingslayerFile': 'แฟ้ม Kingslayer',
    'cat.rebelSupply': 'เสบียงกบฏ',
    'cat.suppliesAir': 'เสบียงทางอากาศ',
    'cat.intel': 'ข่าวกรอง',
    'cat.rebelRadio': 'วิทยุกบฏ',
    'cat.rebelSkill': 'สกิลกบฏ',
    'cat.networkAntenna': 'เสาสัญญาณ',
    'cat.networkStation': 'สถานีเครือข่าย',
    'cat.rallyPoint': 'จุดรวมพล',
    'cat.parachuteDrop': 'จุดกระโดดร่ม',
    'cat.helicopter': 'เฮลิคอปเตอร์',
    'cat.plane': 'เครื่องบิน',
    'cat.boat': 'เรือ',
    'cat.landVehicle': 'รถ',
    'cat.fastTravel': 'จุดวาร์ป',
    'cat.mainMission': 'ภารกิจหลัก',
    'cat.sideMission': 'ภารกิจย่อย',
    'cat.buchon': 'Buchón',
    'cat.sicario': 'Sicario',

    'region.title': 'จังหวัด',
    'region.all': 'ทุกจังหวัด',
    'region.unknown': 'ยังไม่ระบุจังหวัด',

    'progress.title': 'ความคืบหน้า',
    'progress.count': 'เก็บแล้ว {found} / {total}',
    'progress.reset': 'ล้างความคืบหน้า',
    'progress.resetConfirm': 'ล้างรายการที่เก็บแล้วทั้งหมด?',
    'progress.export': 'บันทึกความคืบหน้า',
    'progress.import': 'โหลดความคืบหน้า',

    'popup.found': 'เก็บแล้ว',
    'popup.copyLink': 'ก๊อปลิงก์',
    'popup.copied': 'ก๊อปแล้ว',
    'popup.coords': 'พิกัด',
    'popup.noImage': 'ยังไม่มีรูป',
    'popup.edit': 'แก้ไข',

    'lang.toggle': 'EN',
    'theme.toggle': 'สลับธีม',
    'sidebar.toggle': 'เปิด/ปิดเมนู',
    'map.empty.title': 'ยังไม่มีข้อมูลหมุด',
    'map.empty.body': 'เปิดโหมด Editor ด้วย ?edit=1 เพื่อเริ่มปักหมุด แล้วกด Export เป็น data/markers.json',

    'editor.title': 'โหมด Editor',
    'editor.exit': 'ออกจาก Editor',
    'editor.hint': 'คลิกบนแผนที่เพื่อวางหมุด · ลากหมุดเพื่อขยับ',
    'editor.cursor': 'เคอร์เซอร์',
    'editor.rapid': 'โหมดปักรัว',
    'editor.rapidOn': 'ปักรัว: เปิด — คลิกเพื่อวางหมุดชนิดที่ล็อกไว้ทันที',
    'editor.lockedCat': 'ชนิดที่ล็อก',
    'editor.newMarker': 'หมุดใหม่',
    'editor.editMarker': 'แก้ไขหมุด',
    'editor.cat': 'ชนิด',
    'editor.region': 'จังหวัด',
    'editor.item': 'ของ (จากแคตตาล็อก)',
    'editor.itemNone': '— ไม่ผูกกับของ —',
    'editor.nameTh': 'ชื่อ (ไทย)',
    'editor.nameEn': 'ชื่อ (อังกฤษ)',
    'editor.noteTh': 'โน้ต (ไทย)',
    'editor.noteEn': 'โน้ต (อังกฤษ)',
    'editor.images': 'ไฟล์รูป (คั่นด้วย ,)',
    'editor.imagesHint': 'ใส่ชื่อไฟล์ที่วางไว้ใน assets/items/ เช่น p227.jpg',
    'editor.save': 'บันทึก',
    'editor.cancel': 'ยกเลิก',
    'editor.delete': 'ลบ',
    'editor.duplicate': 'ทำซ้ำ',
    'editor.deleteConfirm': 'ลบหมุดนี้?',
    'editor.undo': 'ย้อนกลับ',
    'editor.nothingToUndo': 'ไม่มีอะไรให้ย้อน',
    'editor.export': 'Export JSON',
    'editor.import': 'Import JSON',
    'editor.dirty': 'ยังไม่ export {n} รายการ',
    'editor.clean': 'ตรงกับไฟล์แล้ว',
    'editor.discard': 'ทิ้งงานที่ยังไม่ export',
    'editor.discardConfirm': 'ทิ้งการแก้ไขทั้งหมดที่ยังไม่ export?',
    'editor.exported': 'Export แล้ว — เอาไฟล์ไปวางทับ data/{file}',
    'editor.imported': 'Import แล้ว {n} หมุด',
    'editor.importFailed': 'อ่านไฟล์ไม่ได้',
    'editor.total': 'หมุดทั้งหมด {n}',
    'editor.provinces': 'จังหวัด',
    'editor.provincesHint':
      'ข้อมูลที่ import มาไม่มีจังหวัด — เลื่อนแผนที่ไปกลางจังหวัด เลือกชื่อ แล้วกดตั้งจุดกลาง ทำครบแล้วกดระบุจังหวัด',
    'editor.setCentre': 'ตั้งจุดกลางตรงนี้',
    'editor.centresSet': 'ตั้งจุดกลางแล้ว {n}/{total} จังหวัด',
    'editor.assignRegions': 'ระบุจังหวัดให้ทุกหมุด',
    'editor.assigned': 'ระบุจังหวัดแล้ว {n} หมุด',
    'editor.needCentres': 'ต้องตั้งจุดกลางอย่างน้อย 1 จังหวัดก่อน',
    'editor.exportRegions': 'Export regions.json',
    'editor.exportedRegions': 'Export แล้ว — เอาไฟล์ไปวางทับ data/regions.json',

    'footer.disclaimer':
      'โปรเจกต์ของแฟนเกม ไม่เกี่ยวข้องกับ Ubisoft · Ghost Recon Wildlands เป็นเครื่องหมายการค้าของ Ubisoft Entertainment',
    'footer.itemCredit': 'ข้อมูลปืนบางส่วนจาก Ghost Recon Wiki (CC BY-SA)',
    'footer.markerCredit': 'พิกัดหมุดอ้างอิงจาก guides4gamers.com',
    'data.localBadge': 'ชุดข้อมูลส่วนตัว',
    'data.localNote':
      'พิกัดหมุดจาก guides4gamers.com — ใช้ส่วนตัวเท่านั้น ห้ามเผยแพร่ต่อหรือ push ขึ้นที่สาธารณะ',
  },

  en: {
    'app.title': 'Ghost Recon Wildlands Map',
    'app.subtitle': 'Collectibles · Resources · Vehicles · Missions',

    'search.placeholder': 'Search items, provinces, types…',
    'search.clear': 'Clear search',
    'search.empty': 'No matches',
    'search.hint': 'Type at least 2 characters',
    'search.results': '{n} results',
    'search.more': 'and {n} more',

    'filter.title': 'Marker types',
    'filter.all': 'Select all',
    'filter.none': 'Clear all',
    'filter.hideFound': 'Hide collected',

    'group.collectibles': 'Collectibles',
    'group.rebel': 'Rebel resources',
    'group.sabotage': 'Sabotage',
    'group.travel': 'Travel & vehicles',
    'group.missions': 'Missions & targets',

    'cat.weaponCase': 'Weapon Case',
    'cat.accessoryCase': 'Accessory Case',
    'cat.skillPoint': 'Skill Point',
    'cat.bonusMedal': 'Bonus Medal',
    'cat.kingslayerFile': 'Kingslayer File',
    'cat.rebelSupply': 'Supplies Drop',
    'cat.suppliesAir': 'Supplies Air Transport',
    'cat.intel': 'Major Intel',
    'cat.rebelRadio': 'Rebel Radio',
    'cat.rebelSkill': 'Rebel Skill',
    'cat.networkAntenna': 'Network Antenna',
    'cat.networkStation': 'Network Station',
    'cat.rallyPoint': 'Rally Point',
    'cat.parachuteDrop': 'Parachute Drop Site',
    'cat.helicopter': 'Helicopter',
    'cat.plane': 'Plane',
    'cat.boat': 'Boat',
    'cat.landVehicle': 'Land Vehicle',
    'cat.fastTravel': 'Fast Travel',
    'cat.mainMission': 'Main Mission',
    'cat.sideMission': 'Side Mission',
    'cat.buchon': 'Buchón',
    'cat.sicario': 'Sicario',

    'region.title': 'Province',
    'region.all': 'All provinces',
    'region.unknown': 'Unassigned',

    'progress.title': 'Progress',
    'progress.count': '{found} / {total} collected',
    'progress.reset': 'Reset progress',
    'progress.resetConfirm': 'Clear everything marked as collected?',
    'progress.export': 'Save progress',
    'progress.import': 'Load progress',

    'popup.found': 'Collected',
    'popup.copyLink': 'Copy link',
    'popup.copied': 'Copied',
    'popup.coords': 'Coords',
    'popup.noImage': 'No image yet',
    'popup.edit': 'Edit',

    'lang.toggle': 'ไทย',
    'theme.toggle': 'Toggle theme',
    'sidebar.toggle': 'Toggle menu',
    'map.empty.title': 'No markers yet',
    'map.empty.body': 'Open ?edit=1 to start placing markers, then Export to data/markers.json',

    'editor.title': 'Editor mode',
    'editor.exit': 'Exit editor',
    'editor.hint': 'Click the map to place a marker · drag a pin to move it',
    'editor.cursor': 'Cursor',
    'editor.rapid': 'Rapid place',
    'editor.rapidOn': 'Rapid place ON — clicks drop the locked type immediately',
    'editor.lockedCat': 'Locked type',
    'editor.newMarker': 'New marker',
    'editor.editMarker': 'Edit marker',
    'editor.cat': 'Type',
    'editor.region': 'Province',
    'editor.item': 'Item (from catalogue)',
    'editor.itemNone': '— not linked —',
    'editor.nameTh': 'Name (Thai)',
    'editor.nameEn': 'Name (English)',
    'editor.noteTh': 'Note (Thai)',
    'editor.noteEn': 'Note (English)',
    'editor.images': 'Image files (comma separated)',
    'editor.imagesHint': 'Filenames you dropped into assets/items/, e.g. p227.jpg',
    'editor.save': 'Save',
    'editor.cancel': 'Cancel',
    'editor.delete': 'Delete',
    'editor.duplicate': 'Duplicate',
    'editor.deleteConfirm': 'Delete this marker?',
    'editor.undo': 'Undo',
    'editor.nothingToUndo': 'Nothing to undo',
    'editor.export': 'Export JSON',
    'editor.import': 'Import JSON',
    'editor.dirty': '{n} unexported changes',
    'editor.clean': 'In sync with the file',
    'editor.discard': 'Discard unexported work',
    'editor.discardConfirm': 'Discard every change that has not been exported?',
    'editor.exported': 'Exported — drop the file over data/{file}',
    'editor.imported': 'Imported {n} markers',
    'editor.importFailed': 'Could not read that file',
    'editor.total': '{n} markers total',
    'editor.provinces': 'Provinces',
    'editor.provincesHint':
      'The imported data has no province field. Centre the map on a province, pick its name, set the centre — then assign once you have done a few.',
    'editor.setCentre': 'Set centre here',
    'editor.centresSet': '{n}/{total} province centres set',
    'editor.assignRegions': 'Assign provinces',
    'editor.assigned': 'Assigned {n} markers',
    'editor.needCentres': 'Set at least one province centre first',
    'editor.exportRegions': 'Export regions.json',
    'editor.exportedRegions': 'Exported — drop the file over data/regions.json',

    'footer.disclaimer':
      'Fan project, not affiliated with Ubisoft · Ghost Recon Wildlands is a trademark of Ubisoft Entertainment',
    'footer.itemCredit': 'Some weapon data from Ghost Recon Wiki (CC BY-SA)',
    'footer.markerCredit': 'Marker coordinates derived from guides4gamers.com',
    'data.localBadge': 'Personal dataset',
    'data.localNote':
      'Marker coordinates from guides4gamers.com — personal use only, do not redistribute or publish',
  },
};

function detectLang() {
  const saved = localStorage.getItem(STORAGE.lang);
  if (LANGS.includes(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en';
}

let lang = detectLang();
const listeners = new Set();

export const getLang = () => lang;

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  localStorage.setItem(STORAGE.lang, lang);
  document.documentElement.lang = lang;
  applyStatic();
  listeners.forEach((fn) => fn(lang));
}

export const toggleLang = () => setLang(lang === 'th' ? 'en' : 'th');

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Look up a UI string, filling {placeholders} from `vars`. */
export function t(key, vars) {
  const raw = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Look up a string in a specific language — used to index both at once. */
export const tIn = (which, key) => DICT[which]?.[key] ?? DICT.en[key] ?? key;

/**
 * Read a bilingual value stored on a record, e.g. { en: 'P227', th: '' }.
 * Falls back to the other language rather than showing an empty string.
 */
export function localized(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const other = lang === 'th' ? 'en' : 'th';
  return (value[lang] || value[other] || '').trim();
}

/** Rewrite every [data-i18n] node under `root` for the current language. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    // Format: "placeholder:search.placeholder;title:search.clear"
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
}

document.documentElement.lang = lang;
