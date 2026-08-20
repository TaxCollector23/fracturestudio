import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  makeLocalCompetitionStore, setCompetitionStore, listItems, getItem, createItem, updateItem, removeItem, listMy,
  newTournament, newRound, newEvent, newTeam, newAssignment, newSubmission,
  computeRoundStatus, roundWinner, computeRoundResults, computeTournamentResults,
  computeCalibration, computeNotifications, saveNotifReadAt, nextRoundNumber, statusLabel, ROUND_STATUSES
} from "./competition.js";
import { blankBallot } from "./rubrics.js";
import {
  tournamentRole, isTournamentAdmin, canJudgeRound, canCreateBallot, canWriteBallot,
  teamRole, canManageTeam, canCreateAssignment, canCompleteAssignment
} from "./access.js";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
beforeAll(() => {
  globalThis.localStorage = new MemoryStorage();
  setCompetitionStore(makeLocalCompetitionStore());
});
beforeEach(() => { localStorage.clear(); });

function pfBallot(judgeId, overrides = {}) {
  const b = blankBallot({ rubric: { id: "pf", name: "PF", decisionType: "win-loss", categories: [
    { id: "a", label: "A", max: 30 }, { id: "b", label: "B", max: 30 }
  ] }, roundId: "r1", judgeId });
  b.scores = { a: 25, b: 22 };
  b.decision = "pro";
  b.feedback = "Good round.";
  return { ...b, status: "submitted", submittedAt: new Date().toISOString(), ...overrides };
}

describe("local competition store", () => {
  it("creates, lists, updates, removes with parent scoping", async () => {
    const tid = await createItem("tournaments", newTournament({ name: "Invite" }));
    const other = await createItem("tournaments", newTournament({ name: "Other" }));

    const rid = await createItem("rounds", newRound({ number: 1 }), tid);
    await createItem("rounds", newRound({ number: 2 }), other);

    expect((await listItems("rounds", tid)).length).toBe(1);
    expect((await listItems("rounds", other)).length).toBe(1);
    expect((await getItem("rounds", rid, tid)).number).toBe(1);

    await updateItem("rounds", rid, { status: "active" }, tid);
    expect((await getItem("rounds", rid, tid)).status).toBe("active");

    await removeItem("rounds", rid, tid);
    expect(await listItems("rounds", tid)).toHaveLength(0);

    // Top-level lists stay separate from subcollections.
    expect((await listMy("tournaments")).length).toBe(2);
    expect((await listItems("tournaments")).length).toBe(2);
  });
});

describe("round status", () => {
  it("stays not-started until started; flags outstanding ballots", () => {
    const r = newRound({ id: "r1", status: "not-started", judges: ["j1"] });
    expect(computeRoundStatus(r, [])).toEqual({ status: "not-started", needed: ["j1"] });
    const active = { ...r, status: "active" };
    expect(computeRoundStatus(active, []).status).toBe("active");
    expect(computeRoundStatus(active, [pfBallot("j1")]).status).toBe("awaiting-ballot");
    expect(computeRoundStatus(active, [pfBallot("j1")]).needed).toEqual([]);
  });

  it("never unwinds a completed round", () => {
    const r = newRound({ id: "r1", status: "completed", judges: ["j1"] });
    expect(computeRoundStatus(r, []).status).toBe("completed");
  });

  it("nextRoundNumber increments", () => {
    expect(nextRoundNumber([{ number: 1 }, { number: 3 }])).toBe(4);
    expect(nextRoundNumber([])).toBe(1);
  });
});

