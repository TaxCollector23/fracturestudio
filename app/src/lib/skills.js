// skills.js — long-term skill tracking for Fracture.
//
// Turns a saved audit (the report from /api/analyze) into scores for the
// skills that matter in speech & debate, then aggregates those scores across
// past projects into a performance profile: trends, weakest/strongest skills,
// persistent weaknesses, recently-improved skills, and explainable next-step
// recommendations.
//
// Everything here is deterministic and derived from structured audit data —
// no AI memory, no free-form summaries. Skills that an audit has no signal
// for are scored `null` (never forced onto every event).

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export const SKILLS = [
  { id: "argumentation", label: "Argumentation" },
  { id: "organization", label: "Organization" },
  { id: "clarity", label: "Clarity" },
  { id: "rebuttal", label: "Rebuttal" },
  { id: "evidence", label: "Evidence use" },
  { id: "persuasion", label: "Persuasion" },
  { id: "cross-ex", label: "Cross-examination" },
  { id: "delivery", label: "Vocal delivery" },
  { id: "confidence", label: "Confidence" },
  { id: "preparation", label: "Preparation" },
  { id: "pacing", label: "Pacing" },
  { id: "time-management", label: "Time management" }
];

export const skillById = (id) => SKILLS.find((s) => s.id === id) || { id, label: id };

// Which skills each analysis mode can actually score. A skill is only scored
// when the audit carries signal for it AND the mode makes it relevant.
const MODE_SKILLS = {
  argument: ["argumentation", "organization", "clarity", "rebuttal", "evidence", "persuasion", "cross-ex", "preparation", "pacing"],
  speech: ["organization", "clarity", "persuasion", "delivery", "confidence", "pacing", "time-management", "argumentation"],
  essay: ["argumentation", "organization", "clarity", "evidence", "persuasion"],
  "college-essay": ["argumentation", "organization", "clarity", "evidence", "persuasion"],
  "research-paper": ["argumentation", "organization", "clarity", "evidence", "preparation"],
  rubric: ["argumentation", "organization", "clarity", "evidence", "persuasion"],
  "model-un": ["argumentation", "organization", "clarity", "evidence", "persuasion", "delivery", "preparation", "pacing"]
};

export const modeSkillIds = (mode) => MODE_SKILLS[String(mode || "argument").toLowerCase()] || MODE_SKILLS.argument;

// ─── Small helpers ───────────────────────────────────────────────────────────

function arr(v) { return Array.isArray(v) ? v : []; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, Math.round(n))); }
function present(v) { return typeof v === "string" && v.trim().length > 0; }
function countNonEmpty(list) { return arr(list).filter((x) => present(x)).length; }

// ─── Per-skill extractors ────────────────────────────────────────────────────
// Each returns a 0–100 score or null when the audit has no usable signal.

function scoreFromClaims(audit) {
  const claims = arr(audit.claims).length ? audit.claims : arr(audit.argument_strength?.claims);
  if (!claims.length) return null;
  const ratings = claims.map((c) => String(c.rating || "WEAK").toUpperCase()).filter((r) => ["STRONG", "MODERATE", "WEAK"].includes(r));
  if (!ratings.length) return null;
  const strong = ratings.filter((r) => r === "STRONG").length / ratings.length;
  const weak = ratings.filter((r) => r === "WEAK").length / ratings.length;
  // 40 base, +45 for the share that holds up, −25 for the share that breaks.
  return clamp(40 + strong * 45 - weak * 25, 5, 98);
}

function qualitative(list, { base = 45, perItem = 8, cap = 95, empty = null } = {}) {
  const items = arr(list).filter(Boolean);
  if (!items.length) return empty;
  return clamp(base + items.length * perItem, 5, cap);
}

// How "complete" an answer-carrying collection is: items present + share that
// include a response/fix so the drill-like signal (prepared answers) shows up.
function withAnswers(items, answerKeys) {
  const list = arr(items).filter(Boolean);
  if (!list.length) return null;
  const answered = list.filter((item) => answerKeys.some((k) => present(item?.[k]))).length;
  return clamp(40 + answered * 15 + Math.min(list.length, 4) * 6, 5, 96);
}

