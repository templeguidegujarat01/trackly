/**
 * notifications.js
 * Loaded only on notifications.html. Same fetch/filter/persist pattern
 * as results.js, plus read/unread tracking (localStorage) and a
 * "mark all read" action.
 */

import { qs, qsa, onReady, loadJSON, debounce } from "./utils.js";
import { makeLookup } from "./data-helpers.js";
import { actionButtonsHtml, bindItemActions } from "./item-actions.js";

const STORAGE_KEY = "trackly:filters:notifications";
const READ_KEY = "trackly:notifications:read";

let STATE = { notifications: [], lookup: null };

function getReadIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function setReadIds(ids) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function markRead(id) {
  const ids = getReadIds();
  ids.add(id);
  setReadIds(ids);
}

async function init() {
  bindRetry();
  await loadAndRender();
}

async function loadAndRender() {
  qs("[data-load-error]")?.setAttribute("hidden", "");
  qs("[data-loading]")?.removeAttribute("hidden");
  qs("[data-notifications-content]")?.setAttribute("hidden", "");

  const [notificationsData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/notifications.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!notificationsData || !institutesData || !trackersData) {
    qs("[data-loading]")?.setAttribute("hidden", "");
    qs("[data-load-error]")?.removeAttribute("hidden");
    return;
  }

  STATE.notifications = notificationsData.notifications;
  STATE.lookup = makeLookup(institutesData.institutes, trackersData.trackerTypes);

  populateInstituteFilter(institutesData.institutes);
  restoreFilters();
  bindEvents();
  bindItemActions(qs("[data-notifications-list]"));
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-notifications-content]")?.removeAttribute("hidden");
}

function bindRetry() {
  qs("[data-retry]")?.addEventListener("click", loadAndRender);
}

function populateInstituteFilter(institutes) {
  const select = qs("[data-filter-institute]");
  if (!select) return;
  institutes.forEach((inst) => {
    const opt = document.createElement("option");
    opt.value = inst.id;
    opt.textContent = inst.name;
    select.appendChild(opt);
  });
}

function currentFilters() {
  return {
    q: qs("[data-search-input]")?.value || "",
    institute: qs("[data-filter-institute]")?.value || "",
    unreadOnly: qs("[data-filter-unread]")?.checked || false,
  };
}

function restoreFilters() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = { q: params.get("q"), institute: params.get("org") };
  const hasUrlFilters = Object.values(fromUrl).some(Boolean);

  let filters = {};
  if (hasUrlFilters) {
    filters = fromUrl;
  } else {
    try {
      filters = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      filters = {};
    }
  }
  if (qs("[data-search-input]") && filters.q) qs("[data-search-input]").value = filters.q;
  if (filters.institute) qs("[data-filter-institute]").value = filters.institute;
}

function persistFilters() {
  const filters = currentFilters();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams();
  if (filters.institute) params.set("org", filters.institute);
  if (filters.q) params.set("q", filters.q);
  const query = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
}

function bindEvents() {
  qs("[data-filter-institute]")?.addEventListener("change", () => {
    persistFilters();
    render();
  });

  qs("[data-search-input]")?.addEventListener("input", debounce(() => {
    persistFilters();
    render();
  }, 150));

  qs("[data-filter-unread]")?.addEventListener("change", render);

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    const instituteEl = qs("[data-filter-institute]");
    const searchEl = qs("[data-search-input]");
    const unreadEl = qs("[data-filter-unread]");
    if (instituteEl) instituteEl.value = "";
    if (searchEl) searchEl.value = "";
    if (unreadEl) unreadEl.checked = false;
    persistFilters();
    render();
  });

  qs("[data-mark-all-read]")?.addEventListener("click", () => {
    const ids = getReadIds();
    STATE.notifications.forEach((n) => ids.add(n.id));
    setReadIds(ids);
    render();
  });
}

function getFiltered() {
  const { q, institute, unreadOnly } = currentFilters();
  const query = q.trim().toLowerCase();
  const readIds = getReadIds();

  return STATE.notifications.filter((n) => {
    if (institute && n.instituteId !== institute) return false;
    if (unreadOnly && readIds.has(n.id)) return false;
    if (query) {
      const haystack = `${n.title} ${n.summary} ${STATE.lookup.instituteName(n.instituteId)} ${STATE.lookup.trackerLabel(n.trackerId)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function notificationCard(n) {
  const readIds = getReadIds();
  const isRead = readIds.has(n.id);

  const item = {
    id: `notification:${n.id}`, type: "notification", title: n.title,
    meta: `${STATE.lookup.instituteName(n.instituteId)} · ${n.publishedDate}`,
    url: `notifications.html?org=${n.instituteId}`,
  };

  return `
    <div class="card card-notification" data-notification-id="${n.id}" style="${isRead ? "" : "border-left: 3px solid var(--color-primary);"}">
      <div class="card-feature__icon" aria-hidden="true" style="margin-bottom:0;">
        <svg class="icon"><use href="assets/icons/icons.svg#icon-bell"></use></svg>
      </div>
      <div style="flex:1;">
        <div class="flex flex-between" style="align-items:flex-start;">
          <h3 class="card-title">${n.title}</h3>
          ${isRead ? "" : '<span class="badge badge-tracked" style="flex-shrink:0;">New</span>'}
        </div>
        <p class="text-small text-muted mt-1">${n.summary}</p>
        <p class="text-caption mt-2">${STATE.lookup.instituteName(n.instituteId)} · ${STATE.lookup.trackerLabel(n.trackerId)} · ${n.publishedDate}</p>
        <div class="flex flex-between mt-2" style="align-items:center;">
          <a class="link text-small" href="${n.officialUrl}" target="_blank" rel="noopener noreferrer" data-mark-read-link="${n.id}">Official source</a>
          ${actionButtonsHtml(item)}
        </div>
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-notifications-list]");
  const emptyState = qs("[data-notifications-empty]");
  const countEl = qs("[data-notifications-count]");
  if (!list) return;

  const filtered = getFiltered().sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  if (countEl) countEl.textContent = `${filtered.length} notification${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }
  emptyState?.setAttribute("hidden", "");
  list.innerHTML = filtered.map(notificationCard).join("");

  qsa("[data-mark-read-link]", list).forEach((link) => {
    link.addEventListener("click", () => {
      markRead(link.dataset.markReadLink);
    });
  });
}

onReady(init);
