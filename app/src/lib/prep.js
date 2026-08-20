// prep.js — the speech & debate preparation data layer.
//
// One generic CRUD over ten content types (cases, evidence, blocks, response
// trees, inbox items, cross-ex questions, flashcards, topics, prep sessions,
// outlines, strategies). Signed-in users get Firestore; guests get an
// identical localStorage-backed store. Relationships between entities are
// kept explicit via denormalized id arrays (section.evidenceIds, block.caseIds,
// inbox.movedTo, flashcard.sourceId …) so the library can answer "where is
// this used / what supports it / what responds to it".

export const COLS = [
  "cases", "evidence", "blocks", "responses", "inbox", "crossfire",
  "flashcards", "topics", "prepSessions", "outlines", "strategies",
  // Research intelligence layer (same per-user store, same relationship
  // conventions — denormalized id arrays):
  "sources", "excerpts", "researchQuestions", "researchCollections",
  "researchTasks", "conflicts"
];

export const LOCAL_PREFIX = "fracture_prep_";

// ─── Generic storage router ─────────────────────────────────────────────────
// Storage functions are injected so this module stays testable and pages can
// pass either the Firestore-backed implementation (firebase.js) or the local
// one. Defaults to the local implementation.

function localRead(col) {
  try { return JSON.parse(localStorage.getItem(LOCAL_PREFIX + col) || "[]"); } catch (_) { return []; }
}
function localWrite(col, items) {
  localStorage.setItem(LOCAL_PREFIX + col, JSON.stringify(items));
}

