// competition.js — the speech & debate competition + team data layer.
//
// Mirrors the prep.js architecture: one generic CRUD over shared collections
// (tournaments, teams, and their subcollections), with storage injected per
// session. Signed-in users get Firestore (firebaseCompetitionStore in
// firebase.js); guests get an identical localStorage store so a solo user can
// run a full tournament from one device. All permission checks live in
// access.js and are mirrored by the Firestore rules.
//
// Collections:
//   tournaments                          top-level tournament docs
//   tournaments/{tid}/events             event definitions
//   tournaments/{tid}/rounds             rounds
//   tournaments/{tid}/ballots            judge ballots
//   tournaments/{tid}/timeline           chronological competition feed
//   tournaments/{tid}/log                admin-only audit trail
//   teams                                top-level team docs (members map inside)
//   teams/{tid}/assignments              coach-created assignments
//   teams/{tid}/submissions              per-member assignment submissions
//   teams/{tid}/rubrics                  shared team rubrics

import { ballotTotal } from "./rubrics.js";

export const TOURNAMENT_STATUSES = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" }
];

export const ROUND_STATUSES = [
  { id: "not-started", label: "Not started" },
  { id: "active", label: "Active" },
  { id: "awaiting-ballot", label: "Awaiting ballot" },
  { id: "completed", label: "Completed" }
];

export const BALLOT_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "locked", label: "Locked" }
];

export const ASSIGNMENT_KINDS = [
  { id: "drill", label: "Practice drill" },
  { id: "argument", label: "Argument preparation" },
  { id: "case-review", label: "Case review" },
  { id: "research", label: "Research task" },
  { id: "calibration", label: "Judge calibration exercise" },
  { id: "custom", label: "Custom assignment" }
];

export const statusLabel = (list, id) => list.find((s) => s.id === id)?.label || id;

// ─── Factories ───────────────────────────────────────────────────────────────

export function newTournament(partial = {}) {
  return {
    name: "", location: "", startDate: "", endDate: "",
    status: "upcoming",
    admins: {}, judges: {}, participants: {},
    teamIds: [],
    notes: "",
    createdAt: "", updatedAt: "", createdBy: "",
    ...partial
  };
}

export function newEvent(partial = {}) {
  return {
    name: "", formatId: "custom", participantType: "individual",
    timing: null, sides: null, rubricId: "custom", roundCount: 0,
    notes: "", createdAt: "", updatedAt: "", ...partial
  };
}

export function newRound(partial = {}) {
  return {
    number: 1, name: "", eventId: "", status: "not-started",
    judges: [], participants: {}, sides: null,
    notes: "", startsAt: "", endsAt: "", createdAt: "", updatedAt: "", ...partial
  };
}

