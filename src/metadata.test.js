import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  tokenizeTags,
  extractMetadataFromHtml,
  inferSourceType
} from "./metadata.js";

const PAGE = `<!DOCTYPE html>
<html>
<head>
  <title>Later School Start Times Improve Adolescent Sleep — The New York Times</title>
  <meta name="description" content="A new study tracks 12,000 students across three states." />
  <meta property="og:title" content="Later School Start Times Improve Adolescent Sleep" />
  <meta property="og:site_name" content="The New York Times" />
  <meta property="og:url" content="https://www.nytimes.com/2026/08/20/health/school-start-times.html" />
  <meta property="article:published_time" content="2026-08-20T05:00:00Z" />
  <meta name="author" content="Jane Q. Rodriguez" />
  <link rel="canonical" href="https://www.nytimes.com/2026/08/20/health/school-start-times.html" />
  <meta name="keywords" content="education, sleep, policy" />
</head>
<body></body>
</html>`;

describe("normalizeUrl", () => {
  it("accepts https URLs and strips fragments", () => {
    expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("rejects junk and non-http protocols with friendly messages", () => {
    expect(() => normalizeUrl("not a url")).toThrow(/valid URL/);
    expect(() => normalizeUrl("ftp://example.com/file")).toThrow(/http/);
    expect(() => normalizeUrl("")).toThrow(/Enter a URL/);
  });
});

describe("tokenizeTags", () => {
  it("parses meta tags with attributes in any order", () => {
    const tags = tokenizeTags('<meta content="hello" name="description"><meta name="x" content="y">');
    expect(tags).toHaveLength(2);
    expect(tags[0].attrs).toEqual({ content: "hello", name: "description" });
    expect(tags[1].attrs).toEqual({ name: "x", content: "y" });
  });

  it("decodes HTML entities", () => {
    const tags = tokenizeTags('<meta name="description" content="Caf&amp;eacute; &amp; policy" />');
    expect(tags[0].attrs.content).toBe("Café & policy");
  });
});

describe("extractMetadataFromHtml", () => {
  it("pulls title, site, author, date, description, canonical URL, and tags", () => {
    const out = extractMetadataFromHtml(PAGE);
    expect(out.title).toBe("Later School Start Times Improve Adolescent Sleep");
    expect(out.publication).toBe("The New York Times");
    expect(out.author).toBe("Jane Q. Rodriguez");
    expect(out.publishDate).toBe("2026-08-20");
    expect(out.description).toContain("12,000 students");
    expect(out.url).toBe("https://www.nytimes.com/2026/08/20/health/school-start-times.html");
    expect(out.tags).toEqual(["education", "sleep", "policy"]);
  });

  it("strips the site suffix from titles only when it matches the site name", () => {
    const html = '<html><head><title>Big Study — CNN</title><meta property="og:site_name" content="CNN"></head></html>';
    expect(extractMetadataFromHtml(html).title).toBe("Big Study");
  });

  it("keeps the whole title when no site name matches", () => {
    const html = '<html><head><title>Something Else — Blog</title></head></html>';
    expect(extractMetadataFromHtml(html).title).toBe("Something Else — Blog");
  });

  it("returns only fields actually found (no fabrication)", () => {
    const out = extractMetadataFromHtml("<html><head><title>Only a title</title></head></html>", "https://example.com/x");
    expect(out.author).toBeUndefined();
    expect(out.publishDate).toBeUndefined();
    expect(out.url).toBe("https://example.com/x");
    expect(out.title).toBe("Only a title");
  });
});

describe("inferSourceType", () => {
  it("classifies news, academic, journal, and government domains", () => {
    expect(inferSourceType("https://www.nytimes.com/2026/08/20/")).toBe("news");
    expect(inferSourceType("https://arxiv.org/abs/2401.00001")).toBe("academic");
    expect(inferSourceType("https://www.nature.com/articles/s41467-026-00001-0")).toBe("journal");
    expect(inferSourceType("https://www.census.gov/library/")).toBe("government");
    expect(inferSourceType("https://stanford.edu/research/")).toBe("academic");
  });

  it("defaults to website for unknown domains", () => {
    expect(inferSourceType("https://some-random-blog.example/")).toBe("website");
  });
});
