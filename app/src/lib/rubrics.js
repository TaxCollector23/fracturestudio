// rubrics.js — reusable rubric definitions for the competition layer.
//
// Rubrics are plain data: a name, a list of scored categories (id, label,
// max points, optional weight), and a decision scheme. Events reference a
// rubric by id; tournaments may define custom rubrics. Ballots snapshot the
// rubric at submission time so later rubric changes never corrupt history.

export const CATEGORY_MAX = 30;

// Decision schemes tell the ballot form and the results engine how a judge
// decides the round:
//   win-loss : pick a side/participant that wins (typical speech ballots)
//   rank     : rank the participants 1..N (typical congress / impromptu)
//   score    : decide purely from the score (rare; defaults to highest score)
export const DECISION_TYPES = [
  { id: "win-loss", label: "Win / loss", hint: "The judge names a winner." },
  { id: "rank", label: "Ranking", hint: "The judge ranks every participant 1st, 2nd, 3rd…" },
  { id: "score", label: "Score only", hint: "The highest total score wins." }
];

// Catalog of rubrics keyed by format id. `defaultCategories` is a set of
// categories that fit most speech/debate events; the catalog entries extend
// or override it per event.
const DEFAULT_CATEGORIES = [
  { id: "argumentation", label: "Argumentation", max: CATEGORY_MAX },
  { id: "evidence", label: "Evidence & support", max: CATEGORY_MAX },
  { id: "organization", label: "Organization", max: CATEGORY_MAX },
  { id: "delivery", label: "Delivery", max: CATEGORY_MAX },
  { id: "rebuttal", label: "Rebuttal", max: CATEGORY_MAX }
];

export const RUBRICS = {
  "public-forum": {
    id: "public-forum",
    name: "Public Forum",
    decisionType: "win-loss",
    categories: [
      { id: "argumentation", label: "Argumentation", max: CATEGORY_MAX },
      { id: "evidence", label: "Evidence & support", max: CATEGORY_MAX },
      { id: "organization", label: "Organization", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX },
      { id: "rebuttal", label: "Refutation & clash", max: CATEGORY_MAX },
      { id: "teamwork", label: "Teamwork & crossfire", max: CATEGORY_MAX }
    ]
  },
  "ld": {
    id: "ld",
    name: "Lincoln-Douglas",
    decisionType: "win-loss",
    categories: [
      { id: "argumentation", label: "Argumentation", max: CATEGORY_MAX },
      { id: "value", label: "Value & criterion", max: CATEGORY_MAX },
      { id: "evidence", label: "Evidence", max: CATEGORY_MAX },
      { id: "rebuttal", label: "Refutation", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX }
    ]
  },
  "policy": {
    id: "policy",
    name: "Policy Debate",
    decisionType: "win-loss",
    categories: [
      { id: "argumentation", label: "Argumentation", max: CATEGORY_MAX },
      { id: "evidence", label: "Evidence", max: CATEGORY_MAX },
      { id: "organization", label: "Organization", max: CATEGORY_MAX },
      { id: "rebuttal", label: "Refutation", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX }
    ]
  },
  "congress": {
    id: "congress",
    name: "Congressional Debate",
    decisionType: "rank",
    categories: [
      { id: "argumentation", label: "Argumentation", max: CATEGORY_MAX },
      { id: "evidence", label: "Evidence", max: CATEGORY_MAX },
      { id: "questioning", label: "Questioning", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX },
      { id: "parliamentary", label: "Parliamentary procedure", max: CATEGORY_MAX }
    ]
  },
  "oratory": {
    id: "oratory",
    name: "Original Oratory",
    decisionType: "rank",
    categories: [
      { id: "content", label: "Content & message", max: CATEGORY_MAX },
      { id: "structure", label: "Structure", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX },
      { id: "language", label: "Language & style", max: CATEGORY_MAX }
    ]
  },
  "extemp": {
    id: "extemp",
    name: "Extemporaneous Speaking",
    decisionType: "rank",
    categories: [
      { id: "analysis", label: "Analysis", max: CATEGORY_MAX },
      { id: "evidence", label: "Evidence & sources", max: CATEGORY_MAX },
      { id: "organization", label: "Organization", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX }
    ]
  },
  "impromptu": {
    id: "impromptu",
    name: "Impromptu",
    decisionType: "rank",
    categories: [
      { id: "structure", label: "Structure", max: CATEGORY_MAX },
      { id: "delivery", label: "Delivery", max: CATEGORY_MAX },
      { id: "creativity", label: "Creativity", max: CATEGORY_MAX }
    ]
  },
  "custom": {
    id: "custom",
    name: "Custom rubric",
    decisionType: "win-loss",
    categories: [...DEFAULT_CATEGORIES]
  }
};

