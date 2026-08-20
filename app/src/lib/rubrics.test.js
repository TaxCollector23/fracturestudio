import { describe, it, expect } from "vitest";
import { RUBRICS, rubricById, snapshotRubric, blankBallot, categoryTotal, ballotTotal, scoresComplete, validateBallot } from "./rubrics.js";

describe("rubrics", () => {
  it("snapshots deep-copy a rubric so edits never leak", () => {
    const snap = snapshotRubric(RUBRICS["public-forum"]);
    snap.categories[0].label = "Hacked";
    expect(RUBRICS["public-forum"].categories[0].label).toBe("Argumentation");
  });

  it("blankBallot carries the rubric snapshot and default decision type", () => {
    const b = blankBallot({ rubric: RUBRICS.ld, roundId: "r1", judgeId: "j1" });
    expect(b.roundId).toBe("r1");
    expect(b.judgeId).toBe("j1");
    expect(b.status).toBe("draft");
    expect(b.decisionType).toBe("win-loss");
    expect(b.rubricSnapshot.categories.length).toBe(RUBRICS.ld.categories.length);
  });

  it("clamps category scores into the valid range", () => {
    expect(categoryTotal({ max: 30 }, 5)).toBe(5);
    expect(categoryTotal({ max: 30 }, 99)).toBe(30);
    expect(categoryTotal({ max: 30 }, -4)).toBe(0);
    expect(categoryTotal({ max: 30 }, "nope")).toBe(null);
  });

  it("totals scores across the snapshot categories", () => {
    const b = blankBallot({ rubric: RUBRICS["public-forum"] });
    b.scores = { argumentation: 25, evidence: 20, organization: 22, delivery: 24, rebuttal: 26, teamwork: 21 };
    expect(ballotTotal(b)).toBe(138);
    expect(scoresComplete(b)).toBe(true);
  });

  it("a ballot missing scores is incomplete and flagged", () => {
    const b = blankBallot({ rubric: RUBRICS.ld });
    b.scores = { argumentation: 25 };
    expect(scoresComplete(b)).toBe(false);
    const issues = validateBallot(b);
    expect(issues.filter((i) => i.field.startsWith("scores.")).length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes("Missing score"))).toBe(true);
  });
});

describe("ballot validation", () => {
  function readyBallot() {
    const b = blankBallot({ rubric: RUBRICS["public-forum"], roundId: "r1", judgeId: "j1" });
    b.scores = { argumentation: 24, evidence: 22, organization: 25, delivery: 23, rebuttal: 26, teamwork: 21 };
    b.decision = "pro";
    b.feedback = "Strong clash on the first contention; con dropped the second.";
    return b;
  }

  it("passes a complete ballot", () => {
    expect(validateBallot(readyBallot())).toEqual([]);
  });

  it("requires a decision, scores, and feedback — each with a clear message", () => {
    const b = readyBallot();
    b.decision = "";
    b.feedback = "";
    delete b.scores.evidence;
    const issues = validateBallot(b);
    const messages = issues.map((i) => i.message).join(" ");
    expect(messages).toContain("winner");
    expect(messages).toContain("Evidence");
    expect(messages).toContain("feedback");
  });

  it("rejects out-of-range scores without silently clamping validation", () => {
    const b = readyBallot();
    b.scores.argumentation = 99;
    const issues = validateBallot(b);
    expect(issues.some((i) => i.message.includes("outside the 30-point range"))).toBe(true);
  });

  it("requires a rank for rank-style rubrics", () => {
    const b = blankBallot({ rubric: RUBRICS.congress, roundId: "r1", judgeId: "j1" });
    b.scores = { argumentation: 20, evidence: 18, questioning: 15, delivery: 17, parliamentary: 19 };
    b.feedback = "Well-precedented and direct.";
    const issues = validateBallot(b);
    expect(issues.some((i) => i.field === "rank")).toBe(true);
    b.rank = 2;
    b.rankParticipantId = "p2";
    expect(validateBallot(b)).toEqual([]);
  });
});
