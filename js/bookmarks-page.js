/**
 * bookmarks-page.js
 * Loaded only on bookmarks.html. Reads directly from the shared
 * bookmarks.js engine — no fetch needed, everything here is already
 * in localStorage.
 */

import { qs, qsa, onReady } from "./utils.js";
import { getAllBookmarks, removeBookmark, clearAllBookmarks } from "./bookmarks.js";
import { showToast } from "./toast.js";

const TYPE_ICON = {
  institute: "icon-shield-check",
  tracker: "icon-list",
  result: "icon-clipboard-check",
  notification: "icon-bell",
  "important-date": "icon-calendar",
};

const TYPE_LABEL = {
  institute: "Institute",
  tracker: "Tracker",
  result: "Result",
  notification: "Notification",
  "important-date": "Important Date",
};

function init() {
  populateTypeFilter();
  bindEvents();
  render();
}

function populateTypeFilter() {
  const select = qs("[data-filter-type]");
  if (!select) return;
  const types = [...new Set(getAllBookmarks().map((b) => b.type))];
  types.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = TYPE_LABEL[type] || type;
    select.appendChild(opt);
  });
}

function bindEvents() {
  qs("[data-search-input]")?.addEventListener("input", render);
  qs("[data-filter-type]")?.addEventListener("change", render);

  qs("[data-clear-all]")?.addEventListener("click", () => {
    if (getAllBookmarks().length === 0) return;
    if (!window.confirm("Remove all bookmarks? This can't be undone.")) return;
    clearAllBookmarks();
    showToast("All bookmarks removed");
    populateTypeFilter();
    render();
  });
}

function getFiltered() {
  const query = (qs("[data-search-input]")?.value || "").trim().toLowerCase();
  const type = qs("[data-filter-type]")?.value || "";

  return getAllBookmarks().filter((b) => {
    if (type && b.type !== type) return false;
    if (query && !`${b.title} ${b.meta || ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

function bookmarkCard(b) {
  const icon = TYPE_ICON[b.type] || "icon-bookmark";
  const label = TYPE_LABEL[b.type] || b.type;
  return `
    <div class="card card-status" data-bookmark-id="${b.id}">
      <div class="flex gap-4" style="align-items:flex-start;">
        <div class="card-feature__icon" aria-hidden="true" style="margin-bottom:0;">
          <svg class="icon"><use href="assets/icons/icons.svg#${icon}"></use></svg>
        </div>
        <div>
          <span class="badge badge-official mb-2" style="display:inline-block;">${label}</span>
          <h3 class="card-title">${b.title}</h3>
          <p class="text-caption mt-1">${b.meta || ""}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        <a class="link text-small" href="${b.url}">Open</a>
        <button class="btn btn-secondary btn-sm" type="button" data-remove="${b.id}">Remove</button>
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-bookmarks-list]");
  const emptyState = qs("[data-bookmarks-empty]");
  const noneAtAll = qs("[data-bookmarks-none]");
  const countEl = qs("[data-bookmarks-count]");
  if (!list) return;

  const all = getAllBookmarks();
  const filtered = getFiltered();

  if (countEl) countEl.textContent = `${all.length} saved item${all.length === 1 ? "" : "s"}`;

  if (all.length === 0) {
    list.innerHTML = "";
    emptyState?.setAttribute("hidden", "");
    noneAtAll?.removeAttribute("hidden");
    return;
  }
  noneAtAll?.setAttribute("hidden", "");

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }
  emptyState?.setAttribute("hidden", "");

  list.innerHTML = filtered.map(bookmarkCard).join("");

  qsa("[data-remove]", list).forEach((btn) => {
    btn.addEventListener("click", () => {
      removeBookmark(btn.dataset.remove);
      showToast("Removed");
      populateTypeFilter();
      render();
    });
  });
}

onReady(init);
