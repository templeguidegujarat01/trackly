/**
 * data-helpers.js
 * Small lookup helpers shared by every page that renders institute/
 * tracker names from an id (results, notifications, important-dates,
 * home). Previously each page defined its own copy of these two
 * functions — extracted here so there's exactly one implementation.
 */

export function makeLookup(institutes, trackers) {
  return {
    instituteName: (id) => institutes.find((i) => i.id === id)?.name || id,
    trackerLabel: (id) => trackers.find((t) => t.id === id)?.label || id,
  };
}

export function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatCountdown(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}
