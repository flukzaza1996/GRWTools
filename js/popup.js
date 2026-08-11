// Marker popups and the full-size image viewer they open.

import { makeSwatchHtml, categoryPhoto } from './categories.js';
import { getItem, getRegion } from './data.js';
import { isFound, setFound } from './progress.js';
import { t, localized } from './i18n.js';
import { markerPermalink } from './permalink.js';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Bare filenames are assumed to live in assets/items/. */
export const imagePath = (src) => (src.includes('/') ? src : `assets/items/${src}`);

/** Display name: the marker's own name, else the linked item's, else the type. */
export function markerTitle(marker) {
  const own = localized(marker.name);
  if (own) return own;
  const item = marker.item && getItem(marker.item);
  if (item) {
    const fromItem = localized(item.name);
    if (fromItem) return fromItem;
  }
  return t(`cat.${marker.cat}`);
}

/** Every image for a marker: its own, plus the linked item's picture. */
export function markerImages(marker) {
  const list = [...marker.images];
  const item = marker.item && getItem(marker.item);
  if (item?.image && !list.includes(item.image)) list.push(item.image);
  return list.map(imagePath);
}

// Ubisoft only ever rendered the attachments sold in Ghost Packs, so most
// scopes, magazines and grips have no picture anywhere. These are our own
// drawings of each kind of part — not the exact model, but they say at a glance
// what sort of thing the case holds.
const PART_TYPE_ART = new Set([
  'Scope', 'Magazine', 'Muzzle', 'Barrel', 'Stock', 'Rail', 'Underbarrel', 'Gadget',
]);

function partTypeArt(marker) {
  const item = marker.item && getItem(marker.item);
  const type = item?.type;
  return type && PART_TYPE_ART.has(type) ? `assets/parttypes/${type.toLowerCase()}.svg` : '';
}

/**
 * What to show when a marker has no picture of its own: a drawing of the kind
 * of part it holds, else the category's in-game map icon, else an apology.
 */
export function fallbackHtml(marker) {
  const art = partTypeArt(marker) || categoryPhoto(marker.cat);
  return art
    ? `<div class="pop__iconcard"><img src="${escapeHtml(art)}" alt="" data-fallback-art /></div>`
    : `<p class="pop__noimage">${t('popup.noImage')}</p>`;
}

/**
 * assets/icons/ is rebuilt rather than committed, so a fresh clone can be
 * missing it. Without this the popup would show a torn-image glyph instead of
 * saying, honestly, that there is no picture.
 */
function guardFallbackArt(scope) {
  scope.querySelectorAll('[data-fallback-art]').forEach((img) => {
    const swap = () => {
      const card = img.closest('.pop__iconcard') ?? img;
      const p = document.createElement('p');
      p.className = 'pop__noimage';
      p.textContent = t('popup.noImage');
      card.replaceWith(p);
    };
    img.addEventListener('error', swap);
    // A cached 404 can finish before the listener is attached.
    if (img.complete && img.naturalWidth === 0) swap();
  });
}

export function popupHtml(marker, { editable = false } = {}) {
  const region = getRegion(marker.region);
  const note = localized(marker.note);
  const images = markerImages(marker);

  const gallery = images.length
    ? `<div class="pop__gallery">${images
        .map(
          (src, i) =>
            `<img class="pop__thumb" src="${escapeHtml(src)}" alt="" loading="lazy"
                  data-lightbox="${escapeHtml(src)}" data-index="${i}"
                  onerror="this.classList.add('is-missing')" />`
        )
        .join('')}</div>`
    : fallbackHtml(marker);

  return `
    <div class="pop" data-marker="${escapeHtml(marker.id)}">
      <div class="pop__head">
        ${makeSwatchHtml(marker.cat)}
        <div>
          <h4 class="pop__title">${escapeHtml(markerTitle(marker))}</h4>
          <p class="pop__meta">
            ${escapeHtml(t(`cat.${marker.cat}`))}
            ${region ? ` · ${escapeHtml(localized(region.name))}` : ''}
          </p>
        </div>
      </div>
      ${gallery}
      ${note ? `<p class="pop__note">${escapeHtml(note)}</p>` : ''}
      <p class="pop__coords">${t('popup.coords')} ${marker.x}, ${marker.y}</p>
      <div class="pop__actions">
        <label class="pop__found">
          <input type="checkbox" data-found ${isFound(marker.id) ? 'checked' : ''} />
          <span>${t('popup.found')}</span>
        </label>
        <button type="button" class="btn btn--ghost" data-copy>${t('popup.copyLink')}</button>
        ${editable ? `<button type="button" class="btn btn--ghost" data-edit>${t('popup.edit')}</button>` : ''}
      </div>
    </div>`;
}

