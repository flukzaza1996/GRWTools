// Which markers are on screen right now, and the sidebar controls that decide.

import { STORAGE } from './config.js';
import { GROUPS, CATS, ORDERED_CAT_IDS, makeSwatchHtml } from './categories.js';
import { allMarkers, allRegions, onDataChange } from './data.js';
import { isFound, onProgressChange } from './progress.js';
import { t, localized, onLangChange, applyStatic } from './i18n.js';

const listeners = new Set();

const state = {
  cats: new Set(ORDERED_CAT_IDS),
  region: '',
  hideFound: false,
};

restore();

// What gets persisted is the set the user switched OFF, not the set left on.
// Storing it the other way round would hide every category added after the
// visitor's last session, since it could not have been in their saved list.
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.filters) ?? 'null');
    if (!saved) return;
    if (Array.isArray(saved.off)) {
      const off = new Set(saved.off);
      state.cats = new Set(ORDERED_CAT_IDS.filter((c) => !off.has(c)));
    } else if (Array.isArray(saved.cats)) {
      state.cats = new Set(saved.cats.filter((c) => CATS[c])); // pre-`off` format
    }
    if (typeof saved.region === 'string') state.region = saved.region;
    if (typeof saved.hideFound === 'boolean') state.hideFound = saved.hideFound;
  } catch {
    /* keep defaults */
  }
}

function persist() {
  localStorage.setItem(
    STORAGE.filters,
    JSON.stringify({
      off: ORDERED_CAT_IDS.filter((c) => !state.cats.has(c)),
      region: state.region,
      hideFound: state.hideFound,
    })
  );
}

function emit() {
  persist();
  listeners.forEach((fn) => fn());
}

export function onFilterChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ------------------------------------------------------------------- state

export const activeCats = () => new Set(state.cats);
export const activeRegion = () => state.region;
export const hideFound = () => state.hideFound;

export function setCatActive(cat, on) {
  if (on) state.cats.add(cat);
  else state.cats.delete(cat);
  emit();
}

export function setCats(cats) {
  state.cats = new Set(cats.filter((c) => CATS[c]));
  emit();
}

export function setRegion(region) {
  state.region = region ?? '';
  emit();
}

export function setHideFound(on) {
  state.hideFound = !!on;
  emit();
}

/** The single predicate every renderer uses. */
export function isVisible(marker) {
  if (!state.cats.has(marker.cat)) return false;
  if (state.region && marker.region !== state.region) return false;
  if (state.hideFound && isFound(marker.id)) return false;
  return true;
}

export const visibleMarkers = () => allMarkers().filter(isVisible);

// ---------------------------------------------------------------- sidebar

let treeEl = null;
let regionEl = null;

/** Build the category tree once; counts are refreshed by update(). */
export function mountFilters(treeContainer, regionSelect) {
  treeEl = treeContainer;
  regionEl = regionSelect;

  treeEl.innerHTML = GROUPS.map(
    (g) => `
      <section class="fgroup" data-group="${g.id}">
        <header class="fgroup__head">
          <input type="checkbox" class="fgroup__box" data-group-box="${g.id}" />
          <h3 data-i18n="group.${g.id}"></h3>
          <span class="fgroup__count" data-group-count="${g.id}"></span>
        </header>
        <ul class="fgroup__list">
          ${g.cats
            .map(
              (c) => `
            <li class="frow">
              <label class="frow__label">
                <input type="checkbox" class="frow__box" data-cat="${c}" />
                ${makeSwatchHtml(c)}
                <span class="frow__name" data-i18n="cat.${c}"></span>
              </label>
              <span class="frow__count" data-cat-count="${c}"></span>
            </li>`
            )
            .join('')}
        </ul>
      </section>`
  ).join('');

  treeEl.addEventListener('change', (ev) => {
    const catBox = ev.target.closest('[data-cat]');
    if (catBox) {
      setCatActive(catBox.dataset.cat, catBox.checked);
      return;
    }
    const groupBox = ev.target.closest('[data-group-box]');
    if (groupBox) {
      const group = GROUPS.find((g) => g.id === groupBox.dataset.groupBox);
      const next = new Set(state.cats);
      group.cats.forEach((c) => (groupBox.checked ? next.add(c) : next.delete(c)));
      setCats([...next]);
    }
  });

  regionEl.addEventListener('change', () => setRegion(regionEl.value));

  onDataChange(update);
  onProgressChange(update);
  onFilterChange(update);
  onLangChange(() => {
    applyStatic(treeEl);
    renderRegionOptions();
    update();
  });

  // The tree is built after boot's applyStatic() pass, so label it here.
  applyStatic(treeEl);
  renderRegionOptions();
  update();
}

function renderRegionOptions() {
  if (!regionEl) return;
  const current = state.region;
  regionEl.innerHTML =
    `<option value="">${t('region.all')}</option>` +
    allRegions()
      .map((r) => `<option value="${r.id}">${localized(r.name)}</option>`)
      .join('');
  regionEl.value = current;
}

/** Refresh checkbox states and the "found / total" counters. */
export function update() {
  if (!treeEl) return;

  const perCat = Object.create(null);
  for (const m of allMarkers()) {
    const bucket = (perCat[m.cat] ??= { total: 0, found: 0 });
    if (state.region && m.region !== state.region) continue;
    bucket.total++;
    if (isFound(m.id)) bucket.found++;
  }

  for (const cat of ORDERED_CAT_IDS) {
    const box = treeEl.querySelector(`[data-cat="${cat}"]`);
    if (box) box.checked = state.cats.has(cat);

    const { total = 0, found = 0 } = perCat[cat] ?? {};
    const label = treeEl.querySelector(`[data-cat-count="${cat}"]`);
    if (label) {
      label.textContent = total ? `${found}/${total}` : '0';
      label.classList.toggle('is-empty', total === 0);
      label.classList.toggle('is-complete', total > 0 && found === total);
    }
  }

  for (const g of GROUPS) {
    const box = treeEl.querySelector(`[data-group-box="${g.id}"]`);
    if (box) {
      const on = g.cats.filter((c) => state.cats.has(c)).length;
      box.checked = on === g.cats.length;
      box.indeterminate = on > 0 && on < g.cats.length;
    }
    const totals = g.cats.reduce(
      (acc, c) => {
        acc.total += perCat[c]?.total ?? 0;
        acc.found += perCat[c]?.found ?? 0;
        return acc;
      },
      { total: 0, found: 0 }
    );
    const count = treeEl.querySelector(`[data-group-count="${g.id}"]`);
    if (count) count.textContent = totals.total ? `${totals.found}/${totals.total}` : '';
  }

  if (regionEl && regionEl.value !== state.region) regionEl.value = state.region;
}
