/**
 * navigation.js
 * All behaviour for the site header: the mobile off-canvas menu (open,
 * close, focus trap, escape-to-close), the scroll shadow, and marking the
 * current page's nav link active. Runs on every page since the header is
 * identical everywhere.
 */

import { qs, qsa, trapFocus, markActiveNavLink } from "./utils.js";
import { togglePanel } from "./ui.js";
import { HEADER_SCROLL_THRESHOLD } from "./constants.js";

export function initNavigation() {
  markActiveNavLink("[data-nav-link]");
  initMobileMenu();
  initHeaderScrollShadow();
}

function initMobileMenu() {
  const toggle = qs("[data-nav-toggle]");
  const panel = qs("[data-nav-mobile]");
  const header = qs(".site-header");
  if (!toggle || !panel) return;

  const closeIcon = qs("[data-icon-close]", toggle);
  const openIcon = qs("[data-icon-open]", toggle);

  const setOpen = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    togglePanel(panel, "nav-mobile--open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (openIcon && closeIcon) {
      openIcon.classList.toggle("hidden", isOpen);
      closeIcon.classList.toggle("hidden", !isOpen);
    }
    if (isOpen) {
      const firstLink = qs(".nav-mobile__link", panel);
      firstLink?.focus();
    } else {
      toggle.focus();
    }
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "Tab") trapFocus(panel, event);
  });

  // Close the mobile menu automatically if the viewport grows into the
  // desktop layout (e.g. rotating a tablet, or resizing a browser window).
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });

  // Header height is used by nav-mobile's `inset` in navigation.css, kept
  // in sync in case a future phase changes header height responsively.
  if (header) {
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`
    );
  }
}

function initHeaderScrollShadow() {
  const header = qs(".site-header");
  if (!header) return;

  const updateShadow = () => {
    header.classList.toggle(
      "site-header--scrolled",
      window.scrollY > HEADER_SCROLL_THRESHOLD
    );
  };

  updateShadow();
  window.addEventListener("scroll", updateShadow, { passive: true });
}
