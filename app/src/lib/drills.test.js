import { describe, it, expect, beforeAll } from "vitest";
import {
  DRILLS, drillById, drillsFor, DIFFICULTIES, difficultyLabel, minutesLabel,
  loadLocalDrillResults, saveLocalDrillResult, completedDrillIdsFromLocal
} from "./drills.js";

// Node test env has no browser localStorage — provide an in-memory shim.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
beforeAll(() => { globalThis.localStorage = new MemoryStorage(); });

describe("drill catalog", () => {
  it("has a healthy catalog with all required fields", () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(8);
    for (const d of DRILLS) {
      expect(d.id).toBeTruthy();
      expect(d.title).toBeTruthy();
      expect(Array.isArray(d.instructions)).toBe(true);
      expect(d.instructions.length).toBeGreaterThanOrEqual(3);
      expect(d.minutes).toBeGreaterThan(0);
      expect(DIFFICULTIES.some((x) => x.id === d.difficulty)).toBe(true);
      expect(d.skills.length).toBeGreaterThan(0);
      expect(d.events.length).toBeGreaterThan(0);
      expect(d.selfScore?.max).toBeGreaterThan(0);
    }
  });

  it("finds drills by id and returns null for unknown ids", () => {
    expect(drillById("rebuttal-blitz")?.title).toBe("Rebuttal blitz");
    expect(drillById("nope")).toBeNull();
  });

  it("filters by event, skill, difficulty and marks completion", () => {
    const out = drillsFor({ event: "speech", skill: "confidence", difficulty: "intermediate", completed: ["impromptu-60"] });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.events.includes("speech") && d.skills.includes("confidence") && d.difficulty === "intermediate")).toBe(true);
    const done = out.find((d) => d.id === "impromptu-60");
    expect(done?.completed).toBe(true);
  });

  it("labels difficulties and minutes", () => {
    expect(difficultyLabel("competitive")).toBe("Competitive");
    expect(minutesLabel(5)).toBe("5 min");
  });
});

describe("local completion storage", () => {
  it("round-trips a drill result", () => {
    localStorage.clear();
    saveLocalDrillResult("rebuttal-blitz", { score: 8, seconds: 480 });
    const all = loadLocalDrillResults();
    expect(all["rebuttal-blitz"].score).toBe(8);
    expect(all["rebuttal-blitz"].seconds).toBe(480);
    expect(completedDrillIdsFromLocal()).toContain("rebuttal-blitz");
    localStorage.clear();
  });

  it("does not list a drill started but not scored as completed", () => {
    localStorage.clear();
    saveLocalDrillResult("crossfire-round", { startedAt: Date.now() });
    expect(completedDrillIdsFromLocal()).not.toContain("crossfire-round");
    localStorage.clear();
  });
});
