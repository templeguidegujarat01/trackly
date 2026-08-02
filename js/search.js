/**
 * search.js
 * Powers the global search modal present on every page (header trigger
 * button + "/" shortcut). Searches three things: institutes, tracker
 * types, and a small static list of site pages — the same three
 * categories named in the Phase 9/10 brief. Institutes/trackers come
 * from the real JSON config (never duplicated as a separate file);
 * the page list is a small constant here, the same way NAV_LINKS is
 * defined once per page's header rather than fetched.
 */

import { qs, qsa, onReady, loadJSON, trapFocus } from "./utils.js";

const STATIC_PAGES = [
  { title: "Home", url: "index.html", meta: "Page" },
  { title: "Institutes Directory", url: "institutes.html", meta: "Page" },
  { title: "How It Works", url: "how-it-works.html", meta: "Page" },
  { title: "About", url: "about.html", meta: "Page" },
  { title: "Contact", url: "contact.html", meta: "Page" },
  { title: "Results", url: "results.html", meta: "Page" },
  { title: "Notifications", url: "notifications.html", meta: "Page" },
  { title: "Important Dates", url: "important-dates.html", meta: "Page" },
  { title: "Privacy Policy", url: "privacy.html", meta: "Page" },
  { title: "Terms & Conditions", url: "terms.html", meta: "Page" },
  { title: "Disclaimer", url: "disclaimer.html", meta: "Page" },
];

let DATA = { institutes: [], trackers: [], results: [], notifications: [], dates: [] };
let activeIndex = -1;
let currentResults = [];

/** Resolves any of this page's root-relative links against the page's own
 *  depth — works whether search.js runs on a root page or pages/{id}/. */
function resolveUrl(path) {
  const depth = window.location.pathname.split("/").filter(Boolean);
  const isNestedInstitutePage = depth.includes("pages");
  return isNestedInstitutePage ? `../../${path}` : path;
}

async function loadData() {
  const base = resolveUrl("");
  const [institutesData, trackersData, resultsData, notificationsData, datesData] = await Promise.all([
    loadJSON(`${base}data/institutes.json`),
    loadJSON(`${base}data/trackers.json`),
    loadJSON(`${base}data/results.json`),
    loadJSON(`${base}data/notifications.json`),
    loadJSON(`${base}data/important-dates.json`),
  ]);
  DATA.institutes = institutesData?.institutes || [];
  DATA.trackers = trackersData?.trackerTypes || [];
  DATA.results = resultsData?.results || [];
  DATA.notifications = notificationsData?.notifications || [];
  DATA.dates = datesData?.dates || [];
}

function instituteName(id) {
  return DATA.institutes.find((i) => i.id === id)?.name || id;
}

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { institutes: [], trackers: [], pages: [], results: [], notifications: [], dates: [] };

  const institutes = DATA.institutes
    .filter((i) => i.name.toLowerCase().includes(q) || i.fullName.toLowerCase().includes(q))
    .map((i) => ({ title: i.name, meta: i.fullName, url: resolveUrl(i.url), icon: "icon-shield-check" }));

  const trackers = DATA.trackers
    .filter((t) => t.label.toLowerCase().includes(q))
    .map((t) => ({ title: t.label, meta: "Tracker type", url: resolveUrl(`institutes.html`), icon: "icon-list" }));

  const pages = STATIC_PAGES
    .filter((p) => p.title.toLowerCase().includes(q))
    .map((p) => ({ title: p.title, meta: p.meta, url: resolveUrl(p.url), icon: "icon-layout" }));

  const results = DATA.results
    .filter((r) => r.title.toLowerCase().includes(q))
    .slice(0, 5)
    .map((r) => ({
      title: r.title, meta: `Result · ${instituteName(r.instituteId)}`,
      url: resolveUrl(`results.html?org=${r.instituteId}&tracker=${r.trackerId}&year=${r.year}`),
      icon: "icon-clipboard-check",
    }));

  const notifications = DATA.notifications
    .filter((n) => `${n.title} ${n.summary}`.toLowerCase().includes(q))
    .slice(0, 5)
    .map((n) => ({
      title: n.title, meta: `Notification · ${instituteName(n.instituteId)}`,
      url: resolveUrl(`notifications.html?org=${n.instituteId}&q=${encodeURIComponent(n.title)}`),
      icon: "icon-bell",
    }));

  const dates = DATA.dates
    .filter((d) => d.title.toLowerCase().includes(q))
    .slice(0, 5)
    .map((d) => ({
      title: d.title, meta: `Important Date · ${instituteName(d.instituteId)} · ${d.date}`,
      url: resolveUrl(`important-dates.html?org=${d.instituteId}&tracker=${d.trackerId}`),
      icon: "icon-calendar",
    }));

  return { institutes, trackers, pages, results, notifications, dates };
}

