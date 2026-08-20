import { describe, it, expect } from "vitest";
import { breakdownBars, cx, prettyLabel, scoreLabel } from "./ui.js";

describe("scoreLabel", () => {
  it("maps score bands to labels", () => {
    expect(scoreLabel(97)).toBe("Outstanding");
    expect(scoreLabel(95)).toBe("Outstanding");
    expect(scoreLabel(90)).toBe("Excellent");
    expect(scoreLabel(85)).toBe("Excellent");
    expect(scoreLabel(75)).toBe("Solid");
    expect(scoreLabel(70)).toBe("Solid");
    expect(scoreLabel(60)).toBe("Needs work");
    expect(scoreLabel(50)).toBe("Needs work");
    expect(scoreLabel(30)).toBe("Breaks down");
  });

  it("handles missing scores", () => {
    expect(scoreLabel(null)).toBe("");
    expect(scoreLabel(undefined)).toBe("");
  });
});

describe("prettyLabel", () => {
  it("title-cases snake_case keys", () => {
    expect(prettyLabel("argument_strength")).toBe("Argument Strength");
    expect(prettyLabel("assumption_audit")).toBe("Assumption Audit");
    expect(prettyLabel("evidence_and_warrant")).toBe("Evidence & Warrant");
  });

  it("handles empty input", () => {
    expect(prettyLabel(null)).toBe("");
  });
});

describe("cx", () => {
  it("joins truthy classes", () => {
    expect(cx("a", "", "b", null, "c")).toBe("a b c");
  });
});

describe("breakdownBars", () => {
  it("normalizes widths against the largest value", () => {
    const bars = breakdownBars({ a: 10, b: 20 });
    expect(bars).toHaveLength(2);
    const [a, b] = bars;
    expect(b.width).toBe(100);
    expect(a.width).toBe(50);
  });

  it("ignores non-numeric values", () => {
    const bars = breakdownBars({ a: 10, b: "x", c: null });
    expect(bars).toHaveLength(1);
    expect(bars[0].key).toBe("a");
  });

  it("returns [] for empty or missing breakdowns", () => {
    expect(breakdownBars(null)).toEqual([]);
    expect(breakdownBars({})).toEqual([]);
  });
});
