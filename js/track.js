/**
 * track.js
 * Loaded only on track.html, alongside app.js (which still handles nav,
 * dropdowns, accordion, and the footer year — this file doesn't repeat
 * any of that). Its entire job: read ?org= and ?tracker= from the URL,
 * look them up in the JSON config, and populate the page — or show a
 * friendly error if either doesn't resolve to something real.
 *
 * This is deliberately the thinnest possible client-side stand-in for
 * what a backend route (e.g. GET /track/:org/:tracker) will eventually
 * do: resolve two identifiers into a record and render it. Swapping the
 * data source from loadJSON() to a real API call later shouldn't require
 * touching the rendering logic below at all.
 */

import { qs, qsa, onReady, loadJSON } from "./utils.js";

async function initTrackPage() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get("org");
  const trackerId = params.get("tracker");

  const [institutesData, trackersData] = await Promise.all([
    loadJSON("data/institutes.json"),
    loadJSON("data/trackers.json"),
  ]);

  const institute = institutesData?.institutes.find((i) => i.id === orgId);
  const tracker = trackersData?.trackerTypes.find((t) => t.id === trackerId);
  const isValidCombination = Boolean(
    institute && tracker && institute.trackers.includes(tracker.id)
  );

  if (!isValidCombination) {
    showError(institute);
    return;
  }

  populatePage(institute, tracker);
}

/** Shown when the URL doesn't resolve to a real institute + tracker pair.
 *  If the institute itself was recognized, the error still offers a
 *  specific way back rather than only a generic one. */
function showError(institute) {
  const errorEl = qs("[data-track-error]");
  if (errorEl) errorEl.hidden = false;

  const backLink = qs("[data-track-error-link]");
  if (backLink && institute) {
    backLink.href = institute.url;
    backLink.textContent = `Back to ${institute.name}`;
  }

  document.title = "Tracker Not Found | Trackly";
}

function populatePage(institute, tracker) {
  document.title = `Track ${institute.name} ${tracker.label} | Trackly`;

  updateSeoTags(institute, tracker);
  updateBreadcrumb(institute, tracker);
  updateHero(institute, tracker);
  updateSummaryCard(institute, tracker);
  updateCta(institute);

  qsa("[data-track-content]").forEach((el) => {
    el.hidden = false;
  });
}

/** Self-referencing canonical + Open Graph URL for this exact org/tracker
 *  combination — see the note in <head> about why the base tag is noindex. */
function updateSeoTags(institute, tracker) {
  const canonicalUrl = `${window.location.origin}${window.location.pathname}?org=${institute.id}&tracker=${tracker.id}`;
  qs('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
  qs('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
  qs('meta[property="og:title"]')?.setAttribute("content", document.title);
}

function updateBreadcrumb(institute, tracker) {
  const breadcrumb = qs("[data-track-breadcrumb]");
  if (!breadcrumb) return;
  breadcrumb.innerHTML = `
    <li><a href="index.html">Home</a></li>
    <li><a href="institutes.html">Institutes</a></li>
    <li><a href="${institute.url}">${institute.name}</a></li>
    <li aria-current="page">
      <svg class="icon icon-sm" aria-hidden="true"><use href="assets/icons/icons.svg#icon-chevron-right"></use></svg>
      ${tracker.label}
    </li>
  `;
}

function updateHero(institute, tracker) {
  const set = (selector, text) => {
    const el = qs(selector);
    if (el) el.textContent = text;
  };

  set("[data-track-eyebrow]", `Tracking · ${institute.name}`);
  set("[data-track-title]", tracker.label);
  set("[data-track-subtitle]", institute.fullName);
  set("[data-track-description]", tracker.description);

  const officialLink = qs("[data-track-official-link]");
  if (officialLink) {
    officialLink.href = institute.official.website.url;
    officialLink.innerHTML = `
      View official source
      <svg class="icon icon-sm" aria-hidden="true"><use href="assets/icons/icons.svg#icon-external-link"></use></svg>
    `;
  }
}

function updateSummaryCard(institute, tracker) {
  const set = (selector, text) => {
    const el = qs(selector);
    if (el) el.textContent = text;
  };

  set("[data-summary-institute]", institute.name);
  set("[data-summary-tracker]", tracker.label);

  const sourceLink = qs("[data-summary-source]");
  if (sourceLink) {
    sourceLink.href = institute.official.website.url;
    sourceLink.textContent = institute.official.website.label;
  }
}

function updateCta(institute) {
  const returnLink = qs("[data-cta-return]");
  if (returnLink) {
    returnLink.href = institute.url;
    returnLink.textContent = `Return to ${institute.name}`;
  }
}

onReady(() => {
  initTrackPage();
});
