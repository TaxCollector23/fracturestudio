import { describe, it, expect } from "vitest";
import {
  formatCitation, citationPreview, citationIssues, isValidUrl, isValidDoi,
  bibliographySortKey, authorInverted, authorApa, parseSourceDate, sentenceCase
} from "./citations.js";

const fullSource = {
  title: "Later School Start Times Improve Adolescent Sleep and Academic Performance",
  url: "https://www.nytimes.com/2026/08/20/health/school-start-times.html",
  doi: "10.1016/j.sleep.2026.08.001",
  authors: [
    { name: "Jane Q. Rodriguez" },
    { name: "Michael Chen" }
  ],
  publication: "The New York Times",
  publisher: "The New York Times Company",
  publishDate: "2026-08-20",
  accessDate: "2026-08-21"
};

describe("author formatting", () => {
  it("inverts names for MLA/Chicago and abbreviates for APA", () => {
    expect(authorInverted({ name: "Jane Q. Rodriguez" })).toBe("Rodriguez, Jane Q.");
    expect(authorApa({ name: "Jane Q. Rodriguez" })).toBe("Rodriguez, J. Q.");
    expect(authorInverted({ name: "Single" })).toBe("Single");
    expect(authorInverted({ name: "World Health Organization", organization: true })).toBe("World Health Organization");
  });

  it("parses date shapes", () => {
    expect(parseSourceDate("2026-08-20")).toEqual({ year: 2026, month: 8, day: 20, raw: "2026-08-20" });
    expect(parseSourceDate("2026")).toEqual({ year: 2026, month: 0, day: 0, raw: "2026" });
    expect(parseSourceDate("")).toEqual({ year: 0, month: 0, day: 0, raw: "" });
  });
});

describe("citation generation", () => {
  it("generates MLA with container, publisher, date, URL, and access date", () => {
    const mla = formatCitation(fullSource, "mla");
    expect(mla).toContain("Rodriguez, Jane Q., and Michael Chen.");
    expect(mla).toContain("“Later School Start Times Improve Adolescent Sleep and Academic Performance.”");
    expect(mla).toContain("*The New York Times*,");
    expect(mla).toContain("The New York Times Company,");
    expect(mla).toContain("20 Aug. 2026,");
    expect(mla).toContain("https://www.nytimes.com/2026/08/20/health/school-start-times.html.");
    expect(mla).toContain("Accessed 21 Aug. 2026.");
  });

  it("generates APA with initials, parenthesized date, and sentence case", () => {
    const apa = formatCitation(fullSource, "apa");
    expect(apa).toContain("Rodriguez, J. Q., & Chen, M.");
    expect(apa).toContain("(2026, August 20).");
    expect(apa).toContain("*The New York Times*.");
    expect(apa).toContain("https://www.nytimes.com/2026/08/20/health/school-start-times.html");
    expect(apa).not.toContain("Later School Start Times Improve"); // sentence-cased, not title-cased
  });

  it("generates Chicago notes-bibliography", () => {
    const chicago = formatCitation(fullSource, "chicago");
    expect(chicago).toContain("Rodriguez, Jane Q., and Michael Chen.");
    expect(chicago).toContain("*The New York Times*,");
    expect(chicago).toContain("August 20, 2026.");
    expect(chicago).toContain("https://www.nytimes.com/2026/08/20/health/school-start-times.html.");
  });

  it("generates a short debate-card attribution", () => {
    const d = formatCitation(fullSource, "debate");
    expect(d).toContain("Rodriguez, J., Chen, M.");
    expect(d).toContain("The New York Times");
    expect(d).toContain("Aug. 2026");
  });

  it("never fabricates missing data — falls back gracefully", () => {
    const minimal = { title: "A Report", url: "https://example.org/report" };
    const mla = formatCitation(minimal, "mla");
    expect(mla).toContain("“A Report.”");
    expect(mla).toContain("n.d.");
    expect(mla).toContain("https://example.org/report");
    expect(mla).not.toContain("Unknown");
    const apa = formatCitation({ url: "https://example.org/x" }, "apa");
    expect(apa).toContain("(n.d.).");
    expect(apa).toContain("https://example.org/x");
  });

  it("preview covers all registered styles", () => {
    const preview = citationPreview(fullSource);
    expect(Object.keys(preview).sort()).toEqual(["apa", "chicago", "debate", "mla"]);
  });
});

describe("validation", () => {
  it("flags missing title, author, publication, date, bad URL, malformed DOI", () => {
    const issues = citationIssues({ url: "not-a-url", doi: "10.1234" });
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("title");
    expect(fields).toContain("authors");
    expect(fields).toContain("publication");
    expect(fields).toContain("publishDate");
    expect(fields).toContain("url");
    expect(fields).toContain("doi");
  });

  it("passes a complete source", () => {
    expect(citationIssues(fullSource)).toEqual([]);
  });

  it("validates URLs and DOIs", () => {
    expect(isValidUrl("https://example.org")).toBe(true);
    expect(isValidUrl("example.org")).toBe(false);
    expect(isValidDoi("10.1016/j.sleep.2026.08.001")).toBe(true);
    expect(isValidDoi("10.1234")).toBe(false);
  });

  it("sorts bibliography alphabetically by author then title", () => {
    expect(bibliographySortKey(fullSource)).toBe("rodriguez, jane q.");
    expect(bibliographySortKey({ title: "The Green New Deal", url: "" })).toBe("green new deal");
  });
});

describe("helpers", () => {
  it("sentence-cases APA titles but keeps proper acronyms after periods", () => {
    expect(sentenceCase("SCHOOLS SHOULD START LATER")).toBe("Schools should start later");
    expect(sentenceCase("The U.S. economy grew.")).toBe("The U.S. economy grew.");
  });
});
