/**
 * results.js
 * Loaded only on results.html. Fetches results.json + config, renders a
 * filterable/searchable/sortable/paginated list. Filters persist to
 * localStorage and sync to the URL, so both reloading and sharing a
 * link reproduce the same view.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";
import { makeLookup } from "./data-helpers.js";
import { actionButtonsHtml, bindItemActions } from "./item-actions.js";

const STORAGE_KEY = "trackly:filters:results";
const PAGE_SIZE = 6;

let STATE = { results: [], lookup: null, page: 1 };

async function init() {
  bindRetry();
  await loadAndRender();
}

async function loadAndRender() {
  qs("[data-load-error]")?.setAttribute("hidden", "");
  qs("[data-loading]")?.removeAttribute("hidden");
  qs("[data-results-content]")?.setAttribute("hidden", "");

  const [resultsData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/results.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!resultsData || !institutesData || !trackersData) {
    qs("[data-loading]")?.setAttribute("hidden", "");
    qs("[data-load-error]")?.removeAttribute("hidden");
    return;
  }

  STATE.results = resultsData.results;
  STATE.lookup = makeLookup(institutesData.institutes, trackersData.trackerTypes);

  populateInstituteFilter(institutesData.institutes);
  populateYearFilter();
  restoreFilters();
  bindEvents();
  bindItemActions(qs("[data-results-list]"));
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-results-content]")?.removeAttribute("hidden");
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

function populateYearFilter() {
  const select = qs("[data-filter-year]");
  if (!select) return;
  const years = [...new Set(STATE.results.map((r) => r.year))].sort((a, b) => b - a);
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = String(year);
    select.appendChild(opt);
  });
}

function currentFilters() {
  return {
    q: qs("[data-search-input]")?.value || "",
    institute: qs("[data-filter-institute]")?.value || "",
    tracker: qs("[data-filter-tracker]")?.value || "",
    year: qs("[data-filter-year]")?.value || "",
    sort: qs("[data-sort]")?.value || "newest",
  };
}

function applyFiltersToForm(filters) {
  if (qs("[data-search-input]")) qs("[data-search-input]").value = filters.q || "";
  if (filters.institute) qs("[data-filter-institute]").value = filters.institute;
  if (filters.tracker) qs("[data-filter-tracker]").value = filters.tracker;
  if (filters.year) qs("[data-filter-year]").value = filters.year;
  if (filters.sort) qs("[data-sort]").value = filters.sort;
}

function restoreFilters() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = {
    q: params.get("q"), institute: params.get("org"), tracker: params.get("tracker"),
    year: params.get("year"), sort: params.get("sort"),
  };
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
  applyFiltersToForm(filters);
}

function persistFilters() {
  const filters = currentFilters();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }

  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.institute) params.set("org", filters.institute);
  if (filters.tracker) params.set("tracker", filters.tracker);
  if (filters.year) params.set("year", filters.year);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
}

function bindEvents() {
  ["data-search-input", "data-filter-institute", "data-filter-tracker", "data-filter-year", "data-sort"].forEach((attr) => {
    const el = qs(`[${attr}]`);
    if (!el) return;
    el.addEventListener(attr === "data-search-input" ? "input" : "change", () => {
      STATE.page = 1;
      persistFilters();
      render();
    });
  });

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    qsa("[data-filter-institute], [data-filter-tracker], [data-filter-year]").forEach((el) => (el.value = ""));
    if (qs("[data-search-input]")) qs("[data-search-input]").value = "";
    if (qs("[data-sort]")) qs("[data-sort]").value = "newest";
    STATE.page = 1;
    persistFilters();
    render();
  });
}

function getFilteredResults() {
  const { q, institute, tracker, year, sort } = currentFilters();
  const query = q.trim().toLowerCase();

  let list = STATE.results.filter((r) => {
    if (institute && r.instituteId !== institute) return false;
    if (tracker && r.trackerId !== tracker) return false;
    if (year && String(r.year) !== year) return false;
    if (query) {
      const haystack = `${r.title} ${STATE.lookup.instituteName(r.instituteId)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    const av = a.releasedDate || "0000-00-00";
    const bv = b.releasedDate || "0000-00-00";
    return sort === "oldest" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  return list;
}

function resultCard(r) {
  const badge = r.status === "released"
    ? `<span class="badge badge-released">Released ${r.releasedDate}</span>`
    : `<span class="badge badge-pending">Not yet released</span>`;

  const item = {
    id: `result:${r.id}`, type: "result", title: r.title,
    meta: `${STATE.lookup.instituteName(r.instituteId)} · ${r.year}`,
    url: `results.html?org=${r.instituteId}&tracker=${r.trackerId}&year=${r.year}`,
  };

  return `
    <div class="card card-status">
      <div>
        <h3 class="card-title">${r.title}</h3>
        <p class="text-caption mt-1">${STATE.lookup.instituteName(r.instituteId)} · ${STATE.lookup.trackerLabel(r.trackerId)} · ${r.year}</p>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        ${badge}
        <a class="link text-small" href="${r.officialUrl}" target="_blank" rel="noopener noreferrer">Official source</a>
        ${actionButtonsHtml(item)}
      </div>
    </div>`;
}

function paginationHtml(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (totalPages <= 1) return "";
  let buttons = "";
  for (let p = 1; p <= totalPages; p++) {
    buttons += `<button class="pagination__page" type="button" data-page="${p}" ${p === STATE.page ? 'aria-current="page"' : ""}>${p}</button>`;
  }
  return `<nav class="pagination" aria-label="Results pages">${buttons}</nav>`;
}

function render() {
  const list = qs("[data-results-list]");
  const emptyState = qs("[data-results-empty]");
  const countEl = qs("[data-results-count]");
  const paginationEl = qs("[data-results-pagination]");
  if (!list) return;

  const filtered = getFilteredResults();
  if (countEl) countEl.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    list.innerHTML = "";
    if (paginationEl) paginationEl.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }
  emptyState?.setAttribute("hidden", "");

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  STATE.page = Math.min(STATE.page, totalPages);
  const start = (STATE.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  list.innerHTML = pageItems.map(resultCard).join("");

  if (paginationEl) {
    paginationEl.innerHTML = paginationHtml(filtered.length);
    qsa("[data-page]", paginationEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        STATE.page = Number(btn.dataset.page);
        render();
        list.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
}

onReady(init);
