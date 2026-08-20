// Small presentational helpers shared across pages and report components.
// Kept dependency-free so any component can import them.

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function scoreLabel(s) {
  if (s == null) return "";
  if (s >= 95) return "Outstanding";
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Solid";
  if (s >= 50) return "Needs work";
  return "Breaks down";
}

/** "argument_strength" → "Argument Strength", "and" → "&". */
export function prettyLabel(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\band\b/g, "&")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Turn a score_breakdown object into bars normalized to the largest value.
 * Only finite numeric values are included; returns [] when there is nothing
 * to draw.
 */
export function breakdownBars(breakdown) {
  // Strict: only real numbers draw bars (null/empty strings stay invisible).
  const entries = Object.entries(breakdown || {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v));
  if (!entries.length) return [];
  const max = Math.max(...entries.map(([, v]) => Number(v)));
  return entries.map(([k, v]) => ({
    key: k,
    label: prettyLabel(k),
    value: Number(v),
    width: max > 0 ? Math.max(4, Math.round((Number(v) / max) * 100)) : 0
  }));
}
