// Editor mode (?edit=1): the tool that actually builds the dataset.
//
// Nothing here touches the network. Edits accumulate in the localStorage draft
// held by data.js; Export writes them out as data/markers.json for you to drop
// into the repo.

import { map, ll2px } from './map.js';
import { ORDERED_CAT_IDS, CATS } from './categories.js';
import {
  allMarkers, allItems, allRegions, getMarker,
  upsertMarker, deleteMarker, replaceMarkers, discardDraft,
  exportJson, nextMarkerId, draftDiffCount, hasDraft, onDataChange,
  setRegionCentre, regionsWithCentres, exportRegionsJson, assignRegionsByNearestCentre,
  markerSource,
} from './data.js';
import { t, localized, onLangChange, applyStatic } from './i18n.js';
import { focusMarker } from './layers.js';

const UNDO_LIMIT = 20;

let root = null;
let editing = null;      // marker being edited, or null
let pendingPixel = null; // where a brand-new marker will land
let rapid = false;
let lockedCat = ORDERED_CAT_IDS[0];
const undoStack = [];

export const isEditorEnabled = () => new URLSearchParams(location.search).get('edit') === '1';

// ------------------------------------------------------------------ undo

function snapshot() {
  undoStack.push(JSON.stringify(allMarkers()));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undo() {
  const prev = undoStack.pop();
  if (prev === undefined) {
    toast(t('editor.nothingToUndo'));
    return;
  }
  replaceMarkers(JSON.parse(prev));
}

// ------------------------------------------------------------------ view

function panelHtml() {
  return `
    <header class="ed__head">
      <h2 data-i18n="editor.title"></h2>
      <a class="btn btn--ghost" href="${location.pathname}" data-i18n="editor.exit"></a>
    </header>

    <p class="ed__hint" data-i18n="editor.hint"></p>

    <div class="ed__status">
      <span class="ed__cursor"><span data-i18n="editor.cursor"></span>: <b data-cursor>—</b></span>
      <span class="ed__dirty" data-dirty></span>
    </div>

    <div class="ed__rapid">
      <label class="ed__check">
        <input type="checkbox" data-rapid />
        <span data-i18n="editor.rapid"></span>
      </label>
      <label class="ed__field ed__field--inline">
        <span data-i18n="editor.lockedCat"></span>
        <select data-locked-cat></select>
      </label>
      <label class="ed__field ed__field--inline">
        <span data-i18n="editor.region"></span>
        <select data-rapid-region></select>
      </label>
    </div>

    <form class="ed__form" data-form hidden>
      <h3 data-form-title></h3>

      <label class="ed__field">
        <span data-i18n="editor.cat"></span>
        <select name="cat" data-cat-select required></select>
      </label>

      <label class="ed__field">
        <span data-i18n="editor.region"></span>
        <select name="region" data-region-select></select>
      </label>

      <label class="ed__field">
        <span data-i18n="editor.item"></span>
        <select name="item" data-item-select></select>
      </label>

      <div class="ed__pair">
        <label class="ed__field">
          <span data-i18n="editor.nameTh"></span>
          <input name="nameTh" type="text" autocomplete="off" />
        </label>
        <label class="ed__field">
          <span data-i18n="editor.nameEn"></span>
          <input name="nameEn" type="text" autocomplete="off" />
        </label>
      </div>

      <div class="ed__pair">
        <label class="ed__field">
          <span data-i18n="editor.noteTh"></span>
          <textarea name="noteTh" rows="2"></textarea>
        </label>
        <label class="ed__field">
          <span data-i18n="editor.noteEn"></span>
          <textarea name="noteEn" rows="2"></textarea>
        </label>
      </div>

      <label class="ed__field">
        <span data-i18n="editor.images"></span>
        <input name="images" type="text" autocomplete="off" placeholder="p227.jpg, p227-2.jpg" />
        <small data-i18n="editor.imagesHint"></small>
      </label>

      <div class="ed__coords">
        <label class="ed__field ed__field--tiny">
          <span>X</span><input name="x" type="number" step="1" required />
        </label>
        <label class="ed__field ed__field--tiny">
          <span>Y</span><input name="y" type="number" step="1" required />
        </label>
      </div>

      <div class="ed__buttons">
        <button type="submit" class="btn btn--primary" data-i18n="editor.save"></button>
        <button type="button" class="btn" data-cancel data-i18n="editor.cancel"></button>
        <button type="button" class="btn btn--danger" data-delete data-i18n="editor.delete" hidden></button>
        <button type="button" class="btn" data-duplicate data-i18n="editor.duplicate" hidden></button>
      </div>
    </form>

    <div class="ed__tools">
      <button type="button" class="btn" data-undo data-i18n="editor.undo"></button>
      <button type="button" class="btn btn--primary" data-export data-i18n="editor.export"></button>
      <label class="btn" role="button">
        <span data-i18n="editor.import"></span>
        <input type="file" accept="application/json,.json" data-import hidden />
      </label>
      <button type="button" class="btn btn--danger" data-discard data-i18n="editor.discard"></button>
    </div>

    <p class="ed__total" data-total></p>

    <section class="ed__provinces">
      <h3 data-i18n="editor.provinces"></h3>
      <p class="ed__hint" data-i18n="editor.provincesHint"></p>
      <select data-centre-region></select>
      <div class="ed__buttons">
        <button type="button" class="btn" data-set-centre data-i18n="editor.setCentre"></button>
        <button type="button" class="btn" data-assign-regions data-i18n="editor.assignRegions"></button>
        <button type="button" class="btn" data-export-regions data-i18n="editor.exportRegions"></button>
      </div>
      <p class="ed__total" data-centres></p>
    </section>

    <p class="ed__toast" data-toast hidden></p>`;
}

function fillSelects() {
  const catOptions = ORDERED_CAT_IDS.map(
    (c) => `<option value="${c}">${t(`cat.${c}`)}</option>`
  ).join('');
  root.querySelector('[data-cat-select]').innerHTML = catOptions;
  root.querySelector('[data-locked-cat]').innerHTML = catOptions;
  root.querySelector('[data-locked-cat]').value = lockedCat;

  const regionOptions =
    `<option value="">${t('region.unknown')}</option>` +
    allRegions().map((r) => `<option value="${r.id}">${localized(r.name)}</option>`).join('');
  const rapidRegion = root.querySelector('[data-rapid-region]');
  const centreRegion = root.querySelector('[data-centre-region]');
  const keptRapid = rapidRegion.value;
  const keptCentre = centreRegion.value;
  root.querySelector('[data-region-select]').innerHTML = regionOptions;
  rapidRegion.innerHTML = regionOptions;
  rapidRegion.value = keptRapid;
  centreRegion.innerHTML = allRegions()
    .map((r) => `<option value="${r.id}">${localized(r.name)}</option>`)
    .join('');
  centreRegion.value = keptCentre || allRegions()[0]?.id || '';

  const items = allItems();
  root.querySelector('[data-item-select]').innerHTML =
    `<option value="">${t('editor.itemNone')}</option>` +
    Object.entries(items)
      .map(([id, it]) => `<option value="${id}">${localized(it.name) || id}</option>`)
      .join('');
}

let toastTimer = 0;
function toast(message) {
  const el = root?.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

function refreshStatus() {
  const dirty = root.querySelector('[data-dirty]');
  const n = draftDiffCount();
  dirty.textContent = hasDraft() && n ? t('editor.dirty', { n }) : t('editor.clean');
  dirty.classList.toggle('is-dirty', n > 0);
  root.querySelector('[data-total]').textContent = t('editor.total', { n: allMarkers().length });
  root.querySelector('[data-centres]').textContent = t('editor.centresSet', {
    n: regionsWithCentres().length,
    total: allRegions().length,
  });
}

// ------------------------------------------------------------------ form

function openForm(marker, pixel) {
  editing = marker;
  pendingPixel = pixel ?? null;

  const form = root.querySelector('[data-form]');
  form.hidden = false;
  root.querySelector('[data-form-title]').textContent = t(marker ? 'editor.editMarker' : 'editor.newMarker');

  const src = marker ?? {
    cat: lockedCat,
    region: root.querySelector('[data-rapid-region]').value || '',
    item: '',
    name: { en: '', th: '' },
    note: { en: '', th: '' },
    images: [],
    x: pixel?.x ?? 0,
    y: pixel?.y ?? 0,
  };

  form.elements.cat.value = src.cat;
  form.elements.region.value = src.region;
  form.elements.item.value = src.item;
  form.elements.nameTh.value = src.name.th;
  form.elements.nameEn.value = src.name.en;
  form.elements.noteTh.value = src.note.th;
  form.elements.noteEn.value = src.note.en;
  form.elements.images.value = src.images.join(', ');
  form.elements.x.value = src.x;
  form.elements.y.value = src.y;

  root.querySelector('[data-delete]').hidden = !marker;
  root.querySelector('[data-duplicate]').hidden = !marker;
  form.elements.nameTh.focus();
}

function closeForm() {
  editing = null;
  pendingPixel = null;
  root.querySelector('[data-form]').hidden = true;
}

function readForm() {
  const form = root.querySelector('[data-form]');
  const cat = form.elements.cat.value;
  const region = form.elements.region.value;
  return {
    id: editing?.id ?? nextMarkerId(cat, region),
    cat,
    region,
    x: Number(form.elements.x.value),
    y: Number(form.elements.y.value),
    name: { th: form.elements.nameTh.value.trim(), en: form.elements.nameEn.value.trim() },
    note: { th: form.elements.noteTh.value.trim(), en: form.elements.noteEn.value.trim() },
    item: form.elements.item.value,
    images: form.elements.images.value.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// --------------------------------------------------------------- actions

function placeQuick(pixel) {
  const region = root.querySelector('[data-rapid-region]').value || '';
  snapshot();
  const marker = upsertMarker({
    id: nextMarkerId(lockedCat, region),
    cat: lockedCat,
    region,
    x: pixel.x,
    y: pixel.y,
    name: { en: '', th: '' },
    note: { en: '', th: '' },
    item: '',
    images: [],
  });
  toast(`+ ${marker.id}`);
}

function onMapClick(ev) {
  if (ev.originalEvent?.target?.closest?.('.leaflet-marker-icon')) return;
  const pixel = ll2px(ev.latlng);
  if (rapid) placeQuick(pixel);
  else openForm(null, pixel);
}

function onMarkerMoved(id, pixel) {
  const marker = getMarker(id);
  if (!marker) return;
  snapshot();
  upsertMarker({ ...marker, x: pixel.x, y: pixel.y });
  if (editing?.id === id) openForm(getMarker(id));
}

function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function onImport(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const list = Array.isArray(parsed) ? parsed : parsed?.markers;
    if (!Array.isArray(list)) throw new Error('no markers array');
    snapshot();
    replaceMarkers(list);
    toast(t('editor.imported', { n: list.length }));
  } catch (err) {
    console.error(err);
    toast(t('editor.importFailed'));
  }
}

// ----------------------------------------------------------------- mount

export function mountEditor(container) {
  root = container;
  root.hidden = false;
  root.innerHTML = panelHtml();
  fillSelects();
  applyStatic(root);
  refreshStatus();

  map.on('click', onMapClick);
  map.on('mousemove', (ev) => {
    const p = ll2px(ev.latlng);
    root.querySelector('[data-cursor]').textContent = `${p.x}, ${p.y}`;
  });

  root.querySelector('[data-rapid]').addEventListener('change', (ev) => {
    rapid = ev.target.checked;
    document.body.classList.toggle('rapid-place', rapid);
    if (rapid) {
      closeForm();
      toast(t('editor.rapidOn'));
    }
  });

  root.querySelector('[data-locked-cat]').addEventListener('change', (ev) => {
    lockedCat = CATS[ev.target.value] ? ev.target.value : lockedCat;
  });

  root.querySelector('[data-form]').addEventListener('submit', (ev) => {
    ev.preventDefault();
    snapshot();
    const saved = upsertMarker(readForm());
    closeForm();
    focusMarker(saved.id);
  });

  root.querySelector('[data-cancel]').addEventListener('click', closeForm);

  root.querySelector('[data-delete]').addEventListener('click', () => {
    if (!editing || !confirm(t('editor.deleteConfirm'))) return;
    snapshot();
    deleteMarker(editing.id);
    closeForm();
  });

  root.querySelector('[data-duplicate]').addEventListener('click', () => {
    const base = readForm();
    snapshot();
    const copy = upsertMarker({
      ...base,
      id: nextMarkerId(base.cat, base.region),
      x: base.x + 40,
      y: base.y + 40,
    });
    openForm(getMarker(copy.id));
  });

  root.querySelector('[data-undo]').addEventListener('click', undo);

  root.querySelector('[data-export]').addEventListener('click', () => {
    // Name the download after the file it is meant to replace, so a personal
    // dataset never gets saved over the committed one by accident.
    const name = markerSource() === 'local' ? 'markers.local.json' : 'markers.json';
    download(name, exportJson());
    toast(t('editor.exported', { file: name }));
  });

  root.querySelector('[data-import]').addEventListener('change', (ev) => {
    const file = ev.target.files?.[0];
    if (file) onImport(file);
    ev.target.value = '';
  });

  root.querySelector('[data-discard]').addEventListener('click', () => {
    if (!confirm(t('editor.discardConfirm'))) return;
    undoStack.length = 0;
    discardDraft();
    closeForm();
  });

  root.querySelector('[data-set-centre]').addEventListener('click', () => {
    const id = root.querySelector('[data-centre-region]').value;
    const c = ll2px(map.getCenter());
    if (setRegionCentre(id, [c.x, c.y])) toast(`${id}: ${c.x}, ${c.y}`);
    refreshStatus();
  });

  root.querySelector('[data-assign-regions]').addEventListener('click', () => {
    if (!regionsWithCentres().length) {
      toast(t('editor.needCentres'));
      return;
    }
    snapshot();
    toast(t('editor.assigned', { n: assignRegionsByNearestCentre() }));
  });

  root.querySelector('[data-export-regions]').addEventListener('click', () => {
    download('regions.json', exportRegionsJson());
    toast(t('editor.exportedRegions'));
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, textarea, select')) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      undo();
    }
    if (ev.key === 'Escape') closeForm();
  });

  onDataChange(refreshStatus);
  onLangChange(() => {
    const form = root.querySelector('[data-form]');
    const keep = form.hidden ? null : readForm();
    fillSelects();
    applyStatic(root);
    refreshStatus();
    if (keep) openForm(editing, { x: keep.x, y: keep.y });
  });

  return {
    onEdit: (marker) => openForm(getMarker(marker.id) ?? marker),
    onMove: onMarkerMoved,
  };
}
