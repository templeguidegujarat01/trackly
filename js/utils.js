/**
 * utils.js
 * Small, generic helpers with no page-specific knowledge. If a function
 * needs to know about a specific component (dropdown, nav, card), it
 * belongs in components.js or navigation.js instead — keep this file
 * free of anything that isn't reusable everywhere.
 */

/** Shorthand querySelector, scoped optionally to a parent node. */
export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

/** Shorthand querySelectorAll that returns a real array. */
export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/** Runs `fn` once the DOM is ready, even if it already is. */
export function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

/** Debounce: delays calling `fn` until `wait` ms after the last call. */
export function debounce(fn, wait = 150) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

/** Traps Tab/Shift+Tab focus inside `container` (used by the mobile menu). */
export function trapFocus(container, event) {
  const focusable = qsa(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    container
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Marks the nav link matching the current path with aria-current="page". */
export function markActiveNavLink(navSelector = "[data-nav-link]") {
  const currentPath = window.location.pathname.replace(/index\.html$/, "");
  qsa(navSelector).forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(
      /index\.html$/,
      ""
    );
    if (linkPath === currentPath) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

/** Writes the current year into every footer copyright element, so no
 *  page ever ships with a stale hardcoded year. */
export function setCurrentYear(selector = "[data-current-year]") {
  const year = String(new Date().getFullYear());
  qsa(selector).forEach((el) => {
    el.textContent = year;
  });
}

/** Fetches and parses a local JSON file under /data. Returns null on failure
 *  so callers can show an empty state instead of a broken page. */
export async function loadJSON(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
