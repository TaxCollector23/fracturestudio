import { describe, it, expect } from "vitest";
import {
  buildTooThinAudit,
  isTooThinForAudit,
  normalizeAudit,
  prepareAuditFromModelText
} from "./audit-utils.js";

const SAMPLE = `Schools should start no earlier than 9:00 a.m. because sleep deprivation harms students. The CDC reports that most teenagers get less than seven hours of sleep on school nights. Because early bells force students to wake before their natural circadian rhythm, they arrive too tired to learn. Therefore, delaying the bell improves academic outcomes and student well-being.`;

describe("isTooThinForAudit", () => {
  it("flags very short or vague text", () => {
    expect(isTooThinForAudit("hi")).toBe(true);
    expect(isTooThinForAudit("a a a a a a a a a a a a a")).toBe(true);
  });

  it("accepts a real argument", () => {
    expect(isTooThinForAudit(SAMPLE)).toBe(false);
  });
});

describe("buildTooThinAudit", () => {
  it("returns a low score with one clear repair", () => {
    const audit = buildTooThinAudit("hello");
    expect(audit.overall_score).toBe(4);
    expect(audit.priority_fixes).toHaveLength(1);
    expect(audit.argument_strength.claims).toEqual([]);
  });

  it("handles empty input without throwing", () => {
    const audit = buildTooThinAudit("");
    expect(audit.overall_score).toBe(0);
    expect(typeof audit.verdict).toBe("string");
  });
});

describe("normalizeAudit", () => {
  it("fills missing fields with safe defaults", () => {
    const audit = normalizeAudit({}, SAMPLE);
    // A coherent short argument gets calibrated up from the floor of 20.
    expect(audit.overall_score).toBe(62);
    expect(audit.priority_fixes.length).toBeGreaterThan(0);
    expect(audit.assumption_audit).toEqual([]);
  });

  it("clamps the overall score to 0..100", () => {
    const audit = normalizeAudit({ overall_score: 250 }, SAMPLE);
    expect(audit.overall_score).toBe(100);
    // Nonsense input is not calibrated upward, so the clamp is visible.
    const low = normalizeAudit({ overall_score: -10 }, "a a a a");
    expect(low.overall_score).toBe(0);
  });

  it("keeps score_breakdown summing to the overall score", () => {
    const audit = normalizeAudit(
      {
        overall_score: 85,
        score_breakdown: { argument_strength: 21, assumption_audit: 11, logic: 15, rhetoric: 15 },
        verdict: "Solid",
        priority_fixes: [],
        claims: [],
        assumption_audit: []
      },
      SAMPLE
    );
    const dims = Object.values(audit.score_breakdown);
    expect(dims.reduce((a, b) => a + b, 0)).toBe(audit.overall_score);
    for (const value of dims) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(25);
    }
  });

  it("preserves the lean schema (claims, strengths, mode_analysis)", () => {
    const audit = normalizeAudit(
      {
        overall_score: 70,
        claims: [{ quote: "Schools should start later.", rating: "STRONG", warrant: "Sleep matters." }],
        strengths: [{ quote: "The CDC citation lands well.", why: "It names an authority." }],
        mode_analysis: { impact_weighing: { magnitude: "large" } }
      },
      SAMPLE
    );
    expect(audit.claims).toHaveLength(1);
    expect(audit.claims[0].rating).toBe("STRONG");
    expect(audit.strengths).toHaveLength(1);
    expect(audit.mode_analysis.impact_weighing.magnitude).toBe("large");
  });

  it("rebuilds claims from sentences when the model returned none", () => {
    const audit = normalizeAudit({ overall_score: 55, claims: [] }, SAMPLE);
    expect(audit.argument_strength.claims.length).toBeGreaterThan(0);
  });
});

describe("prepareAuditFromModelText", () => {
  it("parses valid JSON", () => {
    const { audit, recovered } = prepareAuditFromModelText(
      JSON.stringify({ overall_score: 66, verdict: "Decent start." }),
      SAMPLE
    );
    expect(recovered).toBe(false);
    expect(audit.overall_score).toBe(66);
  });

  it("repairs malformed JSON instead of throwing", () => {
    const { audit, recovered } = prepareAuditFromModelText("{overall_score: 50, verdict: 'ok',}", SAMPLE);
    expect(recovered).toBe(true);
    expect(typeof audit.overall_score).toBe("number");
    expect(audit.priority_fixes.length).toBeGreaterThan(0);
  });
});