export function makeLocalStore() {
  return {
    list: async (col) => localRead(col),
    create: async (col, data) => {
      const items = localRead(col);
      const id = col.slice(0, 3) + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      items.unshift({ id, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      localWrite(col, items);
      return id;
    },
    update: async (col, id, patch) => {
      const items = localRead(col);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
      localWrite(col, items);
    },
    remove: async (col, id) => {
      localWrite(col, localRead(col).filter((i) => i.id !== id));
    }
  };
}

let store = makeLocalStore();

/** Pages call setPrepStore(firestorePrepStore) once when a user is present. */
export function setPrepStore(next) {
  store = next || makeLocalStore();
}
export function getPrepStore() {
  return store;
}

export const listItems = (col) => store.list(col);
export const createItem = (col, data) => store.create(col, data);
export const updateItem = (col, id, patch) => store.update(col, id, patch);
export const removeItem = (col, id) => store.remove(col, id);
export async function getItem(col, id) {
  const items = await store.list(col);
  return items.find((i) => i.id === id) || null;
}

// ─── Entity factories ────────────────────────────────────────────────────────

export function newCase(partial = {}) {
  return {
    title: "", resolution: "", thesis: "", side: "aff", event: "", topic: "",
    tags: [], sections: [], versions: [], createdAt: "", updatedAt: "", ...partial
  };
}

export function newSection(partial = {}) {
  return {
    id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    kind: "contention",   // contention | note | strategy
    title: "", collapsed: false, claim: "", warrant: "", evidenceIds: [],
    impact: "", notes: "", responses: [], ...partial
  };
}

export function newEvidence(partial = {}) {
  return {
    text: "", source: "", url: "", note: "", tags: [], topic: "", caseIds: [],
    favorite: false, createdAt: "", updatedAt: "", ...partial
  };
}

export function newBlock(partial = {}) {
  return {
    tag: "", theirArgument: "", myResponse: "", explanation: "", evidence: "",
    impact: "", category: "", topic: "", tags: [], caseIds: [], favorite: false,
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newResponseTree(partial = {}) {
  return {
    trigger: "", topic: "", tags: [], branches: [], createdAt: "", updatedAt: "", ...partial
  };
}

export function newBranch(partial = {}) {
  return {
    id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: "", explanation: "", evidence: "", warrant: "", impact: "", notes: "", ...partial
  };
}

export function newInboxItem(partial = {}) {
  return {
    kind: "note", content: "", url: "", status: "unprocessed", movedTo: null,
    topic: "", createdAt: "", updatedAt: "", ...partial
  };
}

export function newCrossfireQuestion(partial = {}) {
  return {
    question: "", category: "warrant-attack", event: "", topic: "", tags: [],
    favorite: false, createdAt: "", updatedAt: "", ...partial
  };
}

export function newFlashcard(partial = {}) {
  return {
    front: "", back: "", kind: "qa", sourceType: "", sourceId: "",
    due: new Date().toISOString(), intervalDays: 0, ease: 2.5, reviews: 0,
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newTopic(partial = {}) {
  return {
    name: "", tags: [], definitions: [], proArguments: [], conArguments: [],
    strategies: [], questions: [], notes: "", createdAt: "", updatedAt: "", ...partial
  };
}

export function newOutline(partial = {}) {
  return { title: "", event: "", segments: [], createdAt: "", updatedAt: "", ...partial };
}

export function newSegment(label = "Point", seconds = 60) {
  return { id: "seg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label, seconds };
}

export function newStrategy(partial = {}) {
  return { title: "", caseId: "", topic: "", options: [], createdAt: "", updatedAt: "", ...partial };
}

export function newStrategyOption(name = "Option") {
  return { id: "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, benefits: [], risks: [], notes: "" };
}

// ─── Case completeness checker ───────────────────────────────────────────────
// Deterministic, structural — checks the case data, not persuasiveness.

export function normText(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function checkCase(caze, evidenceList = []) {
  const issues = [];
  const sections = (caze?.sections || []).filter((s) => s?.kind === "contention" || !s?.kind);
  const allSections = caze?.sections || [];

  // 1. Contention-level checks.
  sections.forEach((s, i) => {
    const title = normText(s.title);
    const hasAny = title || normText(s.claim) || normText(s.warrant) || normText(s.impact);
    if (!hasAny) {
      issues.push({ severity: "warn", label: "Empty section", detail: `Section ${i + 1} has no content yet.`, sectionId: s.id });
      return;
    }
    if (!title) issues.push({ severity: "warn", label: "Untitled contention", detail: `Contention ${i + 1} has no label — name it so it's easy to reference.`, sectionId: s.id });
    if (!normText(s.claim)) issues.push({ severity: "error", label: "No claim", detail: `"${s.title || "Contention " + (i + 1)}" has no claim sentence.`, sectionId: s.id, field: "claim" });
    else if (!normText(s.warrant)) issues.push({ severity: "error", label: "Missing warrant", detail: `"${s.title}" states a claim with no warrant — add the reasoning step that links evidence to claim.`, sectionId: s.id, field: "warrant" });
    if (!normText(s.impact)) issues.push({ severity: "error", label: "Missing impact", detail: `"${s.title}" has no impact — say why it matters and to whom.`, sectionId: s.id, field: "impact" });
    if (normText(s.claim) && normText(s.warrant) && !(s.evidenceIds || []).length) {
      issues.push({ severity: "warn", label: "No evidence", detail: `"${s.title}" claims and warrants but cites no evidence card.`, sectionId: s.id, field: "evidence" });
    }
  });

  // 2. Duplicate claims within the case.
  const seen = new Map();
  allSections.forEach((s) => {
    const claim = normText(s.claim);
    if (!claim) return;
    if (seen.has(claim)) {
      issues.push({ severity: "warn", label: "Duplicate argument", detail: `"${s.title}" repeats the claim of "${seen.get(claim)}".`, sectionId: s.id });
    } else seen.set(claim, s.title || "Contention");
  });

  // 3. Broken evidence links + unused evidence.
  const evidenceIds = new Set();
  allSections.forEach((s) => (s.evidenceIds || []).forEach((id) => evidenceIds.add(id)));
  const knownIds = new Set((evidenceList || []).map((e) => e.id));
  evidenceIds.forEach((id) => {
    if (id && !knownIds.has(id)) issues.push({ severity: "error", label: "Broken evidence link", detail: "A section links evidence that no longer exists — reattach or remove the card.", });
  });
  (evidenceList || []).forEach((e) => {
    const inCase = (e.caseIds || []).includes(caze?.id);
    const referenced = evidenceIds.has(e.id);
    if (inCase && !referenced) issues.push({ severity: "info", label: "Unused evidence", detail: `"${e.source || e.text?.slice(0, 40) || "Card"}" is attached to this case but not used by any section.` });
  });

  // 4. Responses with no trigger/argument.
  allSections.forEach((s) => {
    (s.responses || []).forEach((r) => {
      if (!normText(r.trigger) && !normText(r.response)) return;
      if (!normText(r.trigger)) issues.push({ severity: "warn", label: "Response with no target", detail: `"${s.title}" has a response but no "they say" trigger.`, sectionId: s.id });
      if (!normText(r.response)) issues.push({ severity: "warn", label: "Empty response", detail: `"${s.title}" has a trigger but no written response.`, sectionId: s.id });
    });
  });

  const weight = { error: 8, warn: 4, info: 1 };
  const penalty = issues.reduce((sum, i) => sum + (weight[i.severity] || 1), 0);
  const base = allSections.length ? 100 : 0;
  const score = Math.max(0, Math.min(100, base - penalty));
  const counts = {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warn").length
  };
  return { score, issues, counts };
}

// ─── Flashcard scheduling (simple SM-2-style spaced repetition) ─────────────

export function cardDue(card, now = new Date()) {
  if (!card?.due) return true;
  const d = new Date(card.due);
  return !Number.isNaN(d.getTime()) && d.getTime() <= now.getTime();
}

/** quality: 0 (blackout) … 5 (perfect recall). Returns the updated card fields. */
export function scheduleReview(card, quality, now = new Date()) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let ease = Number(card.ease) || 2.5;
  if (q < 3) {
    // Failed review: restart the interval ladder but keep the ease factor.
    return { ...card, intervalDays: 0, due: new Date(now.getTime() + 10 * 60000).toISOString(), reviews: (card.reviews || 0) + 1 };
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const prev = Number(card.intervalDays) || 0;
  const interval = prev === 0 ? 1 : prev === 1 ? 3 : Math.round(prev * ease);
  return { ...card, ease, intervalDays: interval, due: new Date(now.getTime() + interval * 86400000).toISOString(), reviews: (card.reviews || 0) + 1 };
}

// ─── Relationships ───────────────────────────────────────────────────────────

export function evidenceUsedInCase(evidenceId, cases) {
  return (cases || []).filter((c) =>
    (c.sections || []).some((s) => (s.evidenceIds || []).includes(evidenceId))
  );
}

export function sectionResponses(section) {
  return (section?.responses || []).filter((r) => r && (r.trigger || r.response));
}

export function relatedByTag(item, items, limit = 5) {
  const tags = new Set([item?.topic, ...(item?.tags || [])].filter(Boolean).map((t) => t.toLowerCase()));
  return (items || [])
    .filter((other) => other.id !== item?.id)
    .map((other) => {
      const otherTags = new Set([other.topic, ...(other.tags || [])].filter(Boolean).map((t) => t.toLowerCase()));
      const overlap = [...tags].filter((t) => otherTags.has(t)).length;
      return { item: other, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((x) => x.item);
}

export function filterByQuery(items, query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return items;
  return (items || []).filter((i) =>
    JSON.stringify(i).toLowerCase().includes(q)
  );
}

export function outlineTotal(outline) {
  return (outline?.segments || []).reduce((sum, s) => sum + (Number(s.seconds) || 0), 0);
}

export function fmtSeconds(total) {
  const s = Math.max(0, Math.round(total || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function timeAgo(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