/**
 * Wire up a popup's controls. `onEdit` is only called when the editor is live.
 */
export function bindPopup(root, marker, { onEdit } = {}) {
  root.querySelector('[data-found]')?.addEventListener('change', (ev) => {
    setFound(marker.id, ev.target.checked);
  });

  root.querySelector('[data-copy]')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    try {
      await navigator.clipboard.writeText(markerPermalink(marker));
      btn.textContent = t('popup.copied');
      setTimeout(() => (btn.textContent = t('popup.copyLink')), 1500);
    } catch {
      window.prompt(t('popup.copyLink'), markerPermalink(marker));
    }
  });

  root.querySelector('[data-edit]')?.addEventListener('click', () => onEdit?.(marker));

  root.querySelectorAll('[data-lightbox]').forEach((img) => {
    img.addEventListener('click', () => openLightbox(markerImages(marker), Number(img.dataset.index) || 0));
  });

  // Catalogue entries name a picture before anyone has dropped the file in, so
  // a gallery whose images all 404 should read as "no image yet", not as a gap.
  guardFallbackArt(root);

  const gallery = root.querySelector('.pop__gallery');
  if (gallery) {
    const collapseIfEmpty = () => {
      if (gallery.querySelector('.pop__thumb:not(.is-missing)')) return;
      const holder = document.createElement('div');
      holder.innerHTML = fallbackHtml(marker);
      const replacement = holder.firstElementChild;
      gallery.replaceWith(replacement);
      guardFallbackArt(replacement);
    };
    gallery.querySelectorAll('img').forEach((img) => img.addEventListener('error', collapseIfEmpty));
  }
}

// ------------------------------------------------------------- lightbox

let lightbox = null;
let shots = [];
let at = 0;

function ensureLightbox() {
  if (lightbox) return lightbox;
  lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.hidden = true;
  lightbox.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="close">&times;</button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="previous">&#8249;</button>
    <img class="lightbox__img" alt="" />
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="next">&#8250;</button>`;
  document.body.append(lightbox);

  lightbox.addEventListener('click', (ev) => {
    if (ev.target === lightbox || ev.target.closest('.lightbox__close')) closeLightbox();
    else if (ev.target.closest('.lightbox__nav--prev')) step(-1);
    else if (ev.target.closest('.lightbox__nav--next')) step(1);
  });

  document.addEventListener('keydown', (ev) => {
    if (lightbox.hidden) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowLeft') step(-1);
    if (ev.key === 'ArrowRight') step(1);
  });

  return lightbox;
}

function step(delta) {
  if (shots.length < 2) return;
  at = (at + delta + shots.length) % shots.length;
  lightbox.querySelector('.lightbox__img').src = shots[at];
}

export function openLightbox(images, index = 0) {
  shots = images;
  at = index;
  if (!shots.length) return;
  const box = ensureLightbox();
  box.querySelector('.lightbox__img').src = shots[at];
  box.classList.toggle('lightbox--single', shots.length < 2);
  box.hidden = false;
}

export function closeLightbox() {
  if (lightbox) lightbox.hidden = true;
}