export const rubricById = (id) => RUBRICS[id] || RUBRICS.custom;

/** Deep-copy a rubric so a ballot owns its snapshot and edits never leak back. */
export function snapshotRubric(rubric) {
  return JSON.parse(JSON.stringify(rubric || RUBRICS.custom));
}

/** A fresh empty ballot shape for a rubric + round. */
export function blankBallot({ rubric, roundId, eventId, judgeId, participantIds = [], decisionType } = {}) {
  const r = rubric || RUBRICS.custom;
  return {
    roundId: roundId || "",
    eventId: eventId || "",
    judgeId: judgeId || "",
    status: "draft",
    rubricSnapshot: snapshotRubric(r),
    scores: {},
    comments: {},
    feedback: "",
    decision: "",
    decisionType: decisionType || r.decisionType || "win-loss",
    rank: null,
    reason: "",
    submittedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function categoryTotal(category, score) {
  const n = Number(score);
  return Number.isFinite(n) ? Math.max(0, Math.min(Number(category?.max) || CATEGORY_MAX, n)) : null;
}

/** Sum a ballot's category scores (ignores categories the rubric doesn't have). */
export function ballotTotal(ballot) {
  const cats = ballot?.rubricSnapshot?.categories || [];
  return cats.reduce((sum, c) => sum + (categoryTotal(c, ballot?.scores?.[c.id]) || 0), 0);
}

/** True when every category in the rubric snapshot has a numeric score. */
export function scoresComplete(ballot) {
  const cats = ballot?.rubricSnapshot?.categories || [];
  if (!cats.length) return false;
  return cats.every((c) => categoryTotal(c, ballot?.scores?.[c.id]) != null);
}

/**
 * Validate a ballot before submission. Returns a list of issues:
 * { field, message } — never throws, never silently rejects.
 */
export function validateBallot(ballot) {
  const issues = [];
  const cats = ballot?.rubricSnapshot?.categories || [];

  if (!ballot?.roundId) issues.push({ field: "round", message: "No round is attached to this ballot." });
  if (!ballot?.judgeId) issues.push({ field: "judge", message: "No judge is attached to this ballot." });

  for (const c of cats) {
    // Validate the raw value, not a clamped one: an out-of-range score must
    // be reported back to the judge, never silently fixed.
    const raw = ballot?.scores?.[c.id];
    if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw))) {
      issues.push({ field: "scores." + c.id, message: `Missing score for “${c.label}”.` });
    } else if (Number(raw) < 0 || Number(raw) > Number(c.max)) {
      issues.push({ field: "scores." + c.id, message: `“${c.label}” score ${Number(raw)} is outside the ${c.max}-point range.` });
    }
  }

  const dt = ballot?.decisionType || "win-loss";
  if (dt === "win-loss" && !ballot?.decision) {
    issues.push({ field: "decision", message: "Pick the winner before submitting." });
  }
  if (dt === "rank" && !ballot?.rank) {
    issues.push({ field: "rank", message: "Provide the ranking (which participant is 1st)." });
  }
  if (dt === "rank" && ballot?.rank) {
    const rank = Number(ballot.rank);
    if (!Number.isFinite(rank) || rank < 1) {
      issues.push({ field: "rank", message: "Rank must be a positive number (1st, 2nd, …)." });
    }
  }

  if (!String(ballot?.feedback || "").trim()) {
    issues.push({ field: "feedback", message: "Add written feedback before submitting — judges explain their decision." });
  }

  return issues;
}
