import { describe, it, expect } from "vitest";
import { DEFAULT_PREFS, DEPTHS, FORMATS, depthById, formatById } from "./prefs.js";

describe("formatById", () => {
  it("resolves known formats", () => {
    expect(formatById("speech").label).toBe("Speech / Presentation");
    expect(formatById("rubric").label).toBe("Rubric Grading");
    expect(formatById("college-essay").label).toBe("College Essay");
  });

  it("falls back to the first format for unknown ids", () => {
    expect(formatById("bogus")).toBe(FORMATS[0]);
  });
});

describe("depthById", () => {
  it("resolves known depths and falls back to medium", () => {
    expect(depthById("surface").label).toBe("Surface");
    expect(depthById("extreme").label).toBe("Extreme");
    expect(depthById("bogus").label).toBe(DEPTHS[1].label);
  });
});

describe("DEFAULT_PREFS", () => {
  it("stays a stable, valid default", () => {
    expect(DEFAULT_PREFS.analysisFormat).toBe("argument");
    expect(DEFAULT_PREFS.depthLevel).toBe("medium");
    expect(DEFAULT_PREFS.citationStyle).toBe("mla");
    expect(FORMATS.some((f) => f.id === DEFAULT_PREFS.analysisFormat)).toBe(true);
    expect(DEPTHS.some((d) => d.id === DEFAULT_PREFS.depthLevel)).toBe(true);
  });
});
