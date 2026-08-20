// feedback.js — let users correct AI feedback and report product issues.
//
// Two channels, both with a localStorage fallback so guests can participate:
//   1. Report ratings — "was this report correct?" (correct / partially
//      correct / incorrect / not useful) keyed by project.
//   2. Issue reports — bugs, confusing features, feature requests, and
//      incorrect automated feedback, with captured context.

export const RATING_OPTIONS = [
  { id: "correct", label: "Correct", cls: "text-green-600 dark:text-green-400" },
  { id: "partial", label: "Partially correct", cls: "text-amber-600 dark:text-amber-400" },
  { id: "incorrect", label: "Incorrect", cls: "text-red-500 dark:text-red-400" },
  { id: "not-useful", label: "Not useful", cls: "text-zinc-500 dark:text-zinc-400" }
];

export const ISSUE_TYPES = [
  { id: "bug", label: "Bug" },
  { id: "confusing", label: "Confusing feature" },
  { id: "request", label: "Feature request" },
  { id: "incorrect-feedback", label: "Incorrect automated feedback" }
];

const RATING_KEY = "fracture_report_ratings";

export function loadLocalRatings() {
  try { return JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); } catch (_) { return {}; }
}

/** Local-only rating; returns the stored record. */
export function rateReportLocally(projectKey, value, note = "") {
  const all = loadLocalRatings();
  all[projectKey] = { value, note, ratedAt: Date.now() };
  localStorage.setItem(RATING_KEY, JSON.stringify(all));
  return all[projectKey];
}

export function getLocalRating(projectKey) {
  return loadLocalRatings()[projectKey] || null;
}

// Firestore-backed versions live in firebase.js (saveReportRating /
// saveFeedbackIssue); this module keeps the shape + fallbacks together.
export function ratingValueLabel(value) {
  return RATING_OPTIONS.find((r) => r.id === value)?.label || value;
}
