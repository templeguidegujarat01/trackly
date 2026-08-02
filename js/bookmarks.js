/**
 * bookmarks.js
 * One shared localStorage-backed bookmark engine. Every bookmarkable
 * thing (institute, tracker, result, notification, important date) is
 * stored with the same shape, so bookmarks.html can render all of them
 * without type-specific logic.
 */

const STORAGE_KEY = "trackly:bookmarks";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* localStorage unavailable (private mode, quota) — fail silently */
  }
}

/** id must be globally unique per item, e.g. "result:res_icai_final_nov25" */
export function isBookmarked(id) {
  return readAll().some((b) => b.id === id);
}

export function getAllBookmarks() {
  return readAll();
}

/** item: { id, type, title, meta, url } */
export function addBookmark(item) {
  const items = readAll();
  if (items.some((b) => b.id === item.id)) return;
  items.unshift({ ...item, addedAt: new Date().toISOString() });
  writeAll(items);
}

export function removeBookmark(id) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function toggleBookmark(item) {
  if (isBookmarked(item.id)) {
    removeBookmark(item.id);
    return false;
  }
  addBookmark(item);
  return true;
}

export function clearAllBookmarks() {
  writeAll([]);
}