describe("results", () => {
  it("declares a winner from majority decisions", () => {
    const round = newRound({ id: "r1", judges: ["j1", "j2", "j3"], participants: {
      p1: { name: "Pro team", side: "pro" }, p2: { name: "Con team", side: "con" }
    } });
    const w = roundWinner(round, [pfBallot("j1"), pfBallot("j2", { decision: "pro" }), pfBallot("j3", { decision: "con" })]);
    expect(w.winner).toBe("pro");
    expect(w.votes).toBe(2);
    expect(w.total).toBe(3);
  });

  it("returns no winner on a split panel", () => {
    const round = newRound({ id: "r1", judges: ["j1", "j2"], participants: {
      p1: { name: "Pro", side: "pro" }, p2: { name: "Con", side: "con" }
    } });
    const w = roundWinner(round, [pfBallot("j1"), pfBallot("j2", { decision: "con" })]);
    expect(w.winner).toBe(null);
    expect(w.winnerLabel).toBe("Split decision");
  });

  it("computes per-round win/loss and speaker points", () => {
    const round = newRound({ id: "r1", judges: ["j1"], participants: {
      p1: { name: "Pro", side: "pro" }, p2: { name: "Con", side: "con" }
    } });
    const rows = computeRoundResults(round, [pfBallot("j1")]);
    const pro = rows.find((r) => r.id === "p1");
    const con = rows.find((r) => r.id === "p2");
    expect(pro.wins).toBe(1);
    expect(con.losses).toBe(1);
    expect(pro.points).toBe(47);
  });

  it("aggregates standings across rounds", () => {
    const r1 = newRound({ id: "r1", judges: ["j1"], participants: { p1: { name: "A", side: "pro" }, p2: { name: "B", side: "con" } } });
    const r2 = newRound({ id: "r2", judges: ["j1"], participants: { p1: { name: "A", side: "con" }, p2: { name: "B", side: "pro" } } });
    const ballots = [
      pfBallot("j1", { roundId: "r1", decision: "pro" }),
      pfBallot("j1", { roundId: "r2", decision: "pro" })
    ];
    const standings = computeTournamentResults(newTournament(), [r1, r2], ballots);
    const a = standings.find((s) => s.id === "p1");
    const b = standings.find((s) => s.id === "p2");
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(b.wins).toBe(1);
    expect(b.losses).toBe(1);
    // A went pro (won r1) and con (lost r2) → 1-1; same for B; order by wins then points
    expect(standings.length).toBe(2);
  });

  it("rank ballots award the ranked winner", () => {
    const round = newRound({ id: "r1", judges: ["j1"], participants: { p1: { name: "A" }, p2: { name: "B" } } });
    const b = pfBallot("j1", { decisionType: "rank", rank: 2, rankParticipantId: "p2", decision: "" });
    const rows = computeRoundResults(round, [b]);
    expect(rows.find((r) => r.id === "p2").wins).toBe(1);
    expect(rows.find((r) => r.id === "p2").rankSum).toBe(2);
    expect(rows.find((r) => r.id === "p1").wins).toBe(0);
  });
});

describe("calibration", () => {
  it("compares judges and flags wide spreads + disagreements", () => {
    const round = newRound({ id: "r1", judges: ["j1", "j2"], participants: {} });
    const ballots = [
      pfBallot("j1", { decision: "pro" }),
      pfBallot("j2", { scores: { a: 10, b: 10 }, decision: "con" })
    ];
    const cal = computeCalibration(round, ballots);
    expect(cal.rows.length).toBe(2);
    expect(cal.disagreements.some((d) => d.title === "Decision disagreement")).toBe(true);
    expect(cal.disagreements.some((d) => d.title.includes("Wide spread"))).toBe(true);
    expect(cal.spread.a).toBeGreaterThan(5);
  });
});

describe("notifications", () => {
  it("flags required ballots, new rounds, and due assignments", () => {
    saveNotifReadAt("u1", "");
    const notifications = computeNotifications({
      uid: "u1",
      teams: [{ id: "t1", name: "North" }],
      assignments: [{ id: "a1", teamId: "t1", title: "Drill: rebuttal", assigneeIds: ["u1"], createdAt: new Date().toISOString() }],
      tournaments: [{ id: "t2", name: "Invite" }],
      rounds: [{ id: "r1", tournamentId: "t2", number: 1, status: "awaiting-ballot", judges: ["u1"], participants: {}, createdAt: new Date().toISOString() }],
      ballots: []
    });
    const kinds = notifications.map((n) => n.kind);
    expect(kinds).toContain("assignment");
    expect(kinds).toContain("ballot");
    expect(notifications.length).toBeGreaterThanOrEqual(2);
  });

  it("suppresses new-round notices once the user has read notifications", () => {
    saveNotifReadAt("u1", new Date(Date.now() + 60_000).toISOString());
    const notifications = computeNotifications({
      uid: "u1", teams: [], tournaments: [{ id: "t2" }],
      rounds: [{ id: "r1", tournamentId: "t2", number: 1, status: "not-started", participants: { u1: {} }, createdAt: new Date().toISOString() }],
      ballots: [], assignments: []
    });
    expect(notifications.some((n) => n.kind === "round")).toBe(false);
  });
});

describe("status helpers", () => {
  it("labels statuses", () => {
    expect(statusLabel(ROUND_STATUSES, "awaiting-ballot")).toBe("Awaiting ballot");
    expect(statusLabel(ROUND_STATUSES, "bogus")).toBe("bogus");
  });
});

