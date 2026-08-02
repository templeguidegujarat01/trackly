/**
 * important-dates.js
 * Loaded only on important-dates.html. Classifies each date into
 * Upcoming / Today / Completed / Monthly by comparing against the real
 * current date at render time. Adds a countdown per item and a
 * per-event .ics download — both genuine, computed client-side.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";
import { makeLookup, daysUntil, formatCountdown } from "./data-helpers.js";
import { actionButtonsHtml, bindItemActions } from "./item-actions.js";

const STORAGE_KEY = "trackly:filters:dates";

let STATE = { dates: [], lookup: null };

async function init() {
  bindRetry();
  await loadAndRender();
}

async function loadAndRender() {
  qs("[data-load-error]")?.setAttribute("hidden", "");
  qs("[data-loading]")?.removeAttribute("hidden");
  qs("[data-dates-content]")?.setAttribute("hidden", "");

  const [datesData, institutesData, trackersData] = await Promise.all([
    loadJSON("data/important-dates.json"),
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!datesData || !institutesData || !trackersData) {
    qs("[data-loading]")?.setAttribute("hidden", "");
    qs("[data-load-error]")?.removeAttribute("hidden");
    return;
  }

  STATE.dates = datesData.dates;
  STATE.lookup = makeLookup(institutesData.institutes, trackersData.trackerTypes);

  populateInstituteFilter(institutesData.institutes);
  populateTrackerFilter();
  restoreFilters();
  bindEvents();
  bindItemActions(qs("[data-dates-list]"));
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-dates-content]")?.removeAttribute("hidden");
}

function bindRetry() {
  qs("[data-retry]")?.addEventListener("click", loadAndRender);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function classify(dateStr) {
  const today = todayISO();
  if (dateStr === today) return "today";
  return dateStr > today ? "upcoming" : "completed";
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

function populateTrackerFilter() {
  const select = qs("[data-filter-tracker]");
  if (!select) return;
  const usedIds = [...new Set(STATE.dates.map((d) => d.trackerId))];
  STATE.lookup && usedIds.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = STATE.lookup.trackerLabel(id);
    select.appendChild(opt);
  });
}

function restoreFilters() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = { institute: params.get("org"), tracker: params.get("tracker"), tab: params.get("view") };
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
  if (filters.institute) qs("[data-filter-institute]").value = filters.institute;
  if (filters.tracker) qs("[data-filter-tracker]").value = filters.tracker;
  if (filters.tab) {
    qsa("[data-tab]").forEach((b) => {
      const active = b.dataset.tab === filters.tab;
      b.setAttribute("aria-selected", String(active));
      b.classList.toggle("btn-primary", active);
      b.classList.toggle("btn-secondary", !active);
    });
  }
}

function persistFilters() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  const tab = activeTab();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ institute, tracker, tab }));
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams();
  if (institute) params.set("org", institute);
  if (tracker) params.set("tracker", tracker);
  if (tab !== "upcoming") params.set("view", tab);
  const query = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
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
      persistFilters();
      render();
    });
  });

  qs("[data-filter-institute]")?.addEventListener("change", () => {
    persistFilters();
    render();
  });
  qs("[data-filter-tracker]")?.addEventListener("change", () => {
    persistFilters();
    render();
  });

  qs("[data-filter-reset]")?.addEventListener("click", () => {
    qsa("[data-filter-institute], [data-filter-tracker]").forEach((el) => (el.value = ""));
    persistFilters();
    render();
  });
}

function activeTab() {
  return qs('[data-tab][aria-selected="true"]')?.dataset.tab || "upcoming";
}

function getFilteredBase() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  return STATE.dates.filter((d) => {
    if (institute && d.instituteId !== institute) return false;
    if (tracker && d.trackerId !== tracker) return false;
    return true;
  });
}

function icsFor(d) {
  const dateCompact = d.date.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trackly//Important Dates//EN",
    "BEGIN:VEVENT", `UID:${d.id}@trackly.app`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateCompact}`, `SUMMARY:${d.title}`,
    `DESCRIPTION:${STATE.lookup.instituteName(d.instituteId)} - ${STATE.lookup.trackerLabel(d.trackerId)}`,
    `URL:${d.officialUrl}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(d) {
  const blob = new Blob([icsFor(d)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateCard(d) {
  const bucket = classify(d.date);
  const badgeClass = bucket === "today" ? "badge-updated" : bucket === "upcoming" ? "badge-tracked" : "badge-archived";
  const badgeText = bucket === "today" ? "Today" : bucket === "upcoming" ? "Upcoming" : "Completed";
  const countdown = formatCountdown(daysUntil(d.date));

  const item = {
    id: `date:${d.id}`, type: "important-date", title: d.title,
    meta: `${STATE.lookup.instituteName(d.instituteId)} · ${d.date}`,
    url: `important-dates.html?org=${d.instituteId}&tracker=${d.trackerId}`,
  };

  return `
    <div class="card card-status">
      <div>
        <h3 class="card-title">${d.title}</h3>
        <p class="text-caption mt-1">${STATE.lookup.instituteName(d.instituteId)} · ${STATE.lookup.trackerLabel(d.trackerId)} · ${d.date}</p>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <span class="text-small text-muted">${countdown}</span>
        <a class="link text-small" href="${d.officialUrl}" target="_blank" rel="noopener noreferrer">Official source</a>
        <button class="btn-icon card-actions__btn" type="button" data-ics="${d.id}" aria-label="Add to calendar (.ics)">
          <svg class="icon"><use href="assets/icons/icons.svg#icon-calendar"></use></svg>
        </button>
        ${actionButtonsHtml(item)}
      </div>
    </div>`;
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function render() {
  const list = qs("[data-dates-list]");
  const emptyState = qs("[data-dates-empty]");
  const countEl = qs("[data-dates-count]");
  if (!list) return;

  const tab = activeTab();
  const base = getFilteredBase();
  let html;
  let count;

  if (tab === "monthly") {
    const sorted = [...base].sort((a, b) => a.date.localeCompare(b.date));
    count = sorted.length;
    let currentMonth = null;
    html = sorted
      .map((d) => {
        const month = monthLabel(d.date);
        const heading = month !== currentMonth ? `<h3 class="month-group-heading">${month}</h3>` : "";
        currentMonth = month;
        return heading + dateCard(d);
      })
      .join("");
  } else {
    const filtered = base.filter((d) => classify(d.date) === tab).sort((a, b) => a.date.localeCompare(b.date));
    count = filtered.length;
    html = filtered.map(dateCard).join("");
  }

  if (countEl) countEl.textContent = `${count} date${count === 1 ? "" : "s"}`;

  if (count === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }
  emptyState?.setAttribute("hidden", "");
  list.innerHTML = html;

  qsa("[data-ics]", list).forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = STATE.dates.find((x) => x.id === btn.dataset.ics);
      if (d) downloadIcs(d);
    });
  });
}

onReady(init);