function extractSkill(audit, skill, mode) {
  switch (skill) {
    case "argumentation": {
      const claims = scoreFromClaims(audit);
      const surv = Number(audit.collapse_point?.survival_probability);
      const survScore = Number.isFinite(surv) ? clamp(surv, 0, 100) : null;
      if (claims == null && survScore == null) return null;
      if (claims == null) return survScore;
      if (survScore == null) return claims;
      return clamp(claims * 0.6 + survScore * 0.4, 5, 98);
    }
    case "organization": {
      const signals = [
        present(audit.rhetorical_analysis?.logical_flow),
        present(audit.structure_analysis?.detected_structure) || present(audit.structure_analysis),
        present(audit.flow_and_transitions),
        present(audit.section_architecture) || arr(audit.paragraph_map).length,
        arr(audit.argument_dependency_graph?.links).length >= 2
      ].filter(Boolean).length;
      if (!signals) return null;
      return clamp(42 + signals * 11, 5, 96);
    }
    case "clarity": {
      const hasAudience = present(audit.audience_clarity?.main_message_obvious)
        || present(audit.audience_clarity)
        || present(audit.clarity_assessment)
        || present(audit.main_point_check?.is_clear_early)
        || present(audit.hook_analysis?.assessment)
        || present(audit.rhetorical_analysis?.opening_hook);
      if (!hasAudience) return null;
      // A weakest sentence with a concrete fix is normal; a thesis judged
      // unclear drags clarity down.
      let score = 55;
      const thesis = audit.thesis?.assessment || audit.argument_strength?.thesis?.assessment;
      if (present(thesis) && /(unclear|vague|too broad|confus|not.*specific)/i.test(thesis)) score -= 14;
      if (present(audit.rhetorical_analysis?.weakest_sentence?.fix)) score += 8;
      if (arr(audit.audience_clarity?.confusing_terms).length) score -= 6;
      if (arr(audit.audience_questions).length) score += 8;
      return clamp(score, 5, 96);
    }
    case "rebuttal": {
      const tree = arr(audit.attack_tree);
      const counters = arr(audit.counter_arguments);
      const prep = audit.mode_analysis?.rebuttal_prep || audit.rebuttal_prep || {};
      const hasPrep = present(prep.strongest_rebuttal?.attack) || present(prep.strongest_rebuttal);
      if (!tree.length && !counters.length && !hasPrep) return null;
      const answered = tree.some((t) => present(t.response) || present(t.how_to_answer))
        || counters.some((c) => present(c.suggested_rebuttal) || present(c.response));
      const breadth = Math.max(tree.length, counters.length, hasPrep ? 3 : 0);
      return clamp(38 + Math.min(breadth, 4) * 8 + (answered ? 16 : 0) + (hasPrep ? 8 : 0), 5, 97);
    }
    case "evidence": {
      const sv = audit.source_verification_report;
      const summary = sv?.summary || {};
      const checked = Number(summary.likely_supported) || 0;
      const flagged = (Number(summary.needs_source_review) || 0) + (Number(summary.citation_incomplete) || 0)
        + (Number(summary.source_not_found) || 0) + (Number(summary.partial_match) || 0) + (Number(summary.quote_not_supported) || 0);
      const total = checked + flagged;
      let score = null;
      if (total > 0) score = clamp(checked / total * 100 - (total > 4 && flagged > checked ? 8 : 0), 5, 98);
      const researchSignals = [
        arr(audit.truth_audit).length,
        arr(audit.evidence_integration).length,
        arr(audit.citation_coverage_map).length,
        arr(audit.missing_citation_flags).length,
        arr(audit.source_pack).length
      ].reduce((a, b) => a + b, 0);
      if (score == null && !researchSignals) return null;
      if (score == null) return clamp(40 + researchSignals * 6, 5, 92);
      if (researchSignals) return clamp(score * 0.7 + (40 + researchSignals * 6) * 0.3, 5, 98);
      return score;
    }
    case "persuasion": {
      const ra = audit.rhetorical_analysis || {};
      const hasSignal = present(ra.persuasion_assessment) || present(audit.persuasion_check)
        || arr(audit.strengths).length || present(ra.strongest_sentence?.why);
      if (!hasSignal) return null;
      const strengths = arr(audit.strengths);
      let score = 50 + Math.min(strengths.length, 3) * 8;
      if (present(audit.persuasion_check?.overall)) score += 6;
      if (present(ra.strongest_sentence?.why)) score += 6;
      if (present(audit.memorability_check?.suggested_memorable_line)) score += 6;
      if (present(audit.call_to_action?.stronger_ending)) score += 6;
      return clamp(score, 5, 96);
    }
    case "cross-ex": {
      const tree = arr(audit.attack_tree);
      const hasCrossfire = tree.some((t) => present(t.crossfire_question))
        || present(audit.counterargument?.how_to_answer)
        || present(audit.mode_analysis?.rebuttal_prep?.strongest_rebuttal?.how_to_answer);
      if (!hasCrossfire && !tree.length) return null;
      const qCount = tree.filter((t) => present(t.crossfire_question)).length;
      return clamp(42 + qCount * 12 + (present(audit.counterargument?.how_to_answer) ? 10 : 0), 5, 95);
    }
    case "delivery": {
      const markup = arr(audit.delivery_markup);
      const risks = arr(audit.delivery_risks);
      const coach = audit.speech_coach || audit.mode_analysis?.speech_coach;
      if (!markup.length && !risks.length && !present(coach?.delivery_notes)) return null;
      const haveMarkup = markup.length > 0 || present(coach?.delivery_notes);
      return clamp(48 + (haveMarkup ? 18 : 0) + Math.min(risks.length, 3) * 6 - (risks.length >= 4 ? 6 : 0), 5, 95);
    }
    case "confidence": {
      const risks = arr(audit.delivery_risks);
      const markup = arr(audit.delivery_markup);
      const cta = audit.call_to_action;
      if (!risks.length && !markup.length && cta?.present !== true) return null;
      let score = 50;
      if (markup.length) score += 10;          // knows how to deliver
      if (present(cta?.stronger_ending)) score += 10; // has a practiced ending
      if (risks.length === 0) score += 10;      // nothing flagged as a delivery trip
      else if (risks.length <= 2) score += 4;
      else score -= 10;
      return clamp(score, 5, 95);
    }
    case "preparation": {
      const ma = audit.mode_analysis || {};
      const signals = [
        present(ma.stock_issues) || arr(ma.stock_issues).length,
        present(ma.burden_analysis),
        arr(ma.extra_arguments).length,
        arr(audit.extra_arguments).length,
        present(audit.delegate_brief?.country_stance),
        arr(audit.strategy_map?.best_caucus_topics).length,
        present(audit.literature_review_audit?.assessment),
        present(audit.research_question_audit?.assessment)
      ].filter(Boolean).length;
      if (!signals) return null;
      const missing = arr(ma.extra_arguments).length + arr(audit.extra_arguments).length;
      return clamp(42 + signals * 9 - Math.min(missing, 4) * 4, 5, 95);
    }
    case "pacing": {
      // Speech/modelling signals: delivery markup with pacing cues or fit-to-time notes.
      const markup = arr(audit.delivery_markup).filter((m) => present(m.annotated) && /(pause|slow|pace)/i.test(m.annotated || ""));
      const fit = audit.speech_coach?.fit_to_time || audit.mode_analysis?.speech_coach?.fit_to_time;
      if (!markup.length && !present(fit)) return null;
      let score = 48 + Math.min(markup.length, 3) * 9;
      if (present(fit)) score += 12;
      return clamp(score, 5, 95);
    }
    case "time-management": {
      const fit = audit.speech_coach?.fit_to_time || audit.mode_analysis?.speech_coach?.fit_to_time;
      const cta = audit.call_to_action;
      if (!present(fit) && cta?.present !== true) return null;
      let score = 52;
      if (present(fit)) score += 18;
      if (cta?.present === true) score += 10;
      return clamp(score, 5, 95);
    }
    default:
      return null;
  }
}

