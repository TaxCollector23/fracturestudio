// research.js — the research intelligence layer.
//
// Builds on the existing prep data layer (same per-user store) but owns the
// research-specific entities: sources, excerpts, research questions,
// collections, research tasks, and evidence conflicts. Relationships stay
// explicit via denormalized id arrays (the existing convention): sources →
// topicIds, evidence → sourceId/caseIds/blockIds, questions → sourceIds/
// evidenceIds, etc. Pure, testable functions only — no storage access here.

import { citationIssues, formatCitation, bibliographySortKey } from "./citations.js";

// ─── Constants ───────────────────────────────────────────────────────────────

export const SOURCE_TYPES = [
  { id: "news", label: "News article" },
  { id: "academic", label: "Academic paper" },
  { id: "government", label: "Government publication" },
  { id: "report", label: "Report" },
  { id: "book", label: "Book" },
  { id: "website", label: "Website" },
  { id: "organization", label: "Organization" },
  { id: "journal", label: "Journal article" },
  { id: "dataset", label: "Dataset" },
  { id: "interview", label: "Interview" },
  { id: "other", label: "Other" }
];

export const TOPIC_STATUSES = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "completed", label: "Completed" }
];

export const QUESTION_STATUSES = [
  { id: "unanswered", label: "Unanswered" },
  { id: "researching", label: "Researching" },
  { id: "partially-answered", label: "Partially answered" },
  { id: "answered", label: "Answered" }
];

export const QUESTION_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" }
];

export const EVIDENCE_TYPES = [
  { id: "statistic", label: "Statistic" },
  { id: "expert-opinion", label: "Expert opinion" },
  { id: "study-finding", label: "Study finding" },
  { id: "historical-example", label: "Historical example" },
  { id: "policy-evidence", label: "Policy evidence" },
  { id: "definition", label: "Definition" },
  { id: "comparison", label: "Comparison" },
  { id: "causal-evidence", label: "Causal evidence" },
  { id: "impact-evidence", label: "Impact evidence" },
  { id: "other", label: "Other" }
];

export const CONFLICT_TYPES = [
  { id: "supporting", label: "Supporting" },
  { id: "conflicting", label: "Conflicting" },
  { id: "related", label: "Related" },
  { id: "different-scope", label: "Different scope" },
  { id: "different-methodology", label: "Different methodology" }
];

export const TASK_STATUSES = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" }
];

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label || id;

// ─── Factories ───────────────────────────────────────────────────────────────

