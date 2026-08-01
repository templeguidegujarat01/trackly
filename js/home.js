/**
 * home.js
 * Loaded only on index.html. Populates the "Latest Notifications" and
 * "Important Dates" preview sections from the same JSON files their
 * full pages (notifications.html, important-dates.html) use — three
 * items each, most-relevant first, each linking out to the full page.
 */

import { qs, onReady, loadJSON } from "./utils.js";

async function initHomePreviews() {
  const [notificationsData, datesData, institutesData] = await Promise.all([
    loadJSON("data/notifications.json"),
    loadJSON("data/important-dates.json"),
    loadJSON("data/institutes.json"),
  ]);

  const institutes = institutesData?.institutes || [];
  const instituteName = (id) => institutes.find((i) => i.id === id)?.name || id;

  renderNotifications(notificationsData?.notifications || [], instituteName);
  renderDates(datesData?.dates || [], instituteName);
}

function renderNotifications(notifications, instituteName) {
  const container = qs("[data-home-notifications]");
  if (!container) return;

  const topThree = [...notifications]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, 3);

  if (topThree.length === 0) {
    container.innerHTML = `<p class="text-small text-muted">No notifications yet.</p>`;
    return;
  }

  container.innerHTML = topThree
    .map(
      (n) => `
      <a class="card card-feature card--interactive" href="notifications.html">
        <div class="card-feature__icon" aria-hidden="true">
          <svg class="icon icon-lg"><use href="assets/icons/icons.svg#icon-bell"></use></svg>
        </div>
        <h3 class="card-title">${n.title}</h3>
        <p class="text-small text-muted">${instituteName(n.instituteId)} · ${n.publishedDate}</p>
      </a>`
    )
    .join("");
}

function renderDates(dates, instituteName) {
  const container = qs("[data-home-dates]");
  if (!container) return;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dates
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  if (upcoming.length === 0) {
    container.innerHTML = `<p class="text-small text-muted">No upcoming dates right now.</p>`;
    return;
  }

  container.innerHTML = upcoming
    .map(
      (d) => `
      <a class="card card-feature card--interactive" href="important-dates.html">
        <div class="card-feature__icon" aria-hidden="true">
          <svg class="icon icon-lg"><use href="assets/icons/icons.svg#icon-calendar"></use></svg>
        </div>
        <h3 class="card-title">${d.title}</h3>
        <p class="text-small text-muted">${instituteName(d.instituteId)} · ${d.date}</p>
      </a>`
    )
    .join("");
}

onReady(initHomePreviews);