function renderResults(query) {
  const container = qs("[data-search-results]");
  if (!container) return;

  if (!query.trim()) {
    container.innerHTML = `<p class="search-modal__empty">Search institutes, trackers, results, notifications, dates, or pages.</p>`;
    currentResults = [];
    activeIndex = -1;
    return;
  }

  const { institutes, trackers, pages, results, notifications, dates } = search(query);
  currentResults = [...institutes, ...results, ...notifications, ...dates, ...trackers, ...pages];

  if (currentResults.length === 0) {
    container.innerHTML = `<p class="search-modal__empty">No matches for "${escapeHtml(query)}".</p>`;
    activeIndex = -1;
    return;
  }

  const group = (label, items) => {
    if (items.length === 0) return "";
    const rows = items
      .map(
        (item) => `
        <a class="search-modal__item" href="${item.url}" data-result-index="${currentResults.indexOf(item)}">
          <span class="search-modal__item-icon" aria-hidden="true">
            <svg class="icon"><use href="${resolveUrl("assets/icons/icons.svg")}#${item.icon}"></use></svg>
          </span>
          <span>
            <span class="search-modal__item-title">${escapeHtml(item.title)}</span><br>
            <span class="search-modal__item-meta">${escapeHtml(item.meta)}</span>
          </span>
        </a>`
      )
      .join("");
    return `<div class="search-modal__group-label">${label}</div>${rows}`;
  };

  container.innerHTML =
    group("Institutes", institutes) +
    group("Results", results) +
    group("Notifications", notifications) +
    group("Important Dates", dates) +
    group("Tracker Types", trackers) +
    group("Pages", pages);

  activeIndex = -1;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateActiveHighlight() {
  qsa("[data-result-index]").forEach((el) => {
    const isActive = Number(el.dataset.resultIndex) === activeIndex;
    el.toggleAttribute("data-active", isActive);
    if (isActive) el.scrollIntoView({ block: "nearest" });
  });
}

function openModal() {
  const overlay = qs("[data-search-overlay]");
  const input = qs("[data-search-input-global]");
  if (!overlay || !input) return;
  overlay.hidden = false;
  input.value = "";
  input.focus();
  renderResults("");
}

function closeModal() {
  const overlay = qs("[data-search-overlay]");
  if (!overlay) return;
  overlay.hidden = true;
  const trigger = qs("[data-search-trigger]");
  trigger?.focus();
}

function initGlobalSearch() {
  const overlay = qs("[data-search-overlay]");
  const input = qs("[data-search-input-global]");
  const trigger = qs("[data-search-trigger]");
  if (!overlay || !input || !trigger) return;

  loadData();

  trigger.addEventListener("click", openModal);

  document.addEventListener("keydown", (event) => {
    const isTypingElsewhere = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && document.activeElement !== input;
    if (event.key === "/" && !isTypingElsewhere && overlay.hidden) {
      event.preventDefault();
      openModal();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      overlay.hidden ? openModal() : closeModal();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });

  input.addEventListener("input", () => renderResults(input.value));

  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key === "Tab") {
      trapFocus(overlay, event);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (currentResults.length === 0) return;
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      updateActiveHighlight();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (currentResults.length === 0) return;
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveHighlight();
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const target = currentResults[activeIndex];
      if (target) window.location.href = target.url;
    }
  });
}

onReady(initGlobalSearch);
