/**
 * institute-bookmarks.js
 * Wires up any [data-bookmark-institute] button on the page — used on
 * institutes.html (one per card) and each institute page (one in the
 * hero). Reuses the shared bookmarks.js engine directly rather than the
 * full action-row component, since only bookmarking applies here.
 */

import { qsa, onReady } from "./utils.js";
import { toggleBookmark, isBookmarked } from "./bookmarks.js";
import { showToast } from "./toast.js";

function init() {
  qsa("[data-bookmark-institute]").forEach((btn) => {
    const item = {
      id: `institute:${btn.dataset.bookmarkInstitute}`,
      type: "institute",
      title: btn.dataset.bookmarkTitle,
      meta: btn.dataset.bookmarkMeta,
      url: btn.dataset.bookmarkUrl,
    };

    const bookmarked = isBookmarked(item.id);
    btn.dataset.active = String(bookmarked);
    btn.setAttribute("aria-pressed", String(bookmarked));

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const now = toggleBookmark(item);
      btn.dataset.active = String(now);
      btn.setAttribute("aria-pressed", String(now));
      showToast(now ? "Bookmarked" : "Removed");
    });
  });
}

onReady(init);
