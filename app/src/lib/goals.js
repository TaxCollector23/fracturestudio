// goals.js — user goals + the adaptive training plan.
//
// Goals are plain structured records (text, target date, event, priority,
// status). The training plan is *derived* from current state every time it is
// viewed — goals, weakest skills, recent practice, and the drill catalog — so
// it adapts as the user completes activities instead of being a static list.

export const GOAL_PRIORITIES = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" }
];

export const GOAL_TEMPLATES = [
  "Improve my weakest skill",
  "Prepare for an upcoming tournament",
  "Raise my average audit score",
  "Practice my event regularly"
];

export function newGoal(partial = {}) {
  const now = new Date().toISOString();
  return {
    text: "",
    event: "",          // format id (argument, speech, …)
    targetDate: "",     // yyyy-mm-dd
    priority: "medium",
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...partial
  };
}

// ─── Guest (localStorage) storage ────────────────────────────────────────────

const LOCAL_KEY = "fracture_goals";

export function loadLocalGoals() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (_) { return []; }
}

export function saveLocalGoal(goal) {
  const all = loadLocalGoals();
  const idx = all.findIndex((g) => g.id === goal.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...goal, updatedAt: new Date().toISOString() };
  else all.unshift(goal);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  return goal;
}

export function removeLocalGoal(id) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(loadLocalGoals().filter((g) => g.id !== id)));
}

// ─── Training plan ───────────────────────────────────────────────────────────

const ROTATION = ["cross-ex", "delivery", "evidence", "organization", "pacing"];

/**
 * Build the next 5 practice days from live state.
 * options: { profile, goals, drills, completed, today, event }
 * Returns [{ day, title, why, action }].
 */
export function buildTrainingPlan({ profile, goals = [], drills = [], completed = [], today = new Date(), event = "" } = {}) {
  const plan = [];
  const done = new Set(completed || []);
  const activeGoals = goals.filter((g) => g.status !== "done" && g.status !== "archived");
  const primaryGoal = activeGoals.sort((a, b) => (a.priority === "high" ? -1 : 1))[0] || null;
  const goalEvent = primaryGoal?.event || event;

  // Rank skills to train: goal's event skills first, then profile weaknesses.
  const weakOrder = profile?.persistentWeaknesses?.length
    ? profile.persistentWeaknesses.map((w) => w.id)
    : [];
  if (profile?.weakest && !weakOrder.includes(profile.weakest.id)) weakOrder.unshift(profile.weakest.id);
  if (profile?.recentlyImproved?.length) {
    // Keep improving skills that moved — they're the ones where effort pays.
    for (const r of profile.recentlyImproved) if (!weakOrder.includes(r.id)) weakOrder.push(r.id);
  }
  const fallbackOrder = ["argumentation", "rebuttal", "evidence", "organization", "clarity", "persuasion"];

  const skillForIndex = (i) => {
    const primary = weakOrder[i % Math.max(weakOrder.length, 1)] || fallbackOrder[i % fallbackOrder.length];
    // Never repeat the same skill twice in a row.
    return plan.some((p) => p.skill === primary) ? ROTATION[i % ROTATION.length] : primary;
  };

  const pickDrill = (skillId) => drills.find((d) => d.skills.includes(skillId) && !done.has(d.id)) || drills.find((d) => d.skills.includes(skillId));

  const focus = (goalEvent ? ` (${goalEvent})` : "");

  // Day 1 — baseline or first weakness.
  const d1skill = profile?.sessions >= 2 ? skillForIndex(0) : null;
  const d1drill = d1skill ? pickDrill(d1skill) : null;
  plan.push({
    day: "Day 1",
    title: d1drill
      ? `Baseline + ${d1drill.title.toLowerCase()}`
      : profile?.sessions >= 2 ? "Re-audit your current draft" : "Baseline practice — first audit",
    why: profile?.sessions >= 2
      ? `${skillForIndexLabel(d1skill)} is the biggest gap in your recent profile, so we open with it.`
      : "A baseline audit gives the whole plan something to measure against.",
    skill: d1skill || null,
    action: d1drill
      ? { type: "drill", target: d1drill.id, label: `Start ${d1drill.title}` }
      : { type: "route", target: "/studio", label: "Open the Studio" }
  });

  // Day 2 — second weakness or a rotating skill.
  const d2skill = skillForIndex(1);
  const d2drill = pickDrill(d2skill);
  plan.push({
    day: "Day 2",
    title: d2drill ? `${d2drill.title} — focused drill` : "Focused practice",
    why: `Second priority: ${skillForIndexLabel(d2skill)}. Rotating skills keeps the profile balanced.`,
    skill: d2skill,
    action: d2drill
      ? { type: "drill", target: d2drill.id, label: `Start ${d2drill.title}` }
      : { type: "route", target: "/practice", label: "Browse drills" }
  });

  // Day 3 — focused audit on the goal's event (or keep drilling).
  plan.push({
    day: "Day 3",
    title: primaryGoal ? `Focused audit for "${primaryGoal.text}"${focus}` : "Focused audit — rework yesterday's draft",
    why: primaryGoal
      ? `Your active goal targets ${goalEvent || "your event"}; a full audit on that format is the highest-signal practice.`
      : "Re-running the audit on a revised draft shows whether last week's fixes landed.",
    skill: null,
    action: { type: "route", target: "/studio", label: "Run an audit" }
  });

  // Day 4 — timed practice (impromptu/extemp-style) to pressure-test.
  const timed = drills.find((d) => ["impromptu-60", "extemp-15", "crossfire-round"].includes(d.id) && !done.has(d.id))
    || drills.find((d) => ["impromptu-60", "extemp-15", "crossfire-round"].includes(d.id));
  plan.push({
    day: "Day 4",
    title: timed ? `${timed.title} — timed practice` : "Timed practice",
    why: "Under a clock is where preparation becomes performance — pacing and recovery are the skills that show up on stage.",
    skill: timed?.skills?.[0] || "pacing",
    action: timed ? { type: "drill", target: timed.id, label: `Start ${timed.title}` } : { type: "route", target: "/practice", label: "Browse drills" }
  });

  // Day 5 — full simulation.
  const sim = drills.find((d) => d.id === "timed-case-defense" && !done.has(d.id));
  plan.push({
    day: "Day 5",
    title: primaryGoal && dueSoon(primaryGoal.targetDate, today)
      ? "Full round simulation — tournament is close"
      : "Full round simulation",
    why: "A complete, timed simulation is the closest proxy for the real round — this is the day the plan has been building toward.",
    skill: "rebuttal",
    action: sim
      ? { type: "drill", target: sim.id, label: "Start Timed Case Defense" }
      : { type: "route", target: "/studio", label: "Run an extreme-depth audit" }
  });

  return plan;
}

function skillForIndexLabel(id) {
  // Avoid a circular import with skills.js; label via a tiny local map.
  const LABELS = {
    argumentation: "Argumentation", organization: "Organization", clarity: "Clarity",
    rebuttal: "Rebuttal", evidence: "Evidence use", persuasion: "Persuasion",
    "cross-ex": "Cross-examination", delivery: "Vocal delivery", confidence: "Confidence",
    preparation: "Preparation", pacing: "Pacing", "time-management": "Time management"
  };
  return LABELS[id] || id;
}

export function dueSoon(dateStr, today = new Date()) {
  if (!dateStr) return false;
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return false;
  const ms = d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return ms >= 0 && ms <= 5 * 86400000;
}
