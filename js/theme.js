/**
 * theme.js
 * The theme itself is already applied before this file even loads — a
 * small inline script in every page's <head> sets [data-theme] on
 * <html> synchronously, before first paint, to avoid a flash of the
 * wrong theme. This module wires up every toggle button on the page
 * (the header has one, the mobile menu has another) via qsa/forEach so
 * both instances stay in sync, not just whichever one loads first.
 */

import { qs, qsa, onReady } from "./utils.js";

const STORAGE_KEY = "trackly:theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncToggleButtons(theme);
}

function syncToggleButtons(theme) {
  qsa("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(theme === "dark"));
    const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  });
}

function initThemeToggle() {
  syncToggleButtons(currentTheme());

  qsa("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    });
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", (event) => {
    let hasExplicitChoice = false;
    try {
      hasExplicitChoice = Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* ignore */
    }
    if (!hasExplicitChoice) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });
}

onReady(initThemeToggle);
