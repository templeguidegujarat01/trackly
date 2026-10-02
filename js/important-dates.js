/**
 * important-dates.js
 * Loaded only on important-dates.html. Shows recently detected
 * schedule/date-related changes (exam timetable, exam calendar, admit
 * cards) from Firestore's `changes` collection, in reverse-chronological
 * order by detection time.
 *
 * Deliberately does NOT show "Upcoming/Today/Completed" or attempt to
 * extract an actual calendar date from page content — a detected
 * change only tells us an official page mentioned a schedule update,
 * not what the date itself is. Regex-guessing a date out of arbitrary
 * text risks exactly the "manufactured/guessed date" problem this
 * project has avoided since Phase 1. The honest thing to show is when
 * Trackly noticed the update; the actual date lives on the official
 * source, linked from every card.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";
import { makeLookup } from "./data-helpers.js";
import { actionButtonsHtml, bindItemActions } from "./item-actions.js";
import { getRecentChanges } from "./firestore.js";

const DATE_TRACKER_IDS = new Set(["exam-timetable", "exam-calendar", "exam-dates", "admit-cards"]);

let STATE = { dates: [], lookup: null };

async function init() {
  bindRetry();
  await loadAndRender();
}

async function loadAndRender() {
  qs("[data-load-error]")?.setAttribute("hidden", "");
  qs("[data-loading]")?.removeAttribute("hidden");
  qs("[data-dates-content]")?.setAttribute("hidden", "");

  const [institutesData, trackersData] = await Promise.all([
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  if (!institutesData || !trackersData) {
    qs("[data-loading]")?.setAttribute("hidden", "");
    qs("[data-load-error]")?.removeAttribute("hidden");
    return;
  }

  STATE.lookup = makeLookup(institutesData.institutes, trackersData.trackerTypes);

  try {
    const changes = await getRecentChanges();
    STATE.dates = changes.filter((c) => DATE_TRACKER_IDS.has(c.trackerId));
  } catch (err) {
    console.warn("Live date updates unavailable:", err.message);
    STATE.dates = [];
  }

  populateInstituteFilter(institutesData.institutes);
  populateTrackerFilter();
  bindEvents();
  bindItemActions(qs("[data-dates-list]"));
  render();

  qs("[data-loading]")?.setAttribute("hidden", "");
  qs("[data-dates-content]")?.removeAttribute("hidden");
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

function populateTrackerFilter() {
  const select = qs("[data-filter-tracker]");
  if (!select || !STATE.lookup) return;
  [...DATE_TRACKER_IDS].forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = STATE.lookup.trackerLabel(id);
    select.appendChild(opt);
  });
}

function bindEvents() {
  qs("[data-filter-institute]")?.addEventListener("change", render);
  qs("[data-filter-tracker]")?.addEventListener("change", render);
  qs("[data-filter-reset]")?.addEventListener("click", () => {
    qsa("[data-filter-institute], [data-filter-tracker]").forEach((el) => (el.value = ""));
    render();
  });
}

function getFiltered() {
  const institute = qs("[data-filter-institute]")?.value || "";
  const tracker = qs("[data-filter-tracker]")?.value || "";
  return STATE.dates.filter((d) => {
    if (institute && d.instituteId !== institute) return false;
    if (tracker && d.trackerId !== tracker) return false;
    return true;
  });
}

function dateCard(d) {
  const when = d.detectedAt?.toDate ? d.detectedAt.toDate().toLocaleString() : "";
  const item = {
    id: `date:${d.id}`, type: "important-date",
    title: `${STATE.lookup.instituteName(d.instituteId)}: ${STATE.lookup.trackerLabel(d.trackerId)} update`,
    meta: `${STATE.lookup.instituteName(d.instituteId)} · detected ${when}`,
    url: `important-dates.html?org=${d.instituteId}&tracker=${d.trackerId}`,
  };

  return `
    <div class="card card-status">
      <div>
        <h3 class="card-title">${STATE.lookup.instituteName(d.instituteId)}: ${STATE.lookup.trackerLabel(d.trackerId)}</h3>
        <p class="text-caption mt-1">Detected ${when}</p>
      </div>
      <div class="flex flex-wrap gap-3" style="align-items:center;">
        <span class="badge badge-updated">New</span>
        <a class="link text-small" href="${d.sourceUrl}" target="_blank" rel="noopener noreferrer">View official source for the actual date</a>
        ${actionButtonsHtml(item)}
      </div>
    </div>`;
}

function render() {
  const list = qs("[data-dates-list]");
  const emptyState = qs("[data-dates-empty]");
  const countEl = qs("[data-dates-count]");
  if (!list) return;

  const filtered = getFiltered().sort((a, b) => {
    const at = a.detectedAt?.toMillis ? a.detectedAt.toMillis() : 0;
    const bt = b.detectedAt?.toMillis ? b.detectedAt.toMillis() : 0;
    return bt - at;
  });

  if (countEl) countEl.textContent = `${filtered.length} update${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }
  emptyState?.setAttribute("hidden", "");
  list.innerHTML = filtered.map(dateCard).join("");
}

onReady(init);
