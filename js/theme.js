/**
 * theme.js
 * The theme itself is already applied before this file even loads — a
 * small inline script in every page's <head> sets [data-theme] on
 * <html> synchronously, before first paint, to avoid a flash of the
 * wrong theme. This module only wires up the toggle button: flipping
 * the attribute, persisting the choice, and keeping the sun/moon icon
 * in sync.
 */

import { qs, onReady } from "./utils.js";

const STORAGE_KEY = "trackly:theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncToggleButton(theme);
}

function syncToggleButton(theme) {
  const btn = qs("[data-theme-toggle]");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(theme === "dark"));
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

function initThemeToggle() {
  syncToggleButton(currentTheme());

  qs("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  });

  // If the person never explicitly chose a theme, keep following the OS
  // preference live (e.g. their system switches to dark mode at sunset).
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
