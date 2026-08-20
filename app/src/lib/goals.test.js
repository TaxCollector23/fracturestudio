import { describe, it, expect, beforeAll } from "vitest";
import {
  newGoal, loadLocalGoals, saveLocalGoal, removeLocalGoal,
  buildTrainingPlan, dueSoon, GOAL_TEMPLATES
} from "./goals.js";

// Node test env has no browser localStorage — provide an in-memory shim.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
beforeAll(() => { globalThis.localStorage = new MemoryStorage(); });

describe("goal storage", () => {
  it("creates well-formed goals", () => {
    const g = newGoal({ text: "Win regionals" });
    expect(g.text).toBe("Win regionals");
    expect(g.status).toBe("active");
    expect(g.priority).toBe("medium");
    expect(g.createdAt).toBeTruthy();
  });

  it("round-trips local goals", () => {
    localStorage.clear();
    const g = { ...newGoal({ text: "Improve rebuttal" }), id: "g1" };
    saveLocalGoal(g);
    const updated = { ...g, status: "done" };
    saveLocalGoal(updated);
    expect(loadLocalGoals().length).toBe(1);
    expect(loadLocalGoals()[0].status).toBe("done");
    removeLocalGoal("g1");
    expect(loadLocalGoals().length).toBe(0);
    localStorage.clear();
  });

  it("offers sensible goal templates", () => {
    expect(GOAL_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });
});

describe("training plan", () => {
  const drills = [
    { id: "rebuttal-blitz", title: "Rebuttal blitz", skills: ["rebuttal"] },
    { id: "impromptu-60", title: "Impromptu minute", skills: ["confidence", "pacing"] },
    { id: "timed-case-defense", title: "Timed case defense", skills: ["rebuttal", "time-management"] },
    { id: "claim-warrant-impact", title: "CWI builder", skills: ["argumentation"] }
  ];

  const profile = {
    sessions: 4,
    weakest: { id: "rebuttal", avg: 38 },
    persistentWeaknesses: [{ id: "rebuttal", avg: 38 }, { id: "evidence", avg: 41 }],
    recentlyImproved: [{ id: "argumentation", delta: 8 }]
  };

  it("builds a 5-day adaptive plan with why + actions", () => {
    const plan = buildTrainingPlan({ profile, drills, goals: [], today: new Date("2026-08-20") });
    expect(plan.length).toBe(5);
    for (const day of plan) {
      expect(day.day).toMatch(/^Day \d$/);
      expect(day.title).toBeTruthy();
      expect(day.why).toBeTruthy();
      expect(day.action?.type).toBeTruthy();
      expect(day.action?.label).toBeTruthy();
    }
  });

  it("leads with the weakest skill on day 1", () => {
    const plan = buildTrainingPlan({ profile, drills, goals: [], today: new Date("2026-08-20") });
    expect(plan[0].skill).toBe("rebuttal");
  });

  it("anchors the plan to an active goal with a deadline", () => {
    const goals = [{ text: "Regionals", event: "argument", targetDate: "2026-08-22", priority: "high", status: "active" }];
    const plan = buildTrainingPlan({ profile, drills, goals, today: new Date("2026-08-20") });
    expect(plan[2].title).toContain("Regionals");
    expect(plan[4].title).toContain("simulation");
  });

  it("falls back gracefully with no profile data", () => {
    const plan = buildTrainingPlan({ profile: null, drills: [], goals: [], today: new Date("2026-08-20") });
    expect(plan.length).toBe(5);
    expect(plan[0].action?.type).toBe("route");
  });

  it("avoids reusing a completed drill for the same skill", () => {
    const plan = buildTrainingPlan({ profile, drills, goals: [], completed: ["rebuttal-blitz"], today: new Date("2026-08-20") });
    expect(plan[0].action?.target).not.toBe("rebuttal-blitz");
  });
});

describe("dueSoon", () => {
  it("flags goals within five days", () => {
    const today = new Date("2026-08-20");
    expect(dueSoon("2026-08-24", today)).toBe(true);
    expect(dueSoon("2026-08-26", today)).toBe(false);
    expect(dueSoon("2026-08-19", today)).toBe(false);
    expect(dueSoon("", today)).toBe(false);
  });
});
