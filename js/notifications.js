/**
 * notifications.js
 * Loaded only on notifications.html. Same fetch-and-render pattern as
 * results.js, with a text search added on top of the institute/tracker
 * filters.
 */

import { qs, qsa, onReady, loadJSON, debounce } from "./utils.js";

let STATE = { notifications: [], institutes: [], trackers: [] };

async function init() {
  const [notificationsData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/notifications.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!notificationsData || !institutesData || !trackersData) {
    showLoadError();
    return;
  }

  STATE.notifications = notificationsData.notifications;
  STATE.institutes = institutesData.institutes;
  STATE.trackers = trackersData.trackerTypes;

  populateInstituteFilter();
  applyFiltersFromUrl();
  bindFilterEvents();
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-notifications-content]")?.removeAttribute("hidden");
}

function showLoadError() {
  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-load-error]")?.removeAttribute("hidden");
}

function instituteName(id) {
  return STATE.institutes.find((i) => i.id === id)?.name || id;
}

function trackerLabel(id) {
  return STATE.trackers.find((t) => t.id === id)?.label || id;
}

function populateInstituteFilter() {
  const select = qs("[data-filter-institute]");
  if (!select) return;
  STATE.institutes.forEach((inst) => {
    const opt = document.createElement("option");
    opt.value = inst.id;
    opt.textContent = inst.name;
    select.appendChild(opt);
  });
}

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get("org");
  const q = params.get("q");

  if (org) {
    const el = qs("[data-filter-institute]");
    if (el) el.value = org;
  }
  if (q) {
    const el = qs("[data-search-input]");
    if (el) el.value = q;
  }
}

function updateUrl() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const query = qs("[data-search-input]")?.value || "";

  const params = new URLSearchParams();
  if (institute) params.set("org", institute);
  if (query) params.set("q", query);

  const qs2 = params.toString();
  const newUrl = window.location.pathname + (qs2 ? `?${qs2}` : "");
  window.history.replaceState({}, "", newUrl);
}

function bindFilterEvents() {
  qs("[data-filter-institute]")?.addEventListener("change", () => {
    updateUrl();
    render();
  });

  const searchHandler = debounce(() => {
    updateUrl();
    render();
  }, 150);
  qs("[data-search-input]")?.addEventListener("input", searchHandler);

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    const instituteEl = qs("[data-filter-institute]");
    const searchEl = qs("[data-search-input]");
    if (instituteEl) instituteEl.value = "";
    if (searchEl) searchEl.value = "";
    updateUrl();
    render();
  });
}

function getFiltered() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const query = (qs("[data-search-input]")?.value || "").trim().toLowerCase();

  return STATE.notifications.filter((n) => {
    if (institute && n.instituteId !== institute) return false;
    if (query) {
      const haystack = `${n.title} ${n.summary} ${instituteName(n.instituteId)} ${trackerLabel(n.trackerId)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function notificationCard(n) {
  return `
    <div class="card card-notification">
      <div class="card-feature__icon" aria-hidden="true" style="margin-bottom:0;">
        <svg class="icon"><use href="assets/icons/icons.svg#icon-bell"></use></svg>
      </div>
      <div>
        <h3 class="card-title">${n.title}</h3>
        <p class="text-small text-muted mt-1">${n.summary}</p>
        <p class="text-caption mt-2">${instituteName(n.instituteId)} · ${trackerLabel(n.trackerId)} · ${n.publishedDate}</p>
        <a class="link text-small mt-2" style="display:inline-block;" href="${n.officialUrl}" target="_blank" rel="noopener noreferrer">Official source</a>
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-notifications-list]");
  const emptyState = qs("[data-notifications-empty]");
  const countEl = qs("[data-notifications-count]");
  if (!list) return;

  const filtered = getFiltered().sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  if (countEl) {
    countEl.textContent = `${filtered.length} notification${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }

  emptyState?.setAttribute("hidden", "");
  list.innerHTML = filtered.map(notificationCard).join("");
}

onReady(init);
