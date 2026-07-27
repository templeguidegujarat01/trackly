/**
 * constants.js
 * Single source of truth for values shared across the site's JS modules.
 * Never repeat one of these values as a string literal elsewhere — import
 * it from here so future changes only happen in one place.
 */

export const SITE = Object.freeze({
  name: "Trackly",
  tagline: "Track official updates. We'll notify you.",
});

/** Must stay in sync with the breakpoint values in css/responsive.css */
export const BREAKPOINTS = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
});

/** Scroll distance (px) after which the header gains a shadow */
export const HEADER_SCROLL_THRESHOLD = 8;

/**
 * Reserved for future phases (subscriptions, saved filters, auth token).
 * Declared now so later phases don't need to invent a new naming scheme.
 */
export const STORAGE_KEYS = Object.freeze({
  subscriptions: "trackly:subscriptions",
  authToken: "trackly:auth-token",
});

/** Tracker status values used consistently across cards, badges, and the
 *  live-status indicator. Keep this list in sync with data/trackers.json. */
export const TRACKER_STATUS = Object.freeze({
  WATCHING: "watching",
  PENDING: "pending",
  RELEASED: "released",
});
