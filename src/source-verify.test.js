import { describe, it, expect } from "vitest";
import { extractClaims, extractQuotedPassages } from "./source-verify.js";

describe("extractQuotedPassages", () => {
  it("finds straight and curly quoted passages", () => {
    const text = 'He wrote "teenagers need nine hours of sleep" and then said \u201Cstart times matter\u201D too.';
    const passages = extractQuotedPassages(text);
    expect(passages).toContain("teenagers need nine hours of sleep");
    expect(passages).toContain("start times matter");
  });

  it("returns an empty array for plain text", () => {
    expect(extractQuotedPassages("no quotes here at all")).toEqual([]);
  });
});

describe("extractClaims", () => {
  it("pulls factual sentences and dedupes them", () => {
    const essay = [
      "The CDC reports that most teenagers get less than seven hours of sleep.",
      "The CDC reports that most teenagers get less than seven hours of sleep.",
      "Schools should start later because sleep deprivation harms students."
    ].join(" ");

    const claims = extractClaims(essay);
    const texts = claims.map((c) => c.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.some((t) => t.includes("CDC"))).toBe(true);
  });

  it("gives quoted passages top priority", () => {
    const essay = 'The author claims "this exact sentence is verified" and then argues the point.';
    const claims = extractClaims(essay);
    expect(claims[0].text).toContain("this exact sentence is verified");
  });

  it("pulls quotes from audit claims when provided", () => {
    const audit = {
      claims: [{ quote: "According to the CDC, early bells harm learning." }]
    };
    const claims = extractClaims("", audit);
    expect(claims.some((c) => c.text === "According to the CDC, early bells harm learning.")).toBe(true);
  });
});
