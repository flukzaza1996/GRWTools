// "I already picked this one up" state. Lives entirely in the browser, keyed by
// marker id, so it survives dataset updates as long as ids stay stable.

import { STORAGE } from './config.js';

const listeners = new Set();
let found = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.found) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function save() {
  localStorage.setItem(STORAGE.found, JSON.stringify([...found]));
  listeners.forEach((fn) => fn());
}

export function onProgressChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isFound = (id) => found.has(id);
export const foundCount = () => found.size;

export function setFound(id, value) {
  if (value) found.add(id);
  else found.delete(id);
  save();
}

export const toggleFound = (id) => setFound(id, !found.has(id));

export function resetProgress() {
  found = new Set();
  save();
}

/** Found tally restricted to a set of marker ids — used for per-category counts. */
export function countFoundIn(markers) {
  let n = 0;
  for (const m of markers) if (found.has(m.id)) n++;
  return n;
}

export const exportProgress = () =>
  JSON.stringify({ version: 1, found: [...found] }, null, 2) + '\n';

export function importProgress(text) {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed?.found;
  if (!Array.isArray(list)) throw new Error('unrecognised progress file');
  found = new Set(list.filter((id) => typeof id === 'string'));
  save();
  return found.size;
}
