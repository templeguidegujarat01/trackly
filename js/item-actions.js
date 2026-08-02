/**
 * item-actions.js
 * Renders the bookmark/share/copy-link button row used on every card
 * across results.html, notifications.html, important-dates.html, and
 * institute content. One event-delegation listener (bindItemActions)
 * handles all three actions for an entire container, so each page wires
 * this up once rather than attaching per-card listeners.
 */

import { toggleBookmark, isBookmarked } from "./bookmarks.js";
import { showToast } from "./toast.js";

const ICON = "assets/icons/icons.svg";

/**
 * item: { id, type, title, meta, url }
 * iconPath: override for nested pages (e.g. "../../assets/icons/icons.svg")
 */
export function actionButtonsHtml(item, iconPath = ICON) {
  const bookmarked = isBookmarked(item.id);
  return `
    <div class="card-actions"
         data-item-id="${escapeAttr(item.id)}"
         data-item-type="${escapeAttr(item.type)}"
         data-item-title="${escapeAttr(item.title)}"
         data-item-meta="${escapeAttr(item.meta || "")}"
         data-item-url="${escapeAttr(item.url)}">
      <button class="card-actions__btn" type="button" data-action="bookmark" data-active="${bookmarked}"
              aria-pressed="${bookmarked}" aria-label="${bookmarked ? "Remove bookmark" : "Bookmark this"}">
        <svg class="icon" aria-hidden="true"><use href="${iconPath}#icon-bookmark"></use></svg>
      </button>
      <button class="card-actions__btn" type="button" data-action="share" aria-label="Share">
        <svg class="icon" aria-hidden="true"><use href="${iconPath}#icon-share"></use></svg>
      </button>
      <button class="card-actions__btn" type="button" data-action="copy" aria-label="Copy link">
        <svg class="icon" aria-hidden="true"><use href="${iconPath}#icon-link"></use></svg>
      </button>
    </div>`;
}

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function absoluteUrl(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

async function handleShare(title, url) {
  const absolute = absoluteUrl(url);
  if (navigator.share) {
    try {
      await navigator.share({ title, url: absolute });
      showToast("Shared");
    } catch (err) {
      if (err?.name !== "AbortError") await handleCopy(absolute);
    }
  } else {
    await handleCopy(absolute);
  }
}

async function handleCopy(url) {
  const absolute = absoluteUrl(url);
  try {
    await navigator.clipboard.writeText(absolute);
    showToast("Link copied");
  } catch {
    showToast("Couldn't copy link");
  }
}

/** Attaches one delegated click listener for every .card-actions row
 *  inside `container`. Call this once per page after rendering cards. */
export function bindItemActions(container) {
  if (!container || container.dataset.actionsBound) return;
  container.dataset.actionsBound = "true";

  container.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const row = btn.closest(".card-actions");
    if (!row) return;

    const item = {
      id: row.dataset.itemId,
      type: row.dataset.itemType,
      title: row.dataset.itemTitle,
      meta: row.dataset.itemMeta,
      url: row.dataset.itemUrl,
    };
    const action = btn.dataset.action;

    if (action === "bookmark") {
      event.preventDefault();
      const nowBookmarked = toggleBookmark(item);
      btn.dataset.active = String(nowBookmarked);
      btn.setAttribute("aria-pressed", String(nowBookmarked));
      btn.setAttribute("aria-label", nowBookmarked ? "Remove bookmark" : "Bookmark this");
      showToast(nowBookmarked ? "Bookmarked" : "Removed");
    } else if (action === "share") {
      event.preventDefault();
      handleShare(item.title, item.url);
    } else if (action === "copy") {
      event.preventDefault();
      handleCopy(item.url);
    }
  });
}
