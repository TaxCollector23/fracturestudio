import { describe, it, expect } from "vitest";
import {
  tournamentRole, isTournamentAdmin, isTournamentJudge, canManageTournament,
  isRoundJudge, canJudgeRound, canCreateBallot, canViewBallot, canWriteBallot,
  teamRole, isTeamCoach, canManageTeam, canCreateAssignment, canCompleteAssignment,
  canSeeTeamProgress, canSeeCalibration
} from "./access.js";

const t = {
  admins: { a1: { name: "A" } },
  judges: { j1: { name: "J" } },
  participants: { p1: { name: "P" } }
};
const team = {
  members: { c1: { role: "coach" }, m1: { role: "member" }, x1: { role: "admin" } }
};

describe("tournament roles", () => {
  it("resolves the highest role per user", () => {
    expect(tournamentRole(t, "a1")).toBe("admin");
    expect(tournamentRole(t, "j1")).toBe("judge");
    expect(tournamentRole(t, "p1")).toBe("participant");
    expect(tournamentRole(t, "stranger")).toBe(null);
  });

  it("treats guests as solo admins", () => {
    expect(tournamentRole(t, null)).toBe("admin");
    expect(isTournamentAdmin(t, null)).toBe(true);
  });

  it("only admins manage the tournament", () => {
    expect(canManageTournament(t, "a1")).toBe(true);
    expect(canManageTournament(t, "j1")).toBe(false);
    expect(canManageTournament(t, "p1")).toBe(false);
    expect(isTournamentJudge(t, "j1")).toBe(true);
  });
});

describe("round + ballot access", () => {
  const round = { judges: ["j1", "j2"], participants: { p1: {} } };

  it("admins may judge any round; judges only assigned ones", () => {
    expect(canJudgeRound(t, round, "a1")).toBe(true);
    expect(canJudgeRound(t, round, "j1")).toBe(true);
    expect(canJudgeRound(t, round, "j9")).toBe(false);
    expect(isRoundJudge(round, "j2")).toBe(true);
  });

  it("ballots are visible to tournament members and own judges", () => {
    const b = { judgeId: "j2", status: "draft" };
    expect(canViewBallot(t, b, "p1")).toBe(true);
    expect(canViewBallot(t, b, "j2")).toBe(true);
    expect(canViewBallot(t, b, "stranger")).toBe(false);
  });

  it("judges edit only their own drafts; admins edit anything", () => {
    const draft = { judgeId: "j1", status: "draft" };
    const submitted = { judgeId: "j1", status: "submitted" };
    expect(canWriteBallot(t, draft, "j1")).toBe(true);
    expect(canWriteBallot(t, draft, "j2")).toBe(false);
    expect(canWriteBallot(t, submitted, "j1")).toBe(false); // frozen after submit
    expect(canWriteBallot(t, submitted, "a1")).toBe(true);
  });

  it("a judge can create a ballot only for their own assigned round", () => {
    expect(canCreateBallot(t, { judges: ["j1"] }, "j1")).toBe(true);
    expect(canCreateBallot(t, { judges: ["j2"] }, "j1")).toBe(false);
    expect(canCreateBallot(t, { judges: [] }, "a1")).toBe(true);
  });
});

describe("team roles", () => {
  it("resolves member/coach/admin and grants management to coaches", () => {
    expect(teamRole(team, "c1")).toBe("coach");
    expect(teamRole(team, "x1")).toBe("admin");
    expect(teamRole(team, "m1")).toBe("member");
    expect(teamRole(team, "nobody")).toBe(null);
    expect(isTeamCoach(team, "c1")).toBe(true);
    expect(isTeamCoach(team, "m1")).toBe(false);
    expect(canManageTeam(team, "x1")).toBe(true);
    expect(canManageTeam(team, "m1")).toBe(false);
  });

  it("assignment creation is coach-only; completion is member-only", () => {
    expect(canCreateAssignment(team, "c1")).toBe(true);
    expect(canCreateAssignment(team, "m1")).toBe(false);
    expect(canCompleteAssignment(team, "m1")).toBe(true);
    expect(canCompleteAssignment(team, "nobody")).toBe(false);
  });

  it("aggregate progress and calibration are coach/admin views", () => {
    expect(canSeeTeamProgress(team, "c1")).toBe(true);
    expect(canSeeTeamProgress(team, "m1")).toBe(false);
    expect(canSeeCalibration(t, "a1")).toBe(true);
    expect(canSeeCalibration(t, "j1")).toBe(false);
  });
});