describe("end-to-end tournament workflow (real store + access code paths)", () => {
  it("admin → event → participants → round → judge → ballot → results", async () => {
    const UID = "user-1";

    // 1. Admin creates a tournament (guest/solo mode treats them as admin).
    const tid = await createItem("tournaments", newTournament({
      name: "Autumn Invitational", status: "upcoming",
      admins: { [UID]: { name: "Coach" } }
    }));
    let t = await getItem("tournaments", tid);
    expect(tournamentRole(t, UID)).toBe("admin");
    expect(isTournamentAdmin(t, UID)).toBe(true);

    // 2. Create an event (Public Forum) + add participants + a judge.
    const eid = await createItem("events", newEvent({ name: "Varsity PF", formatId: "public-forum", participantType: "team", rubricId: "public-forum" }), tid);
    t = await updateTournamentAddPeople(t, tid, UID);
    expect(Object.keys(t.participants).length).toBe(4);
    expect(Object.keys(t.judges).length).toBe(1);

    // 3. Create a round assigned to the judge with the four participants.
    const rid = await createItem("rounds", newRound({
      number: 1, name: "Prelim 1", eventId: eid, status: "not-started",
      judges: ["judge-1"],
      participants: {
        "p1": { name: "Pro team A", side: "pro" }, "p2": { name: "Con team A", side: "con" },
        "p3": { name: "Pro team B", side: "pro" }, "p4": { name: "Con team B", side: "con" }
      }
    }), tid);
    let r = await getItem("rounds", rid, tid);
    expect(canJudgeRound(t, r, "judge-1")).toBe(true);
    expect(canJudgeRound(t, r, "someone-else")).toBe(false);

    // 4. Round goes live; the assigned judge starts a draft ballot.
    await updateItem("rounds", rid, { status: "active" }, tid);
    r = await getItem("rounds", rid, tid);
    expect(computeRoundStatus(r, []).status).toBe("active");
    expect(canCreateBallot(t, r, "judge-1")).toBe(true);

    const bid = await createItem("ballots", blankBallot({
      rubric: { id: "pf", name: "PF", decisionType: "win-loss", categories: [
        { id: "a", label: "A", max: 30 }, { id: "b", label: "B", max: 30 }
      ] },
      roundId: rid, judgeId: "judge-1"
    }), tid);
    let b = await getItem("ballots", bid, tid);
    expect(canWriteBallot(t, b, "judge-1")).toBe(true);
    expect(canWriteBallot(t, b, "judge-2")).toBe(false);

    // 5. The judge fills it in and submits; the ballot is now frozen.
    await updateItem("ballots", bid, {
      scores: { a: 26, b: 24 }, decision: "pro", feedback: "Better clash, cleaner weighing.",
      status: "submitted", submittedAt: new Date().toISOString()
    }, tid);
    b = await getItem("ballots", bid, tid);
    expect(b.status).toBe("submitted");
    expect(canWriteBallot(t, b, "judge-1")).toBe(false);

    // 6. Round advances and completes; results aggregate.
    const winner = roundWinner(r, [b]);
    expect(winner.winner).toBe("pro");
    const rows = computeRoundResults({ ...r, id: rid }, [b]);
    expect(rows.find((x) => x.id === "p1").wins).toBe(1);
    expect(rows.find((x) => x.id === "p2").losses).toBe(1);
  });

  it("coach → team → member → assignment → completion → feedback", async () => {
    const COACH = "coach-1";
    const MEMBER = "student-1";

    const tid = await createItem("teams", newTeam({
      name: "North High Debate", code: "ABC123",
      members: { [COACH]: { role: "coach", name: "Coach K" }, [MEMBER]: { role: "member", name: "Alex" } }
    }));
    const team = await getItem("teams", tid);
    expect(teamRole(team, COACH)).toBe("coach");
    expect(canManageTeam(team, MEMBER)).toBe(false);
    expect(canCreateAssignment(team, COACH)).toBe(true);
    expect(canCompleteAssignment(team, MEMBER)).toBe(true);

    const aid = await createItem("assignments", newAssignment({ title: "Drill: rebuttal blitz", kind: "drill", assigneeIds: [MEMBER], createdBy: COACH }), tid);
    const subId = await createItem("submissions", newSubmission({ assignmentId: aid, uid: MEMBER, name: "Alex", status: "done", selfScore: 8, completedAt: new Date().toISOString() }), tid);
    await updateItem("submissions", subId, { feedback: "Strong extend on the first contention.", status: "reviewed" }, tid);
    const sub = await getItem("submissions", subId, tid);
    expect(sub.feedback).toBe("Strong extend on the first contention.");
    expect(sub.status).toBe("reviewed");
    expect((await listItems("submissions", tid)).length).toBe(1);
  });
});

// Helper: add participants + judge to a tournament via the same patch the UI applies.
async function updateTournamentAddPeople(t, tid, adminUid) {
  const patch = {
    participants: {
      "p1": { name: "Pro team A", teamId: "tA", teamName: "Team A" },
      "p2": { name: "Con team A", teamId: "tA", teamName: "Team A" },
      "p3": { name: "Pro team B", teamId: "tB", teamName: "Team B" },
      "p4": { name: "Con team B", teamId: "tB", teamName: "Team B" }
    },
    judges: { "judge-1": { name: "Ms. Rivera" } },
    status: "active"
  };
  await updateItem("tournaments", tid, patch);
  return getItem("tournaments", tid);
}