export function newTeam(partial = {}) {
  return {
    name: "", code: "", motto: "", members: {}, createdBy: "",
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newMember(uid, { role = "member", name = "", email = "" } = {}) {
  return { role, name, email, joinedAt: new Date().toISOString() };
}

export function newAssignment(partial = {}) {
  return {
    title: "", instructions: "", kind: "custom", dueDate: "",
    eventId: "", topic: "", status: "open",
    assigneeIds: [], createdBy: "", createdAt: "", updatedAt: "", ...partial
  };
}

export function newSubmission(partial = {}) {
  return {
    assignmentId: "", uid: "", name: "", status: "in-progress",
    note: "", feedback: "", selfScore: null, completedAt: null,
    createdAt: "", updatedAt: "", ...partial
  };
}

export function newTimelineEntry(kind, title, detail = "", actorId = "") {
  return { kind, title, detail, actorId, at: new Date().toISOString() };
}

export function newLogEntry(action, target, detail = "", actorId = "", actorName = "") {
  return { action, target, detail, actorId, actorName, at: new Date().toISOString() };
}

// ─── Storage router (mirrors prep.js) ────────────────────────────────────────

export const LOCAL_PREFIX = "fracture_comp_";

function localRead(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { return []; }
}
function localWrite(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}
function localKey(col, parent) {
  return parent ? `${LOCAL_PREFIX}${parent}/${col}` : `${LOCAL_PREFIX}${col}`;
}

export function makeLocalCompetitionStore() {
  return {
    isLocal: true,
    list: async (col, parent) => localRead(localKey(col, parent)),
    get: async (col, id, parent) => localRead(localKey(col, parent)).find((i) => i.id === id) || null,
    create: async (col, data, parent) => {
      const key = localKey(col, parent);
      const items = localRead(key);
      const id = col.slice(0, 3) + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      items.unshift({ id, ...data, createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      localWrite(key, items);
      return id;
    },
    update: async (col, id, patch, parent) => {
      const key = localKey(col, parent);
      const items = localRead(key);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
      localWrite(key, items);
    },
    remove: async (col, id, parent) => {
      localWrite(localKey(col, parent), localRead(localKey(col, parent)).filter((i) => i.id !== id));
    },
    // Guest = solo admin: everything is "mine".
    listMy: async (kind) => localRead(`${LOCAL_PREFIX}${kind}`),
    subscribe: () => undefined
  };
}

let store = makeLocalCompetitionStore();

export function setCompetitionStore(next) {
  store = next || makeLocalCompetitionStore();
}
export function getCompetitionStore() {
  return store;
}

export const listItems = (col, parent) => store.list(col, parent);
export const getItem = (col, id, parent) => store.get(col, id, parent);
export const createItem = (col, data, parent) => store.create(col, data, parent);
export const updateItem = (col, id, patch, parent) => store.update(col, id, patch, parent);
export const removeItem = (col, id, parent) => store.remove(col, id, parent);
export const listMy = (kind) => store.listMy(kind);
export const subscribe = (col, parent, cb) => store.subscribe(col, parent, cb);

/** Fetch every referenced tournament/team the current user belongs to. */
export async function loadMyScoped(kind) {
  return listMy(kind);
}

// ─── Round / ballot logic ────────────────────────────────────────────────────

/** Map a judge uid → their ballot for the round (draft or submitted). */
export function ballotsByJudge(ballots, roundId) {
  const out = {};
  for (const b of ballots || []) {
    if (b.roundId === roundId && !out[b.judgeId]) out[b.judgeId] = b;
  }
  return out;
}

export function roundBallots(ballots, roundId) {
  return (ballots || []).filter((b) => b.roundId === roundId);
}

/**
 * Effective round status derived from ballots: when every assigned judge has
 * submitted, the round is ready to complete (returns "completed" for display
 * once an admin flips it). Returns { status, needed: [judgeIds] }.
 */
export function computeRoundStatus(round, ballots) {
  const status = round?.status || "not-started";
  const assigned = (round?.judges || []).filter(Boolean);
  const byJudge = ballotsByJudge(ballots, round?.id);
  const needed = assigned.filter((jid) => byJudge[jid]?.status !== "submitted" && byJudge[jid]?.status !== "locked");
  const allIn = assigned.length > 0 && needed.length === 0;

  if (status === "completed") return { status: "completed", needed: [] };
  if (status === "active" && allIn) return { status: "awaiting-ballot", needed: [] };
  if (status === "awaiting-ballot" && allIn) return { status: "awaiting-ballot", needed: [] };
  return { status, needed };
}

/** True when the round can be moved to completed (all ballots in). */
export function roundReadyToComplete(round, ballots) {
  const { needed } = computeRoundStatus(round, ballots);
  return (round?.judges || []).length > 0 && needed.length === 0;
}

/** Winner decision for a round from its submitted ballots. */
export function roundWinner(round, ballots, sides = []) {
  const submitted = roundBallots(ballots, round?.id).filter((b) => b.status === "submitted" || b.status === "locked");
  if (!submitted.length) return null;

  const decisionType = submitted[0].decisionType || "win-loss";
  if (decisionType === "rank") {
    const ranks = submitted.map((b) => Number(b.rank)).filter((r) => Number.isFinite(r) && r > 0);
    if (!ranks.length) return null;
    const best = Math.min(...ranks);
    return { kind: "rank", winnerRank: best, winner: null, votes: ranks.length };
  }

  const votes = submitted.filter((b) => b.decision).map((b) => b.decision);
  if (!votes.length) return null;
  const counts = {};
  for (const v of votes) counts[v] = (counts[v] || 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  // A split panel is no decision — never declare a winner on a tie.
  if (entries.length > 1 && entries[0][1] === entries[1][1]) {
    return { kind: "win-loss", winner: null, winnerLabel: "Split decision", votes: entries[0][1], total: votes.length, counts };
  }
  const [topId, topN] = entries[0];
  const sideLabel = sides.find((s) => s.id === topId)?.label || topId;
  return {
    kind: "win-loss",
    winner: topId,
    winnerLabel: sideLabel,
    votes: topN,
    total: votes.length,
    counts
  };
}

/**
 * Per-round results for the Results tab: each participant's decision record
 * and speaker points from submitted ballots.
 */
export function computeRoundResults(round, ballots) {
  const submitted = roundBallots(ballots, round?.id).filter((b) => b.status === "submitted" || b.status === "locked");
  const rows = {};
  for (const pid of Object.keys(round?.participants || {})) {
    rows[pid] = { id: pid, name: round.participants[pid]?.name || pid, side: round.participants[pid]?.side || null, wins: 0, losses: 0, ballots: 0, points: 0, rankSum: 0 };
  }
  for (const b of submitted) {
    // win-loss: decision names a side — apply to everyone on that side.
    if (b.decisionType !== "rank") {
      for (const row of Object.values(rows)) {
        if (row.side && row.side === b.decision) {
          row.wins += 1;
          row.ballots += 1;
          row.points += ballotTotal(b);
        } else if (row.side) {
          row.losses += 1;
        }
      }
    } else if (b.rankParticipantId && rows[b.rankParticipantId]) {
      const row = rows[b.rankParticipantId];
      row.ballots += 1;
      row.rankSum += Number(b.rank) || 0;
      row.wins += 1;
      row.points += ballotTotal(b);
    }
  }
  return Object.values(rows);
}

/**
 * Tournament standings: aggregate round results across all rounds/ballots,
 * sorted by wins (then points, then fewer losses).
 */
export function computeTournamentResults(tournament, rounds, ballots) {
  const standings = {};
  for (const r of rounds || []) {
    for (const row of computeRoundResults(r, ballots)) {
      const cur = standings[row.id] || { id: row.id, name: row.name, wins: 0, losses: 0, ballots: 0, points: 0, rankSum: 0 };
      cur.wins += row.wins;
      cur.losses += row.losses;
      cur.ballots += row.ballots;
      cur.points += row.points;
      cur.rankSum += row.rankSum;
      standings[row.id] = cur;
    }
  }
  return Object.values(standings).sort((a, b) =>
    b.wins - a.wins || b.points - a.points || a.losses - b.losses
  );
}

// ─── Calibration ─────────────────────────────────────────────────────────────

/**
 * Compare judges on the same round. Returns rows of judge → category scores,
 * per-category spread, and flagged disagreements. Never declares a "correct"
 * judge — the UI frames differences as discussion points.
 */
export function computeCalibration(round, ballots) {
  const submitted = roundBallots(ballots, round?.id).filter((b) => b.status === "submitted" || b.status === "locked");
  const categories = submitted[0]?.rubricSnapshot?.categories || [];
  const rows = submitted.map((b) => ({
    judgeId: b.judgeId,
    judgeName: b.judgeName || b.judgeId,
    scores: {},
    total: ballotTotal(b),
    decision: b.decision || (b.rank ? `#${b.rank}` : ""),
    feedbackWords: String(b.feedback || "").trim().split(/\s+/).filter(Boolean).length
  }));
  for (const row of rows) {
    for (const c of categories) row.scores[c.id] = null;
  }
  submitted.forEach((b, i) => {
    for (const c of categories) {
      const v = Number(b.scores?.[c.id]);
      if (Number.isFinite(v)) rows[i].scores[c.id] = v;
    }
  });

  const spread = {};
  for (const c of categories) {
    const vals = rows.map((r) => r.scores[c.id]).filter((v) => Number.isFinite(v));
    spread[c.id] = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  }

  const decisions = new Set(rows.map((r) => r.decision).filter(Boolean));
  const disagreements = [];
  if (decisions.size > 1) {
    disagreements.push({ title: "Decision disagreement", detail: `${rows.map((r) => `${r.judgeName} (${r.decision})`).join(" · ")} — worth discussing at the next judge meeting.` });
  }
  for (const c of categories) {
    if (spread[c.id] > 5) {
      disagreements.push({ title: `Wide spread on “${c.label}”`, detail: `Scores differ by ${spread[c.id]} points across ${rows.length} judges.` });
    }
  }

  return { rows, categories, spread, disagreements, totalRows: rows.length };
}

// ─── Timeline + audit ────────────────────────────────────────────────────────

/** Append a timeline entry to a tournament (competition feed). */
export async function addTimeline(tournamentId, entry) {
  return createItem("timeline", entry, tournamentId);
}

/** Append an audit-log entry to a tournament (admin-only read). */
export async function addLog(tournamentId, entry) {
  return createItem("log", entry, tournamentId);
}

// ─── Notifications ───────────────────────────────────────────────────────────
// Notifications are derived from data the user can already read — no server
// fan-out, no spam. `readAt` is the user's "last seen" marker; anything
// created after it counts as new.

const NOTIF_READ_KEY = "fracture_comp_notifs_read";

export function loadNotifReadAt(uid) {
  try { return localStorage.getItem(`${NOTIF_READ_KEY}_${uid || "guest"}`) || ""; } catch (_) { return ""; }
}
export function saveNotifReadAt(uid, iso) {
  try { localStorage.setItem(`${NOTIF_READ_KEY}_${uid || "guest"}`, iso); } catch (_) {}
}

export function computeNotifications({ uid, teams = [], tournaments = [], rounds = [], ballots = [], assignments = [] } = {}) {
  const out = [];
  const readAt = loadNotifReadAt(uid);
  const isNew = (iso) => iso && (!readAt || iso > readAt);

  for (const team of teams) {
    for (const a of assignments.filter((x) => x.teamId === team.id)) {
      if (!(a.assigneeIds || []).includes(uid)) continue;
      const due = a.dueDate ? new Date(a.dueDate) : null;
      const overdue = due && due.getTime() < Date.now();
      const soon = due && !overdue && due.getTime() - Date.now() < 48 * 3600 * 1000;
      if (isNew(a.createdAt)) {
        out.push({ id: `assign-${a.id}`, kind: "assignment", title: "New assignment", body: `“${a.title}” — ${team.name}`, link: `/compete/team/${team.id}`, at: a.createdAt, read: false });
      } else if (overdue || soon) {
        out.push({ id: `assign-due-${a.id}`, kind: "assignment-due", title: overdue ? "Assignment overdue" : "Assignment due soon", body: `“${a.title}” ${overdue ? "is past due" : "is due within 48 hours"}`, link: `/compete/team/${team.id}`, at: a.createdAt, read: false });
      }
    }
  }

  for (const r of rounds || []) {
    const isJudge = (r.judges || []).includes(uid);
    const isPart = r.participants && uid in (r.participants || {});
    if (isJudge && (r.status === "awaiting-ballot") && !ballots.some((b) => b.roundId === r.id && b.judgeId === uid && (b.status === "submitted" || b.status === "locked"))) {
      out.push({ id: `ballot-${r.id}`, kind: "ballot", title: "Ballot required", body: `Round ${r.number}${r.name ? ` · ${r.name}` : ""} is waiting on your ballot.`, link: `/compete/judge`, at: r.updatedAt || "", read: false });
    }
    if (isPart && (r.status === "not-started" || r.status === "active")) {
      const started = r.status === "active";
      if (started) {
        out.push({ id: `round-live-${r.id}`, kind: "round", title: "Round in progress", body: `Round ${r.number} is live now.`, link: `/compete/tournament/${r.tournamentId}/round/${r.id}`, at: r.updatedAt || "", read: false });
      } else if (isNew(r.createdAt)) {
        out.push({ id: `round-new-${r.id}`, kind: "round", title: "Round assigned", body: `Round ${r.number}${r.name ? ` · ${r.name}` : ""} is on your schedule.`, link: `/compete/tournament/${r.tournamentId}/round/${r.id}`, at: r.createdAt, read: false });
      }
    }
  }

  return out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

// ─── Small shared helpers ────────────────────────────────────────────────────

export function fmtDate(iso, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, withTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" });
}

export function sortByCreated(items) {
  return [...(items || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
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

export function nextRoundNumber(rounds) {
  return (rounds || []).reduce((m, r) => Math.max(m, Number(r.number) || 0), 0) + 1;
}

export function assignableJudges(tournament) {
  return Object.entries(tournament?.judges || {}).map(([uid, info]) => ({ uid, name: info?.name || uid }));
}

export function assignableParticipants(tournament, event) {
  const type = event?.participantType || "individual";
  const entries = Object.entries(tournament?.participants || {});
  if (type === "team") {
    // Group participants by teamId; each team is one ballot side.
    const byTeam = {};
    for (const [uid, info] of entries) {
      const key = info?.teamId || uid;
      if (!byTeam[key]) byTeam[key] = { id: key, name: info?.teamName || info?.name || key, uids: [], teamId: key };
      byTeam[key].uids.push(uid);
    }
    return Object.values(byTeam);
  }
  return entries.map(([uid, info]) => ({ id: uid, name: info?.name || uid, uids: [uid] }));
}

export function participantNames(tournament, round) {
  return Object.entries(round?.participants || {}).map(([uid, info]) => ({
    id: uid,
    name: info?.name || tournament?.participants?.[uid]?.name || uid,
    side: info?.side || null,
    teamName: info?.teamName || tournament?.participants?.[uid]?.teamName || ""
  }));
}
