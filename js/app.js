// Boot sequence and the bits of chrome that don't belong to any one module.

import { STORAGE } from './config.js';
import { ORDERED_CAT_IDS } from './categories.js';
import { loadData, allMarkers, markerSource, onDataChange } from './data.js';
import {
  t, applyStatic, toggleLang, getLang, onLangChange,
} from './i18n.js';
import {
  mountFilters, setCats, setHideFound, hideFound, onFilterChange, visibleMarkers,
} from './filters.js';
import { mountLayers, focusMarker } from './layers.js';
import { mountSearch } from './search.js';
import { initPermalink, requestedMarkerId } from './permalink.js';
import { mountEditor, isEditorEnabled } from './editor.js';
import {
  foundCount, resetProgress, onProgressChange, exportProgress, importProgress,
} from './progress.js';

const $ = (sel) => document.querySelector(sel);

// ------------------------------------------------------------------ theme

function initTheme() {
  const saved = localStorage.getItem(STORAGE.theme);
  const initial = saved ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = initial;

  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE.theme, next);
  });
}

// -------------------------------------------------------------- chrome

function initChrome() {
  const langBtn = $('#lang-toggle');
  const syncLangBtn = () => (langBtn.textContent = t('lang.toggle'));
  langBtn.addEventListener('click', toggleLang);
  onLangChange(syncLangBtn);
  syncLangBtn();

  $('#sidebar-toggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  $('#sidebar-close').addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });

  $('#filter-all').addEventListener('click', () => setCats(ORDERED_CAT_IDS));
  $('#filter-none').addEventListener('click', () => setCats([]));

  const hideBox = $('#hide-found');
  hideBox.checked = hideFound();
  hideBox.addEventListener('change', () => setHideFound(hideBox.checked));
}

// ------------------------------------------------------------- progress

function initProgress() {
  const bar = $('#progress-bar');
  const label = $('#progress-count');

  const update = () => {
    const total = allMarkers().length;
    const found = Math.min(foundCount(), total);
    label.textContent = t('progress.count', { found, total });
    bar.style.setProperty('--pct', total ? `${(found / total) * 100}%` : '0%');
  };

  $('#progress-reset').addEventListener('click', () => {
    if (confirm(t('progress.resetConfirm'))) resetProgress();
  });

  $('#progress-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grw-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#progress-import').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      importProgress(await file.text());
    } catch (err) {
      console.error(err);
      alert(t('editor.importFailed'));
    }
  });

  onProgressChange(update);
  onDataChange(update);
  onLangChange(update);
  update();
}

// ---------------------------------------------------------- empty state

function initEmptyState() {
  const el = $('#empty');
  const update = () => {
    el.hidden = allMarkers().length > 0 && visibleMarkers().length > 0;
    el.classList.toggle('empty--filtered', allMarkers().length > 0);
  };
  onDataChange(update);
  onFilterChange(update);
  update();
}

// ------------------------------------------------------------------ boot

async function boot() {
  initTheme();
  applyStatic();

  try {
    await loadData();
  } catch (err) {
    console.error(err);
    $('#fatal').hidden = false;
    $('#fatal').textContent = `Could not load data/: ${err.message}`;
    return;
  }

  // Make it impossible to forget that this build carries private data.
  $('#data-source').hidden = markerSource() !== 'local';

  const editorOn = isEditorEnabled();
  document.body.classList.toggle('editing', editorOn);
  const hooks = editorOn ? mountEditor($('#editor')) : {};

  initChrome();
  mountFilters($('#filter-tree'), $('#region-select'));
  mountLayers({ editable: editorOn, ...hooks });
  mountSearch($('#search-input'), $('#search-results'), $('#search-clear'));
  initProgress();
  initEmptyState();

  initPermalink({ onMarkerRequest: (id) => focusMarker(id) });
  const wanted = requestedMarkerId();
  if (wanted) setTimeout(() => focusMarker(wanted), 150);

  document.documentElement.dataset.lang = getLang();
  onLangChange((l) => (document.documentElement.dataset.lang = l));
}

boot();
