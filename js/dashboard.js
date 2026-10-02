/**
 * dashboard.js
 * Everything on dashboard.html is real: subscriptions and notifications
 * are read live from Firestore (watchUserSubscriptions uses onSnapshot,
 * so pausing/untracking something updates this view without a reload).
 */

import { qs, qsa, onReady } from "./utils.js";
import { onAuthChange } from "./auth.js";
import {
  watchUserSubscriptions, deleteSubscription, setSubscriptionActive, getUserNotifications,
  markNotificationRead, updateNotificationPreferences,
} from "./firestore.js";
import { showToast } from "./toast.js";

let unsubscribeSubs = null;

function init() {
  onAuthChange((user) => {
    const content = qs("[data-dashboard-content]");
    const signedOutNotice = qs("[data-signed-out-notice]");
    const greeting = qs("[data-dashboard-greeting]");

    if (unsubscribeSubs) {
      unsubscribeSubs();
      unsubscribeSubs = null;
    }

    if (!user) {
      content.hidden = true;
      signedOutNotice.hidden = false;
      return;
    }

    signedOutNotice.hidden = true;
    content.hidden = false;
    if (greeting) {
      greeting.textContent = user.displayName ? `Hi, ${user.displayName.split(" ")[0]}` : "My Dashboard";
    }

    unsubscribeSubs = watchUserSubscriptions(renderSubscriptions);
    loadNotifications();
  });

  qs("[data-login-trigger-secondary]")?.addEventListener("click", () => {
    qs("[data-login-trigger]")?.click();
  });

  qs("[data-mark-all-read]")?.addEventListener("click", markAllRead);
  qs("[data-pref-push]")?.addEventListener("change", savePreferences);
  qs("[data-pref-email]")?.addEventListener("change", savePreferences);
}

function savePreferences() {
  const pushEnabled = qs("[data-pref-push]")?.checked ?? true;
  const emailEnabled = qs("[data-pref-email]")?.checked ?? false;
  updateNotificationPreferences({ pushEnabled, emailEnabled })
    .then(() => showToast("Preferences saved"))
    .catch(() => showToast("Couldn't save preferences"));
}

function subscriptionCard(sub) {
  const parts = [sub.trackerLabel || sub.trackerId];
  if (sub.courseId) parts.push(sub.courseId);
  if (sub.examSession) parts.push(sub.examSession);

  const isActive = sub.active !== false;
  const badge = isActive
    ? '<span class="badge badge-tracked">Monitoring</span>'
    : '<span class="badge badge-archived">Paused</span>';
  const pauseLabel = isActive ? "Pause" : "Resume";

  return `
    <div class="card card-status" data-sub-id="${sub.id}">
      <div>
        <h3 class="card-title">${sub.instituteName || sub.instituteId}</h3>
        <p class="text-caption mt-1">${parts.join(" · ")}</p>
      </div>
      <div class="flex gap-3 flex-wrap" style="align-items:center;">
        ${badge}
        <a class="link text-small" href="track.html?org=${sub.instituteId}&tracker=${sub.trackerId}">View</a>
        <button class="btn btn-secondary btn-sm" type="button" data-toggle-active="${sub.id}" data-active="${isActive}">${pauseLabel}</button>
        <button class="btn btn-secondary btn-sm" type="button" data-untrack="${sub.id}">Stop Tracking</button>
      </div>
    </div>`;
}

function renderSubscriptions(subs) {
  const list = qs("[data-trackers-list]");
  const empty = qs("[data-trackers-empty]");
  const countEl = qs("[data-trackers-count]");
  if (!list) return;

  if (countEl) countEl.textContent = `${subs.length} tracker${subs.length === 1 ? "" : "s"}`;

  if (subs.length === 0) {
    list.innerHTML = "";
    empty.removeAttribute("hidden");
    return;
  }
  empty.setAttribute("hidden", "");
  list.innerHTML = subs.map(subscriptionCard).join("");

  qsa("[data-toggle-active]", list).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nowActive = btn.dataset.active !== "true";
      btn.disabled = true;
      try {
        await setSubscriptionActive(btn.dataset.toggleActive, nowActive);
        showToast(nowActive ? "Resumed" : "Paused");
      } catch {
        showToast("Couldn't update — try again");
        btn.disabled = false;
      }
    });
  });

  qsa("[data-untrack]", list).forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await deleteSubscription(btn.dataset.untrack);
        showToast("Stopped tracking");
      } catch {
        showToast("Couldn't stop tracking — try again");
        btn.disabled = false;
      }
    });
  });
}

function notificationCard(n) {
  const when = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : "";
  return `
    <div class="card card-notification" data-notif-id="${n.id}" style="${n.read ? "" : "border-left: 3px solid var(--color-primary);"}">
      <div class="card-feature__icon" aria-hidden="true" style="margin-bottom:0;">
        <svg class="icon"><use href="assets/icons/icons.svg#icon-bell"></use></svg>
      </div>
      <div>
        <div class="flex flex-between" style="align-items:flex-start;">
          <h3 class="card-title">${n.title}</h3>
          ${n.read ? "" : '<span class="badge badge-tracked" style="flex-shrink:0;">New</span>'}
        </div>
        <p class="text-small text-muted mt-1">${n.body || ""}</p>
        <p class="text-caption mt-2">${when}</p>
      </div>
    </div>`;
}

async function loadNotifications() {
  const list = qs("[data-notifications-list]");
  const empty = qs("[data-notifications-empty]");
  const countEl = qs("[data-notifications-count]");
  if (!list) return;

  try {
    const notifications = await getUserNotifications();
    if (countEl) countEl.textContent = `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`;

    if (notifications.length === 0) {
      list.innerHTML = "";
      empty.removeAttribute("hidden");
      return;
    }
    empty.setAttribute("hidden", "");
    list.innerHTML = notifications.map(notificationCard).join("");

    qsa("[data-notif-id]", list).forEach((card) => {
      card.addEventListener("click", () => markNotificationRead(card.dataset.notifId).catch(() => {}));
    });
  } catch (err) {
    console.error("Failed to load notifications:", err);
  }
}

async function markAllRead() {
  try {
    const notifications = await getUserNotifications();
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id)));
    showToast("All marked read");
    loadNotifications();
  } catch {
    showToast("Couldn't update notifications");
  }
}

onReady(init);