export function newSource(partial = {}) {
  return {
    title: "", url: "", canonicalUrl: "", doi: "", pages: "",
    authors: [], publication: "", publisher: "", publishDate: "", accessDate: "",
    sourceType: "news", description: "", tags: [], topicIds: [], collectionIds: [],
    notes: "", archived: false, favorite: false,
    provenance: {},            // { field: "extracted" | "user" | "imported" }
    extracted: null,           // { ok, at, from, error? } — metadata extraction result
    quality: {                 // structured credibility context
      primarySecondary: "",    // primary | secondary | ""
      orgType: "",             // government | academic | journalistic | organizational | other
      conflictsOfInterest: "",
      methodology: "",
      assessmentNotes: "",
      assessmentBasis: ""
    },
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newExcerpt(partial = {}) {
  return {
    quote: "", location: "", page: "", section: "", notes: "",
    tags: [], sourceId: "", questionId: "", evidenceIds: [],
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newResearchQuestion(partial = {}) {
  return {
    question: "", description: "", priority: "medium", status: "unanswered",
    topicIds: [], tags: [], sourceIds: [], evidenceIds: [], blockIds: [], caseIds: [],
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newResearchCollection(partial = {}) {
  return {
    name: "", description: "", topicIds: [], sourceIds: [], evidenceIds: [],
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newResearchTask(partial = {}) {
  return {
    title: "", priority: "medium", status: "open",
    topicId: "", questionId: "", blockId: "", caseId: "", sourceId: "", notes: "",
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newConflict(partial = {}) {
  return {
    type: "conflicting", evidenceAId: "", evidenceBId: "", notes: "",
    createdAt: "", updatedAt: "", ...partial
  };
}

// ─── Source helpers ──────────────────────────────────────────────────────────

export const sourceTypeLabel = (id) => labelOf(SOURCE_TYPES, id);

export function authorNames(source) {
  return (source?.authors || []).filter((a) => a?.name).map((a) => a.name);
}

/** Flat "Author / Publication / Date" line for list rows. */
export function sourceAttribution(source) {
  const a = authorNames(source);
  const pub = source?.publication || "";
  const d = source?.publishDate ? source.publishDate.slice(0, 7) : "";
  return [a.join(", "), pub, d].filter(Boolean).join(" · ") || "No attribution yet";
}

export function hostOf(url) {
  try { return new URL(String(url || "")).hostname.replace(/^www\./, ""); }
  catch (_) { return ""; }
}

export function normTitle(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Normalize a URL for duplicate comparison: case, www, protocol, trailing slash, utm params, fragment. */
export function normalizeUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
    }
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    // Protocol is dropped so http/https variants of the same page compare equal.
    return `${u.hostname}${path}${u.search ? u.search : ""}`.toLowerCase();
  } catch (_) {
    return String(url || "").trim().toLowerCase();
  }
}

// ─── Duplicate detection ─────────────────────────────────────────────────────

/**
 * Find likely duplicate sources for a candidate. Never merges; returns the
 * reasons so the UI can offer "use existing" vs "keep both".
 * Returns [{ source, reason: "url" | "doi" | "title" }]
 */
export function findDuplicateSources(sources, candidate) {
  const candUrl = normalizeUrl(candidate?.url);
  const candDoi = String(candidate?.doi || "").trim().toLowerCase();
  const candTitle = normTitle(candidate?.title);
  const out = [];
  const seen = new Set();

  for (const s of sources || []) {
    if (s.id === candidate?.id) continue;
    let reason = null;
    if (candUrl && candUrl !== "/" && normalizeUrl(s.url) === candUrl) reason = "url";
    else if (candDoi && String(s.doi || "").trim().toLowerCase() === candDoi) reason = "doi";
    else if (candTitle.length > 5 && normTitle(s.title) === candTitle) reason = "title";
    if (reason && !seen.has(s.id)) {
      seen.add(s.id);
      out.push({ source: s, reason });
    }
  }
  return out;
}

// ─── Research gaps ───────────────────────────────────────────────────────────

const SIDE_TAGS = { pro: ["pro", "aff", "affirmative"], con: ["con", "neg", "negative", "opp"] };

function tagSide(tags = []) {
  const set = tags.map((t) => String(t).toLowerCase());
  if (set.some((t) => SIDE_TAGS.pro.includes(t))) return "pro";
  if (set.some((t) => SIDE_TAGS.con.includes(t))) return "con";
  return null;
}

/**
 * Gap detection over the user's own research structure. Returns actionable
 * insights; never claims internet-wide completeness.
 */
export function researchGaps({ topics = [], questions = [], sources = [], evidence = [], blocks = [], cases = [], topicId = null } = {}) {
  const gaps = [];
  const topicIds = topicId ? [topicId] : topics.map((t) => t.id);
  const topicName = (topics.find((t) => t.id === topicId) || {}).name;

  const inTopic = (item) => {
    if (!topicId) return true;
    const t = item?.topicIds || [];
    return t.includes(topicId) || (topicName && item?.topic === topicName);
  };

  const tQuestions = questions.filter(inTopic);
  const tSources = sources.filter(inTopic);
  const tEvidence = evidence.filter(inTopic);
  const tBlocks = blocks.filter(inTopic);
  const tCases = cases.filter(inTopic);

  // 1. Questions with no linked research.
  for (const q of tQuestions) {
    const linked = (q.sourceIds || []).length + (q.evidenceIds || []).length;
    if (linked === 0 && q.status !== "answered") {
      gaps.push({
        id: `q-${q.id}`, kind: "question", severity: q.priority === "high" ? "danger" : "warn",
        title: "Question has no linked research",
        detail: `“${q.question}” has no sources or evidence attached.`,
        action: "Find one source or evidence card and link it.",
        refs: { questionId: q.id }
      });
    } else if (linked === 0 && q.status === "answered") {
      gaps.push({
        id: `q-${q.id}`, kind: "question", severity: "info",
        title: "Answered question is unlinked",
        detail: `“${q.question}” is marked answered but has no linked sources.`,
        action: "Attach the sources that answer it.",
        refs: { questionId: q.id }
      });
    }
  }

  // 2. Evidence not linked to any argument.
  for (const e of tEvidence) {
    const linked = (e.caseIds || []).length + (e.blockIds || []).length;
    if (linked === 0) {
      gaps.push({
        id: `ev-${e.id}`, kind: "evidence", severity: "warn",
        title: "Evidence not used in any argument",
        detail: `“${e.text?.slice(0, 60)}…” has no case or block links.`,
        action: "Link it to a claim or save it as a block's support.",
        refs: { evidenceId: e.id }
      });
    }
  }

  // 3. Blocks (arguments/responses) with no supporting evidence.
  for (const b of tBlocks) {
    const hasEv = (evidence || []).some((e) => (e.blockIds || []).includes(b.id));
    if (!hasEv && !String(b.evidence || "").trim()) {
      gaps.push({
        id: `b-${b.id}`, kind: "argument", severity: "warn",
        title: "Argument has no supporting evidence",
        detail: `“${b.tag || b.myResponse?.slice(0, 60) || "Untitled block"}” stands on assertion only.`,
        action: "Attach an evidence card or paste a quote.",
        refs: { blockId: b.id }
      });
    }
  }

  // 4. Case contentions without evidence.
  for (const c of tCases) {
    (c.sections || []).forEach((sec, i) => {
      if (!(sec.evidenceIds || []).length && (sec.claim || sec.title)) {
        gaps.push({
          id: `c-${c.id}-${i}`, kind: "claim", severity: "warn",
          title: "Claim has no evidence",
          detail: `“${sec.title || sec.claim}” in “${c.title || "case"}” is unsupported.`,
          action: "Find evidence establishing this claim.",
          refs: { caseId: c.id }
        });
      }
    });
  }

  // 5. Sources with no extracted evidence.
  for (const s of tSources) {
    const used = (evidence || []).some((e) => e.sourceId === s.id);
    if (!used) {
      gaps.push({
        id: `s-${s.id}`, kind: "source", severity: "info",
        title: "Saved source has no evidence extracted",
        detail: `“${s.title || s.url}” is saved but nothing has been pulled from it.`,
        action: "Open it and highlight the useful passages.",
        refs: { sourceId: s.id }
      });
    }
  }

  // 6. One-sided research by side tags.
  const sideCounts = { pro: 0, con: 0 };
  for (const e of tEvidence) {
    const side = tagSide([e.topic, ...(e.tags || [])]);
    if (side) sideCounts[side] += 1;
  }
  if (tEvidence.length >= 2 && (sideCounts.pro === 0 || sideCounts.con === 0)) {
    const lean = sideCounts.pro === 0 ? "con" : "pro";
    gaps.push({
      id: `balance-${topicId || "all"}`, kind: "balance", severity: "info",
      title: "Research leans one side",
      detail: `${sideCounts.pro} pro-tagged, ${sideCounts.con} con-tagged cards — nothing on the ${lean} side.`,
      action: "Find evidence for the opposing side before the round.",
      refs: {}
    });
  }

  // 7. Evidence supports cases but no counterarguments researched.
  const caseUsingEvidence = tEvidence.some((e) => (e.caseIds || []).length > 0);
  if (caseUsingEvidence && tBlocks.length === 0) {
    gaps.push({
      id: `counter-${topicId || "all"}`, kind: "counterargument", severity: "info",
      title: "No counterarguments researched",
      detail: "Evidence is linked to cases, but no response blocks exist for this topic.",
      action: "Build blocks against the arguments you expect.",
      refs: {}
    });
  }

  return gaps;
}

// ─── Coverage ────────────────────────────────────────────────────────────────

/**
 * Topic-level research coverage. The score is explainable: each part has a
 * weight and a breakdown the UI can show. No single meaningless percentage.
 */
export function topicCoverage({ topics = [], questions = [], sources = [], evidence = [], blocks = [], cases = [], topicId = null } = {}) {
  const topic = topics.find((t) => t.id === topicId);
  const inTopic = (item) => {
    if (!topicId) return true;
    return (item?.topicIds || []).includes(topicId) || (topic && item?.topic === topic.name);
  };

  const tQuestions = questions.filter(inTopic);
  const tSources = sources.filter(inTopic);
  const tEvidence = evidence.filter(inTopic);
  const tBlocks = blocks.filter(inTopic);
  const tCases = cases.filter(inTopic);

  const argsTotal = tBlocks.length + tCases.reduce((n, c) => n + (c.sections || []).filter((s) => s?.claim || s?.title).length, 0);
  const unlinkedEvidence = tEvidence.filter((e) => (e.caseIds || []).length + (e.blockIds || []).length === 0).length;
  const linkedEvidence = tEvidence.length - unlinkedEvidence;

  let argsWithEvidence = 0;
  for (const b of tBlocks) {
    if ((evidence || []).some((e) => (e.blockIds || []).includes(b.id)) || String(b.evidence || "").trim()) argsWithEvidence += 1;
  }
  for (const c of tCases) {
    for (const sec of c.sections || []) {
      if ((sec.evidenceIds || []).length) argsWithEvidence += 1;
    }
  }

  const questionCov = tQuestions.length ? tQuestions.filter((q) => (q.sourceIds || []).length + (q.evidenceIds || []).length > 0).length : 1;
  const evLink = tEvidence.length ? linkedEvidence : 1;
  const argCov = argsTotal ? argsWithEvidence : 1;

  const parts = [
    { id: "questions", label: "Questions with research", value: questionCov, total: tQuestions.length, weight: 0.35, explanation: "Questions that have at least one linked source or evidence card." },
    { id: "evidence", label: "Evidence linked to arguments", value: evLink, total: tEvidence.length, weight: 0.35, explanation: "Evidence cards that are used by a case or block." },
    { id: "arguments", label: "Arguments with evidence", value: argCov, total: argsTotal, weight: 0.30, explanation: "Blocks and case claims that carry at least one evidence card." }
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.weight * (p.total ? p.value / p.total : 1), 0) * 100);

  return {
    score,
    parts,
    counts: {
      questions: tQuestions.length,
      answered: tQuestions.filter((q) => q.status === "answered").length,
      partiallyAnswered: tQuestions.filter((q) => q.status === "partially-answered" || q.status === "researching").length,
      unanswered: tQuestions.filter((q) => q.status === "unanswered").length,
      sources: tSources.length,
      evidence: tEvidence.length,
      arguments: argsTotal,
      unlinkedEvidence,
      argumentsWithoutEvidence: argsTotal - argsWithEvidence,
      blocks: tBlocks.length,
      cases: tCases.length
    }
  };
}

// ─── Relationships ───────────────────────────────────────────────────────────

/** Evidence cards that support an argument (block or case). */
export function evidenceForArgument(evidence, { blockId, caseId } = {}) {
  return (evidence || []).filter((e) =>
    (blockId && (e.blockIds || []).includes(blockId)) ||
    (caseId && (e.caseIds || []).includes(caseId))
  );
}

/** Where an evidence card is used: blocks + cases (with section labels). */
export function argumentsForEvidence(evidenceCard, blocks, cases) {
  const out = { blocks: [], cases: [] };
  for (const b of blocks || []) {
    if ((evidenceCard?.blockIds || []).includes(b.id)) out.blocks.push(b);
  }
  for (const c of cases || []) {
    if ((evidenceCard?.caseIds || []).includes(c.id)) {
      const sections = (c.sections || []).filter((s) => (s.evidenceIds || []).includes(evidenceCard.id));
      out.cases.push({ case: c, sections });
    }
  }
  return out;
}

/** Questions linked to a source, or that reference an evidence card. */
export function questionsForSource(sourceId, questions) {
  return (questions || []).filter((q) => (q.sourceIds || []).includes(sourceId));
}

/** Excerpts belonging to a source. */
export function excerptsForSourceId(sourceId, excerpts) {
  return (excerpts || []).filter((x) => x.sourceId === sourceId);
}

/** Evidence cards created from a source. */
export function evidenceForSource(sourceId, evidence) {
  return (evidence || []).filter((e) => e.sourceId === sourceId);
}

// ─── Bibliography ────────────────────────────────────────────────────────────

/**
 * Build a bibliography for a set of sources in a citation style, sorted per
 * style convention (alphabetical by author/title). Missing metadata is
 * reported separately so the user can review before exporting.
 */
export function buildBibliography(sources, style = "mla") {
  const items = (sources || [])
    .filter((s) => s && (s.title || s.url))
    .map((s) => ({ source: s, citation: formatCitation(s, style), key: bibliographySortKey(s) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    items,
    text: items.map((i) => i.citation).join("\n\n"),
    issues: (sources || []).map((s) => ({ source: s, issues: citationIssues(s) })).filter((x) => x.issues.length > 0)
  };
}

// ─── Activity ────────────────────────────────────────────────────────────────

/** Recent activity across a topic's research, newest first. */
export function topicActivity({ topicId, topicName, sources = [], evidence = [], questions = [], excerpts = [], blocks = [], limit = 10 } = {}) {
  const inTopic = (item) => {
    if (!topicId) return true;
    return (item?.topicIds || []).includes(topicId) || (topicName && item?.topic === topicName);
  };
  const rows = [];
  for (const s of sources.filter(inTopic)) rows.push({ at: s.updatedAt || s.createdAt, label: "Source saved", detail: s.title || s.url });
  for (const e of evidence.filter(inTopic)) rows.push({ at: e.updatedAt || e.createdAt, label: "Evidence card", detail: e.text?.slice(0, 60) });
  for (const q of questions.filter(inTopic)) rows.push({ at: q.updatedAt || q.createdAt, label: "Research question", detail: q.question });
  for (const x of excerpts.filter(inTopic)) rows.push({ at: x.updatedAt || x.createdAt, label: "Excerpt", detail: x.quote?.slice(0, 60) });
  for (const b of blocks.filter(inTopic)) rows.push({ at: b.updatedAt || b.createdAt, label: "Argument", detail: b.tag || b.myResponse?.slice(0, 60) });
  return rows.filter((r) => r.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

// ─── Recency ─────────────────────────────────────────────────────────────────

/** Group sources by recency: recent (default 12 months), older, unknown date. */
export function recencyBuckets(sources, { recentDays = 365 } = {}) {
  const cutoff = Date.now() - recentDays * 86400000;
  const buckets = { recent: [], older: [], unknown: [] };
  for (const s of sources || []) {
    const ts = s.publishDate ? Date.parse(s.publishDate) : NaN;
    if (!Number.isFinite(ts)) buckets.unknown.push(s);
    else if (ts >= cutoff) buckets.recent.push(s);
    else buckets.older.push(s);
  }
  return buckets;
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Field-weighted search over research items. Scores title/label fields
 * higher than body text; returns matches sorted by relevance.
 */
export function researchSearch(items, query, { titleFields = ["title", "name", "question", "tag"], bodyFields = ["text", "description", "notes", "content", "quote", "claim", "myResponse"] } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return (items || []).map((i) => ({ item: i, score: 0 }));
  const terms = q.split(/\s+/);
  const out = [];
  for (const item of items || []) {
    let score = 0;
    for (const f of titleFields) {
      const v = String(item?.[f] || "").toLowerCase();
      for (const t of terms) if (v.includes(t)) score += 3;
    }
    for (const f of bodyFields) {
      const v = String(item?.[f] || "").toLowerCase();
      for (const t of terms) if (v.includes(t)) score += 1;
    }
    const tagText = (item?.tags || []).map((t) => String(t).toLowerCase()).join(" ");
    for (const t of terms) if (tagText.includes(t)) score += 2;
    const urlText = String(item?.url || "").toLowerCase();
    for (const t of terms) if (urlText.includes(t)) score += 1;
    if (score > 0) out.push({ item, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