/**
 * Score one audit against the skills relevant to its mode.
 * Returns { [skillId]: { score, confidence } } — skills without signal are omitted.
 */
export function auditSkillScores(audit, mode) {
  const a = audit && typeof audit === "object" ? audit : {};
  const out = {};
  for (const skillId of modeSkillIds(mode)) {
    const score = extractSkill(a, skillId, mode);
    if (score == null) continue;
    // Confidence rises with how many distinct signals fed the score; we keep a
    // coarse 0.5–1 proxy so downstream consumers can weigh recent data lightly.
    out[skillId] = { score, confidence: 0.75 };
  }
  return out;
}

// ─── Profile aggregation ─────────────────────────────────────────────────────

function toDate(value) {
  if (!value) return null;
  // Firestore Timestamp
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Aggregate saved projects (each: { id, title, draft, audit, score, mode,
 * createdAt, updatedAt }) into a performance profile.
 */
export function computeProfile(projects) {
  const list = arr(projects)
    .map((p) => ({ ...p, date: toDate(p.createdAt || p.updatedAt) || new Date(0) }))
    .filter((p) => p.audit && typeof p.audit === "object")
    .sort((a, b) => a.date - b.date);

  const series = {};        // skillId -> [{date, score}]
  const modeCount = {};
  const scoreSeries = [];
  const fixCounts = [];

  for (const p of list) {
    const scores = auditSkillScores(p.audit, p.mode);
    for (const [skillId, entry] of Object.entries(scores)) {
      (series[skillId] = series[skillId] || []).push({ date: p.date, score: entry.score });
    }
    modeCount[p.mode || "argument"] = (modeCount[p.mode || "argument"] || 0) + 1;
    if (typeof p.score === "number") scoreSeries.push({ date: p.date, score: p.score });
    const fixes = arr(p.audit.priority_fixes).filter((f) => present(f.problem)).length;
    if (fixes > 0) fixCounts.push({ date: p.date, count: fixes });
  }

  const skills = {};
  for (const s of SKILLS) {
    const points = series[s.id] || [];
    if (!points.length) { skills[s.id] = null; continue; }
    const last = points[points.length - 1].score;
    const prev = points.length >= 2 ? points[points.length - 2].score : null;
    const recent = points.slice(-5).map((p) => p.score);
    const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
    const delta = prev == null ? null : last - prev;
    skills[s.id] = {
      count: points.length,
      last,
      prev,
      avg,
      delta,
      trend: delta == null ? "new" : delta > 4 ? "up" : delta < -4 ? "down" : "flat",
      best: Math.max(...recent),
      worst: Math.min(...recent)
    };
  }

  const scored = Object.entries(skills).filter(([, v]) => v != null);
  const weakest = scored.length ? scored.slice().sort((a, b) => a[1].avg - b[1].avg)[0] : null;
  const strongest = scored.length ? scored.slice().sort((a, b) => b[1].avg - a[1].avg)[0] : null;

  const recentlyImproved = scored
    .filter(([, v]) => v.delta != null && v.delta >= 5)
    .sort((a, b) => b[1].delta - a[1].delta)
    .slice(0, 3);

  const persistentWeaknesses = scored
    .filter(([, v]) => v.count >= 2 && v.avg < 45)
    .sort((a, b) => a[1].avg - b[1].avg);

  const lastScore = scoreSeries.length ? scoreSeries[scoreSeries.length - 1].score : null;
  const prevScore = scoreSeries.length >= 2 ? scoreSeries[scoreSeries.length - 2].score : null;

  const overallAvg = scored.length
    ? Math.round(scored.reduce((sum, [, v]) => sum + v.avg, 0) / scored.length)
    : null;

  const allScores = scoreSeries.map((s) => s.score);
  const scoreAvg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

  return {
    sessions: list.length,
    projects: list,
    skills,
    weakest: weakest ? { id: weakest[0], ...weakest[1] } : null,
    strongest: strongest ? { id: strongest[0], ...strongest[1] } : null,
    recentlyImproved: recentlyImproved.map(([id, v]) => ({ id, ...v })),
    persistentWeaknesses: persistentWeaknesses.map(([id, v]) => ({ id, ...v })),
    lastScore,
    prevScore,
    scoreDelta: prevScore == null || lastScore == null ? null : lastScore - prevScore,
    scoreAvg,
    modes: modeCount,
    mostPracticedMode: Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    totalFixes: fixCounts.reduce((a, b) => a + b.count, 0),
    overallAvg
  };
}

export function levelForProfile(profile) {
  if (!profile || profile.overallAvg == null) return "beginner";
  if (profile.overallAvg >= 80) return "competitive";
  if (profile.overallAvg >= 62) return "advanced";
  if (profile.overallAvg >= 45) return "intermediate";
  return "beginner";
}

// ─── Explainable recommendations ─────────────────────────────────────────────

const SKILL_DRILL_HINT = {
  rebuttal: "Practice responding under pressure",
  "cross-ex": "Practice fielding judge questions",
  evidence: "Practice sorting evidence from opinion",
  organization: "Practice structuring on the fly",
  clarity: "Practice signposting and plain statements",
  argumentation: "Practice building claim-warrant-impact chains",
  persuasion: "Practice openings and closings that land",
  delivery: "Practice vocal delivery and markup",
  confidence: "Practice impromptu speaking",
  preparation: "Practice extemp-style prep under a time limit",
  pacing: "Practice pacing a timed speech",
  "time-management": "Practice managing a timed speech"
};

/**
 * Returns an ordered list of explainable recommendations.
 * options: { profile, drills, completedDrills, goals, today, role }
 * Each item: { title, why, action: { type: "route"|"drill"|"audit", target, label } }
 */
export function recommendNext({ profile, drills, completedDrills = [], goals = [], today = new Date() }) {
  const recs = [];
  const done = new Set(completedDrills || []);
  const activeGoals = (goals || []).filter((g) => g.status !== "done" && g.status !== "archived");

  // 1. Tournament-style goal with a near deadline → full simulation.
  const upcoming = activeGoals
    .map((g) => ({ goal: g, days: daysUntil(g.targetDate, today) }))
    .filter((x) => x.days != null && x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
  if (upcoming && upcoming.days <= 5) {
    recs.push({
      title: `Run a full round simulation — "${upcoming.goal.text}" is in ${upcoming.days === 0 ? "today" : `${upcoming.days} ${upcoming.days === 1 ? "day" : "days"}`}`,
      why: "Your own goal sets the deadline; a full audit is the closest thing to a judge's ballot before the real round.",
      action: { type: "audit", label: "Run a full audit" }
    });
  }

  // 2. Weakest scored skill with an undone drill.
  if (profile?.weakest) {
    const skill = profile.weakest.id;
    const match = (drills || []).find((d) => d.skills.includes(skill) && !done.has(d.id));
    if (match) {
      recs.push({
        title: `${skillById(skill).label} is your weakest recent category — ${match.title.toLowerCase()} is the fix`,
        why: `Average ${skillById(skill).label.toLowerCase()} score across your last sessions: ${profile.weakest.avg}/100, lowest of every tracked skill.`,
        action: { type: "drill", target: match.id, label: `Start ${match.title}` }
      });
    } else {
      recs.push({
        title: `Your weakest recent category is ${skillById(skill).label.toLowerCase()} — practice it next`,
        why: `Average ${skillById(skill).label.toLowerCase()} score: ${profile.weakest.avg}/100 — the lowest of every tracked skill.`,
        action: { type: "route", target: "/practice", label: "Browse drills" }
      });
    }
  }

  // 3. Skills the user used to train but hasn't touched recently.
  if (profile?.projects?.length) {
    const last7 = today.getTime() - 7 * 86400000;
    const activeSkills = new Set();
    for (const p of profile.projects) {
      if (p.date && p.date.getTime() >= last7) {
        for (const id of modeSkillIds(p.mode)) activeSkills.add(id);
      }
    }
    const stale = SKILLS.filter((s) => !activeSkills.has(s.id) && SKILL_DRILL_HINT[s.id]);
    if (stale.length && recs.length < 3) {
      const pick = stale[0];
      const match = (drills || []).find((d) => d.skills.includes(pick.id) && !done.has(d.id));
      recs.push({
        title: match ? `You haven't practiced ${pick.label.toLowerCase()} in a while — ${match.title.toLowerCase()}` : `You haven't practiced ${pick.label.toLowerCase()} in a while`,
        why: "No practice in that skill area within the last 7 days based on the events you've run.",
        action: match
          ? { type: "drill", target: match.id, label: `Start ${match.title}` }
          : { type: "route", target: "/practice", label: "Browse drills" }
      });
    }
  }

  // 4. Momentum: keep improving something that's trending up.
  if (profile?.recentlyImproved?.length && recs.length < 3) {
    const s = profile.recentlyImproved[0];
    recs.push({
      title: `${skillById(s.id).label} is trending up (${s.delta > 0 ? "+" : ""}${s.delta} in your last two sessions) — protect the gains`,
      why: "Skills that improve and then sit unused tend to regress; one more session cements the habit.",
      action: { type: "route", target: "/studio", label: "Run another audit" }
    });
  }

  // 5. Fallback.
  if (!recs.length) {
    recs.push({
      title: profile?.sessions
        ? "Run a fresh audit to keep your progress profile current"
        : "Run your first audit to build a progress profile",
      why: profile?.sessions
        ? "Your profile is built from structured audit data — each session sharpens the recommendations."
        : "Once you save 2–3 audits, Fracture starts tracking skills, trends, and weaknesses.",
      action: { type: "route", target: "/studio", label: "Open the Studio" }
    });
  }

  return recs;
}

export function daysUntil(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - start) / 86400000);
}
