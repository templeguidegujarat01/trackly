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
import { actionButtonsHtml, bindItemActions } from "./item-actions.js";
import { isSignedIn, onAuthChange } from "./auth.js";
import { createSubscription, deleteSubscription, findExistingSubscription } from "./firestore.js";
import { showToast } from "./toast.js";

let CURRENT_INSTITUTE = null;
let CURRENT_TRACKER = null;

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

  CURRENT_INSTITUTE = institute;
  CURRENT_TRACKER = tracker;
  populatePage(institute, tracker);
  initTrackForm(institute, tracker);
}

/** Shown when the URL doesn't resolve to a real institute + tracker pair.
 *  If the institute itself was recognized, the error still offers a
 *  specific way back rather than only a generic one. */
function showError(institute) {
  qs("[data-loading]")?.setAttribute("hidden", "");

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
  updateCrossLinks(institute, tracker);
  updateActions(institute, tracker);
  rememberLastViewed(institute, tracker);

  qs("[data-loading]")?.setAttribute("hidden", "");
  qsa("[data-track-content]").forEach((el) => {
    el.hidden = false;
  });
}

function updateActions(institute, tracker) {
  const container = qs("[data-track-actions]");
  if (!container) return;
  const item = {
    id: `tracker:${institute.id}:${tracker.id}`,
    type: "tracker",
    title: `${institute.name} — ${tracker.label}`,
    meta: institute.fullName,
    url: `track.html?org=${institute.id}&tracker=${tracker.id}`,
  };
  container.innerHTML = actionButtonsHtml(item);
  bindItemActions(container);
}

/** Remembers the last institute/tracker viewed, so a future "continue
 *  where you left off" feature has real data to read from. */
function rememberLastViewed(institute, tracker) {
  try {
    localStorage.setItem("trackly:last-viewed-institute", institute.id);
    localStorage.setItem("trackly:last-viewed-tracker", tracker.id);
  } catch {
    /* ignore */
  }
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

/** Links this specific institute+tracker combination out to the real,
 *  functional Results/Notifications/Important Dates pages — the concrete
 *  "see it for real" next step from what is otherwise an explainer page. */
function updateCrossLinks(institute, tracker) {
  const container = qs("[data-track-cross-links]");
  if (!container) return;

  container.innerHTML = `
    <a class="btn btn-secondary btn-sm" href="results.html?org=${institute.id}&tracker=${tracker.id}">See results</a>
    <a class="btn btn-secondary btn-sm" href="notifications.html?org=${institute.id}">See notifications</a>
    <a class="btn btn-secondary btn-sm" href="important-dates.html?org=${institute.id}&tracker=${tracker.id}">See important dates</a>
  `;
}

/**
 * Generates a rolling set of upcoming exam-session options (e.g. "May
 * 2027"). These are just selection labels for the user's own filter —
 * not a claim that any institute has announced these specific dates.
 */
function upcomingSessionOptions(count = 4) {
  const months = [0, 4, 8]; // Jan, May, Sept — a generic 3-per-year cadence
  const now = new Date();
  const options = [];
  let year = now.getFullYear();
  let monthIndex = months.findIndex((m) => m > now.getMonth());
  if (monthIndex === -1) {
    monthIndex = 0;
    year += 1;
  }
  while (options.length < count) {
    const label = new Date(year, months[monthIndex], 1).toLocaleDateString("en-US", {
      month: "long", year: "numeric",
    });
    options.push(label);
    monthIndex += 1;
    if (monthIndex >= months.length) {
      monthIndex = 0;
      year += 1;
    }
  }
  return options;
}

function initTrackForm(institute, tracker) {
  const courseField = qs("[data-track-course-field]");
  const courseSelect = qs("[data-track-course]");
  const sessionSelect = qs("[data-track-session]");

  if (institute.courses?.length && courseSelect) {
    institute.courses.forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      courseSelect.appendChild(opt);
    });
    courseField.hidden = false;
  }

  upcomingSessionOptions().forEach((session) => {
    const opt = document.createElement("option");
    opt.value = session;
    opt.textContent = session;
    sessionSelect.appendChild(opt);
  });

  onAuthChange(() => refreshTrackState(institute, tracker));

  qs("[data-track-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleTrackSubmit(institute, tracker);
  });

  qs("[data-track-untrack]")?.addEventListener("click", async () => {
    await handleUntrack(institute, tracker);
  });
}

async function refreshTrackState(institute, tracker) {
  const form = qs("[data-track-form]");
  const already = qs("[data-track-already]");
  const signinNote = qs("[data-track-signin-note]");
  const prefsSection = qs("[data-track-prefs-section]");
  if (!form) return;

  if (!isSignedIn()) {
    form.hidden = false;
    already.hidden = true;
    signinNote.hidden = false;
    prefsSection.hidden = true;
    return;
  }

  signinNote.hidden = true;
  const courseSelect = qs("[data-track-course]");
  const sessionSelect = qs("[data-track-session]");
  const existing = await findExistingSubscription({
    instituteId: institute.id,
    trackerId: tracker.id,
    courseId: courseSelect?.value || null,
    examSession: sessionSelect?.value || null,
  });

  if (existing) {
    form.hidden = true;
    already.hidden = false;
    already.dataset.subscriptionId = existing.id;
    prefsSection.hidden = false;
  } else {
    form.hidden = false;
    already.hidden = true;
    prefsSection.hidden = true;
  }
}

async function handleTrackSubmit(institute, tracker) {
  if (!isSignedIn()) {
    showToast("Log in to track this update");
    qs("[data-login-trigger]")?.click();
    return;
  }

  const submitBtn = qs("[data-track-submit]");
  submitBtn.setAttribute("data-loading", "true");
  submitBtn.disabled = true;

  try {
    const courseSelect = qs("[data-track-course]");
    const sessionSelect = qs("[data-track-session]");
    await createSubscription({
      instituteId: institute.id,
      instituteName: institute.name,
      courseId: courseSelect?.value || null,
      trackerId: tracker.id,
      trackerLabel: tracker.label,
      examSession: sessionSelect?.value || null,
    });
    showToast("You're now tracking this");
    await refreshTrackState(institute, tracker);
  } catch (err) {
    console.error("Failed to create subscription:", err);
    showToast("Couldn't save that — please try again");
  } finally {
    submitBtn.removeAttribute("data-loading");
    submitBtn.disabled = false;
  }
}

async function handleUntrack(institute, tracker) {
  const already = qs("[data-track-already]");
  const subscriptionId = already?.dataset.subscriptionId;
  if (!subscriptionId) return;

  try {
    await deleteSubscription(subscriptionId);
    showToast("Untracked");
    await refreshTrackState(institute, tracker);
  } catch (err) {
    console.error("Failed to remove subscription:", err);
    showToast("Couldn't untrack — please try again");
  }
}

onReady(() => {
  initTrackPage();
});
