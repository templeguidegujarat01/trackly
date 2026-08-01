/**
 * important-dates.js
 * Loaded only on important-dates.html. Classifies each date into
 * Upcoming / Today / Completed by comparing data/important-dates.json's
 * "date" field against the real current date at render time — this is
 * deliberately computed, not a stored status field, so the page is
 * still correct on the day after you load it without any data change.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";

let STATE = { dates: [], institutes: [], trackers: [] };
const TABS = ["upcoming", "today", "completed"];

async function init() {
  const [datesData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/important-dates.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!datesData || !institutesData || !trackersData) {
    showLoadError();
    return;
  }

  STATE.dates = datesData.dates;
  STATE.institutes = institutesData.institutes;
  STATE.trackers = trackersData.trackerTypes;

  populateInstituteFilter();
  populateTrackerFilter();
  applyFiltersFromUrl();
  bindEvents();
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-dates-content]")?.removeAttribute("hidden");
}

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get("org");
  const tracker = params.get("tracker");

  if (org) {
    const el = qs("[data-filter-institute]");
    if (el) el.value = org;
  }
  if (tracker) {
    const el = qs("[data-filter-tracker]");
    if (el) el.value = tracker;
  }
}

function showLoadError() {
  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-load-error]")?.removeAttribute("hidden");
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function classify(dateStr) {
  const today = todayISO();
  if (dateStr === today) return "today";
  return dateStr > today ? "upcoming" : "completed";
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

function populateTrackerFilter() {
  const select = qs("[data-filter-tracker]");
  if (!select) return;
  const usedTrackerIds = [...new Set(STATE.dates.map((d) => d.trackerId))];
  STATE.trackers
    .filter((t) => usedTrackerIds.includes(t.id))
    .forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      select.appendChild(opt);
    });
}

function bindEvents() {
  qsa("[data-tab]").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      qsa("[data-tab]").forEach((b) => {
        b.setAttribute("aria-selected", "false");
        b.classList.remove("btn-primary");
        b.classList.add("btn-secondary");
      });
      tabBtn.setAttribute("aria-selected", "true");
      tabBtn.classList.remove("btn-secondary");
      tabBtn.classList.add("btn-primary");
      render();
    });
  });

  qs("[data-filter-institute]")?.addEventListener("change", render);
  qs("[data-filter-tracker]")?.addEventListener("change", render);

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    qsa("[data-filter-institute], [data-filter-tracker]").forEach((el) => (el.value = ""));
    render();
  });
}

function activeTab() {
  return qs('[data-tab][aria-selected="true"]')?.dataset.tab || "upcoming";
}

function getFiltered() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  const tab = activeTab();

  return STATE.dates.filter((d) => {
    if (classify(d.date) !== tab) return false;
    if (institute && d.instituteId !== institute) return false;
    if (tracker && d.trackerId !== tracker) return false;
    return true;
  });
}

function dateCard(d) {
  const bucket = classify(d.date);
  const badgeClass = bucket === "today" ? "badge-updated" : bucket === "upcoming" ? "badge-tracked" : "badge-archived";
  const badgeText = bucket === "today" ? "Today" : bucket === "upcoming" ? "Upcoming" : "Completed";

  return `
    <div class="card card-status">
      <div>
        <h3 class="card-title">${d.title}</h3>
        <p class="text-caption mt-1">${instituteName(d.instituteId)} · ${trackerLabel(d.trackerId)} · ${d.date}</p>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <a class="link text-small" href="${d.officialUrl}" target="_blank" rel="noopener noreferrer">Official source</a>
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-dates-list]");
  const emptyState = qs("[data-dates-empty]");
  const countEl = qs("[data-dates-count]");
  if (!list) return;

  const filtered = getFiltered().sort((a, b) => a.date.localeCompare(b.date));

  if (countEl) {
    countEl.textContent = `${filtered.length} date${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }

  emptyState?.setAttribute("hidden", "");
  list.innerHTML = filtered.map(dateCard).join("");
}

onReady(init);
