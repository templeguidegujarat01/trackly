/**
 * results.js
 * Loaded only on results.html, alongside app.js. Fetches results.json
 * plus the institute/tracker config, then renders a filterable list.
 * Institute/Tracker/Year filters all read from and write to the URL
 * (?org=&tracker=&year=), so a link from an institute page or the
 * homepage can deep-link straight into a pre-filtered view — the same
 * pattern track.js established in Phase 5.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";

let STATE = { results: [], institutes: [], trackers: [] };

async function init() {
  const [resultsData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/results.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!resultsData || !institutesData || !trackersData) {
    showLoadError();
    return;
  }

  STATE.results = resultsData.results;
  STATE.institutes = institutesData.institutes;
  STATE.trackers = trackersData.trackerTypes;

  populateInstituteFilter();
  populateYearFilter();
  applyFiltersFromUrl();
  bindFilterEvents();
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-results-content]")?.removeAttribute("hidden");
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

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get("org");
  const tracker = params.get("tracker");
  const year = params.get("year");

  if (org) {
    const el = qs("[data-filter-institute]");
    if (el) el.value = org;
  }
  if (tracker) {
    const el = qs("[data-filter-tracker]");
    if (el) el.value = tracker;
  }
  if (year) {
    const el = qs("[data-filter-year]");
    if (el) el.value = year;
  }
}

function updateUrl() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  const year = qs("[data-filter-year]")?.value || "";

  const params = new URLSearchParams();
  if (institute) params.set("org", institute);
  if (tracker) params.set("tracker", tracker);
  if (year) params.set("year", year);

  const query = params.toString();
  const newUrl = window.location.pathname + (query ? `?${query}` : "");
  window.history.replaceState({}, "", newUrl);
}

function bindFilterEvents() {
  ["data-filter-institute", "data-filter-tracker", "data-filter-year"].forEach((attr) => {
    qs(`[${attr}]`)?.addEventListener("change", () => {
      updateUrl();
      render();
    });
  });

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    qsa("[data-filter-institute], [data-filter-tracker], [data-filter-year]").forEach((el) => {
      el.value = "";
    });
    updateUrl();
    render();
  });
}

function getFilteredResults() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  const year = qs("[data-filter-year]")?.value || "";

  return STATE.results.filter((r) => {
    if (institute && r.instituteId !== institute) return false;
    if (tracker && r.trackerId !== tracker) return false;
    if (year && String(r.year) !== year) return false;
    return true;
  });
}

function resultCard(r) {
  const badge =
    r.status === "released"
      ? `<span class="badge badge-released">Released ${r.releasedDate}</span>`
      : `<span class="badge badge-pending">Not yet released</span>`;

  return `
    <div class="card card-status">
      <div>
        <h3 class="card-title">${r.title}</h3>
        <p class="text-caption mt-1">${instituteName(r.instituteId)} · ${trackerLabel(r.trackerId)} · ${r.year}</p>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        ${badge}
        <a class="link text-small" href="${r.officialUrl}" target="_blank" rel="noopener noreferrer">Official source</a>
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-results-list]");
  const emptyState = qs("[data-results-empty]");
  const countEl = qs("[data-results-count]");
  if (!list) return;

  const filtered = getFilteredResults();

  if (countEl) {
    countEl.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }

  emptyState?.setAttribute("hidden", "");
  list.innerHTML = filtered
    .sort((a, b) => (b.releasedDate || "9999").localeCompare(a.releasedDate || "9999"))
    .map(resultCard)
    .join("");
}

onReady(init);
