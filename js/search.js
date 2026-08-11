// Cross-language search over every marker: its own name and note, the linked
// item, the category label and the province — all in Thai and English at once,
// so "ปืน", "weapon" and "Itacua" all find the same pins.

import { allMarkers, getItem, getRegion, onDataChange } from './data.js';
import { makeSwatchHtml } from './categories.js';
import { t, tIn, localized, onLangChange } from './i18n.js';
import { markerTitle } from './popup.js';
import { focusMarker } from './layers.js';

const MAX_RESULTS = 40;
const MIN_QUERY = 2;
const SEP = '\n';

let index = [];
let resultsEl = null;
let inputEl = null;

const norm = (s) => String(s ?? '').toLowerCase().trim();

// Category labels are the one bit of searchable text that lives in the
// dictionary rather than on the record, so index both languages explicitly.
const bothLangs = (key) => `${tIn('en', key)} ${tIn('th', key)}`;

function build() {
  index = allMarkers().map((m) => {
    const item = m.item ? getItem(m.item) : null;
    const region = getRegion(m.region);
    const haystack = [
      m.name.en, m.name.th,
      m.note.en, m.note.th,
      item?.name?.en, item?.name?.th, item?.type,
      region?.name?.en, region?.name?.th,
      m.cat, m.id,
      bothLangs(`cat.${m.cat}`),
    ]
      .filter(Boolean)
      .map(norm)
      .join(SEP);
    return { marker: m, haystack };
  });
}

function score(entry, q) {
  const at = entry.haystack.indexOf(q);
  if (at < 0) return -1;
  // Matches that open a field or a word beat ones buried mid-token.
  const before = entry.haystack[at - 1];
  return at === 0 || before === SEP || before === ' ' ? 2 : 1;
}

function search(query) {
  const q = norm(query);
  if (q.length < MIN_QUERY) return null;
  const hits = [];
  for (const entry of index) {
    const s = score(entry, q);
    if (s > 0) hits.push({ entry, s });
  }
  hits.sort(
    (a, b) => b.s - a.s || markerTitle(a.entry.marker).localeCompare(markerTitle(b.entry.marker))
  );
  return hits.map((h) => h.entry.marker);
}

function renderResults(markers) {
  if (markers === null) {
    resultsEl.innerHTML = `<li class="sr sr--hint">${t('search.hint')}</li>`;
    resultsEl.hidden = inputEl.value.length === 0;
    return;
  }
  if (!markers.length) {
    resultsEl.innerHTML = `<li class="sr sr--hint">${t('search.empty')}</li>`;
    resultsEl.hidden = false;
    return;
  }

  const shown = markers.slice(0, MAX_RESULTS);
  const rest = markers.length - shown.length;
  resultsEl.innerHTML =
    `<li class="sr sr--count">${t('search.results', { n: markers.length })}</li>` +
    shown
      .map((m) => {
        const region = getRegion(m.region);
        return `
          <li>
            <button type="button" class="sr sr--hit" data-goto="${m.id}">
              ${makeSwatchHtml(m.cat)}
              <span class="sr__text">
                <span class="sr__title">${markerTitle(m)}</span>
                <span class="sr__sub">${t(`cat.${m.cat}`)}${region ? ` · ${localized(region.name)}` : ''}</span>
              </span>
            </button>
          </li>`;
      })
      .join('') +
    (rest > 0 ? `<li class="sr sr--hint">${t('search.more', { n: rest })}</li>` : '');
  resultsEl.hidden = false;
}

export function mountSearch(input, results, clearButton) {
  inputEl = input;
  resultsEl = results;

  const run = () => renderResults(search(inputEl.value));

  inputEl.addEventListener('input', run);
  inputEl.addEventListener('focus', run);

  clearButton?.addEventListener('click', () => {
    inputEl.value = '';
    resultsEl.hidden = true;
    inputEl.focus();
  });

  resultsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-goto]');
    if (!btn) return;
    focusMarker(btn.dataset.goto);
    resultsEl.hidden = true;
    document.body.classList.remove('sidebar-open');
  });

  document.addEventListener('click', (ev) => {
    if (!resultsEl.hidden && !ev.target.closest('.search')) resultsEl.hidden = true;
  });

  inputEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      inputEl.value = '';
      resultsEl.hidden = true;
    }
    if (ev.key === 'Enter') {
      const first = resultsEl.querySelector('[data-goto]');
      if (first) first.click();
    }
  });

  onDataChange(() => {
    build();
    if (!resultsEl.hidden) run();
  });
  onLangChange(() => {
    build();
    if (!resultsEl.hidden) run();
  });

  build();
}
