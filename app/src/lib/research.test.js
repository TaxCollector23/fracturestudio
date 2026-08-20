import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  newSource, newExcerpt, newResearchQuestion, newResearchCollection, newResearchTask, newConflict,
  normalizeUrl, findDuplicateSources, researchGaps, topicCoverage, buildBibliography,
  evidenceForArgument, argumentsForEvidence, questionsForSource, excerptsForSourceId, evidenceForSource,
  topicActivity, recencyBuckets, researchSearch, sourceAttribution, hostOf, authorNames
} from "./research.js";
import { formatCitation } from "./citations.js";
import { setPrepStore, createItem, updateItem, listItems } from "./prep.js";

describe("source helpers", () => {
  it("normalizes URLs for duplicate comparison", () => {
    expect(normalizeUrl("https://www.Example.com/path/?utm_source=x#frag")).toBe(normalizeUrl("http://example.com/path"));
    expect(normalizeUrl("https://example.com/path/")).toBe(normalizeUrl("https://example.com/path"));
  });

  it("derives attribution and host", () => {
    const s = newSource({ title: "T", url: "https://www.nytimes.com/x", authors: [{ name: "Jane Doe" }], publication: "NYT", publishDate: "2026-08" });
    expect(authorNames(s)).toEqual(["Jane Doe"]);
    expect(sourceAttribution(s)).toContain("Jane Doe");
    expect(sourceAttribution(s)).toContain("NYT");
    expect(hostOf(s.url)).toBe("nytimes.com");
  });
});

describe("duplicate detection", () => {
  it("finds URL, DOI, and title duplicates without merging", () => {
    const existing = [
      newSource({ id: "a", url: "https://www.example.com/report", title: "Report on X" }),
      newSource({ id: "b", doi: "10.1016/j.sleep.2026.08.001", title: "Different" }),
      newSource({ id: "c", title: "The Green New Deal Explained", url: "" })
    ];
    const cand = newSource({ url: "http://example.com/report/" });
    const byUrl = findDuplicateSources(existing, cand);
    expect(byUrl.map((d) => d.reason)).toContain("url");

    const byDoi = findDuplicateSources(existing, newSource({ doi: "10.1016/J.SLEEP.2026.08.001" }));
    expect(byDoi.map((d) => d.reason)).toContain("doi");

    const byTitle = findDuplicateSources(existing, newSource({ title: "the green new deal explained!" }));
    expect(byTitle.map((d) => d.reason)).toContain("title");

    expect(findDuplicateSources(existing, newSource({ title: "Totally new thing" }))).toEqual([]);
  });
});

describe("research gaps", () => {
  const topics = [{ id: "t1", name: "AI Regulation" }];

  it("flags unanswered questions, unlinked evidence, unsupported arguments, bare claims, and unextracted sources", () => {
    const gaps = researchGaps({
      topics,
      topicId: "t1",
      questions: [{ id: "q1", topicIds: ["t1"], question: "What is the impact of AI?", priority: "high", status: "unanswered" }],
      sources: [{ id: "s1", topicIds: ["t1"], title: "AI Report", url: "https://x.io" }],
      evidence: [{ id: "e1", topicIds: ["t1"], text: "AI could displace jobs", topic: "AI Regulation" }],
      blocks: [{ id: "b1", topicIds: ["t1"], tag: "No link" }],
      cases: [{ id: "c1", topicIds: ["t1"], title: "Pro case", sections: [{ title: "Jobs", claim: "AI hurts jobs", evidenceIds: [] }] }]
    });
    const kinds = gaps.map((g) => g.kind);
    expect(kinds).toContain("question");
    expect(kinds).toContain("evidence");
    expect(kinds).toContain("argument");
    expect(kinds).toContain("claim");
    expect(kinds).toContain("source");
    expect(gaps.find((g) => g.kind === "question").severity).toBe("danger"); // high priority
  });

  it("resolves gaps once evidence links to the argument", () => {
    const gaps = researchGaps({
      topics,
      topicId: "t1",
      questions: [],
      sources: [],
      evidence: [{ id: "e1", topicIds: ["t1"], text: "X", blockIds: ["b1"] }],
      blocks: [{ id: "b1", topicIds: ["t1"], tag: "No link" }],
      cases: []
    });
    expect(gaps.some((g) => g.kind === "argument")).toBe(false);
    expect(gaps.some((g) => g.kind === "evidence")).toBe(false);
  });

  it("flags one-sided research", () => {
    const gaps = researchGaps({
      topics,
      topicId: "t1",
      questions: [], sources: [],
      evidence: [
        { id: "e1", topicIds: ["t1"], tags: ["pro"] },
        { id: "e2", topicIds: ["t1"], tags: ["aff"] },
        { id: "e3", topicIds: ["t1"], tags: ["pro"] }
      ],
      blocks: [], cases: []
    });
    expect(gaps.some((g) => g.kind === "balance")).toBe(true);
  });
});

describe("coverage", () => {
  it("computes explainable parts + counts and a score from those parts", () => {
    const cov = topicCoverage({
      topics: [{ id: "t1", name: "AI" }],
      topicId: "t1",
      questions: [
        { id: "q1", topicIds: ["t1"], status: "answered", sourceIds: ["s1"] },
        { id: "q2", topicIds: ["t1"], status: "unanswered" }
      ],
      sources: [{ id: "s1", topicIds: ["t1"] }],
      evidence: [
        { id: "e1", topicIds: ["t1"], blockIds: ["b1"] },
        { id: "e2", topicIds: ["t1"] }
      ],
      blocks: [{ id: "b1", topicIds: ["t1"], tag: "x" }],
      cases: []
    });
    expect(cov.counts.questions).toBe(2);
    expect(cov.counts.answered).toBe(1);
    expect(cov.counts.unanswered).toBe(1);
    expect(cov.counts.unlinkedEvidence).toBe(1);
    expect(cov.parts.length).toBe(3);
    expect(cov.parts[0].value).toBe(1); // one of two questions has research
    expect(cov.parts[0].total).toBe(2);
    expect(cov.score).toBeGreaterThan(0);
    expect(cov.score).toBeLessThanOrEqual(100);
  });

  it("gives a perfect score when everything is empty (no false alarm)", () => {
    const cov = topicCoverage({ topicId: "t1", questions: [], sources: [], evidence: [], blocks: [], cases: [] });
    expect(cov.score).toBe(100);
    expect(cov.counts.sources).toBe(0);
  });
});

describe("relationships", () => {
  const evidence = [
    { id: "e1", blockIds: ["b1"], caseIds: ["c1"] },
    { id: "e2", caseIds: ["c2"] }
  ];
  it("finds evidence for an argument", () => {
    expect(evidenceForArgument(evidence, { blockId: "b1" }).map((e) => e.id)).toEqual(["e1"]);
    expect(evidenceForArgument(evidence, { caseId: "c2" }).map((e) => e.id)).toEqual(["e2"]);
  });
  it("finds where evidence is used", () => {
    const blocks = [{ id: "b1", tag: "No link" }];
    const cases = [{ id: "c1", title: "Pro", sections: [{ title: "Jobs", evidenceIds: ["e1"] }] }];
    const usage = argumentsForEvidence(evidence[0], blocks, cases);
    expect(usage.blocks.map((b) => b.id)).toEqual(["b1"]);
    expect(usage.cases[0].sections.map((s) => s.title)).toEqual(["Jobs"]);
  });
  it("links questions and excerpts to sources", () => {
    const qs = [{ id: "q1", sourceIds: ["s1"] }, { id: "q2", sourceIds: ["s2"] }];
    const ex = [{ id: "x1", sourceId: "s1" }];
    const ev = [{ id: "e1", sourceId: "s1" }];
    expect(questionsForSource("s1", qs).map((q) => q.id)).toEqual(["q1"]);
    expect(excerptsForSourceId("s1", ex).map((x) => x.id)).toEqual(["x1"]);
    expect(evidenceForSource("s1", ev).map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("bibliography", () => {
  it("builds sorted bibliography with issues review", () => {
    const sources = [
      newSource({ id: "b", title: "Zebra Report", authors: [{ name: "Ann Author" }], publication: "P", publishDate: "2026" }),
      newSource({ id: "a", title: "Apple Study", url: "https://x.io" })
    ];
    const bib = buildBibliography(sources, "mla");
    expect(bib.items.length).toBe(2);
    expect(bib.items[0].source.id).toBe("a"); // alphabetical: Apple before Zebra
    expect(bib.text).toContain("Author, Ann.");
    expect(bib.issues.length).toBe(1); // "Apple Study" has no author/publication/date
  });
});

describe("activity, recency, search", () => {
  it("merges activity across collections, newest first", () => {
    const rows = topicActivity({
      topicId: "t1",
      sources: [{ id: "s1", topicIds: ["t1"], title: "X", updatedAt: "2026-08-01T00:00:00Z" }],
      evidence: [{ id: "e1", topicIds: ["t1"], text: "Quote", updatedAt: "2026-08-05T00:00:00Z" }],
      questions: [{ id: "q1", topicIds: ["t1"], question: "Q?", updatedAt: "2026-08-03T00:00:00Z" }]
    });
    expect(rows[0].label).toBe("Evidence card");
    expect(rows.map((r) => r.label)).toContain("Source saved");
  });

  it("buckets by recency", () => {
    const b = recencyBuckets([
      { id: "a", publishDate: new Date().toISOString() },
      { id: "b", publishDate: "2010-01-01" },
      { id: "c" }
    ]);
    expect(b.recent.map((s) => s.id)).toEqual(["a"]);
    expect(b.older.map((s) => s.id)).toEqual(["b"]);
    expect(b.unknown.map((s) => s.id)).toEqual(["c"]);
  });

  it("searches with title-field weighting", () => {
    const items = [
      { id: "1", title: "Climate Report", text: "unrelated body" },
      { id: "2", title: "Other", text: "mentions climate in body" }
    ];
    const results = researchSearch(items, "climate");
    expect(results[0].item.id).toBe("1");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});

describe("factories", () => {
  it("produce stable shapes with defaults", () => {
    expect(newSource().sourceType).toBe("news");
    expect(newSource().quality.assessmentBasis).toBe("");
    expect(newResearchQuestion().status).toBe("unanswered");
    expect(newExcerpt().evidenceIds).toEqual([]);
    expect(newConflict().type).toBe("conflicting");
    expect(newResearchTask().status).toBe("open");
    expect(newResearchCollection().sourceIds).toEqual([]);
  });
});

describe("research workflows (store-level)", () => {
  // In-memory store with the exact interface of the prep store the UI uses,
  // so these tests exercise the same create/list/update path as the app.
  const memory = {};
  const store = {
    list: async (col) => (memory[col] || []).slice(),
    create: async (col, data) => {
      const id = "id-" + Math.random().toString(36).slice(2, 8);
      memory[col] = memory[col] || [];
      memory[col].unshift({ id, ...data, createdAt: "2026-08-20T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" });
      return id;
    },
    update: async (col, id, patch) => {
      memory[col] = (memory[col] || []).map((i) => i.id === id ? { ...i, ...patch, updatedAt: "2026-08-20T01:00:00Z" } : i);
    },
    remove: async (col, id) => { memory[col] = (memory[col] || []).filter((i) => i.id !== id); }
  };
  beforeAll(() => { setPrepStore(store); });
  beforeEach(() => { Object.keys(memory).forEach((k) => delete memory[k]); });

  it("Workflow A: topic → question → source → excerpt → evidence → argument → citation → bibliography", async () => {
    const topicId = await createItem("topics", { name: "School Start Times", status: "active", tags: ["pro"] });
    const questionId = await createItem("researchQuestions", newResearchQuestion({
      question: "Do later start times improve academic outcomes?",
      topicIds: [topicId], priority: "high", status: "researching"
    }));
    const sourceId = await createItem("sources", newSource({
      title: "Later School Start Times Improve Adolescent Sleep",
      url: "https://www.nytimes.com/2026/08/20/health/school-start-times.html",
      authors: [{ name: "Jane Q. Rodriguez" }], publication: "The New York Times",
      publishDate: "2026-08-20", accessDate: "2026-08-21", topicIds: [topicId]
    }));
    const excerptId = await createItem("excerpts", newExcerpt({
      quote: "Teenagers at schools with later start times slept 34 minutes more per night.",
      sourceId, questionId, page: "A12"
    }));
    const evidenceId = await createItem("evidence", {
      label: "Sleep–grades link", evidenceType: "study-finding", claim: "Later starts improve sleep and academics",
      text: "Teenagers at schools with later start times slept 34 minutes more per night.",
      sourceId, source: "Rodriguez, J., The New York Times, Aug. 2026", url: "https://www.nytimes.com/2026/08/20/health/school-start-times.html",
      topicIds: [topicId], blockIds: ["b1"]
    });
    await updateItem("researchQuestions", questionId, { sourceIds: [sourceId], evidenceIds: [evidenceId], status: "answered" });

    const source = (await listItems("sources")).find((s) => s.id === sourceId);
    expect(formatCitation(source, "mla")).toContain("Rodriguez, Jane Q.");
    expect(formatCitation(source, "apa")).toContain("(2026, August 20)");

    const bib = buildBibliography(await listItems("sources"), "chicago");
    expect(bib.items.length).toBe(1);
    expect(bib.text).toContain("The New York Times");

    // The whole chain resolves: no gaps for the linked question/argument.
    const gaps = researchGaps({
      topics: [{ id: topicId, name: "School Start Times" }], topicId,
      questions: await listItems("researchQuestions"),
      sources: await listItems("sources"),
      evidence: await listItems("evidence"),
      blocks: [{ id: "b1", topicIds: [topicId], tag: "Later starts work" }],
      cases: []
    });
    expect(gaps.some((g) => g.kind === "question")).toBe(false);
    expect(gaps.some((g) => g.kind === "argument")).toBe(false);
    expect(excerptId).toBeTruthy();
  });

  it("Workflow B: duplicate detection offers 'use existing' instead of a second record", async () => {
    const first = await createItem("sources", newSource({ title: "Climate Report", url: "https://www.epa.gov/climate/report" }));
    const candidate = newSource({ title: "Climate Report", url: "http://www.epa.gov/climate/report/" });
    const dupes = findDuplicateSources(await listItems("sources"), candidate);
    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0].reason).toBe("url");
    // "Use existing" = keep the original; no merge happens automatically.
    expect((await listItems("sources")).length).toBe(1);
    expect((await listItems("sources"))[0].id).toBe(first);
  });

  it("Workflow C: unsupported argument gap appears and resolves after linking evidence", async () => {
    const topicId = await createItem("topics", { name: "AI Policy" });
    const args = { topics: [{ id: topicId, name: "AI Policy" }], topicId, questions: [], sources: [], evidence: await listItems("evidence"), blocks: [{ id: "b9", topicIds: [topicId], tag: "AI creates jobs" }], cases: [] };
    expect(researchGaps(args).some((g) => g.kind === "argument")).toBe(true);

    await createItem("evidence", { id: "ignored", text: "AI creates 2M new roles", topicIds: [topicId], blockIds: ["b9"] });
    const after = { ...args, evidence: await listItems("evidence") };
    expect(researchGaps(after).some((g) => g.kind === "argument")).toBe(false);
  });

  it("Workflow D: conflicting evidence links without declaring a winner", async () => {
    const a = await createItem("evidence", { text: "Policy X reduces emissions 40%", topicIds: ["t9"] });
    const b = await createItem("evidence", { text: "Policy X has no measurable effect", topicIds: ["t9"] });
    const conflict = newConflict({ evidenceAId: a, evidenceBId: b, type: "conflicting", notes: "Different methodologies — compare before the round." });
    await createItem("conflicts", conflict);
    const saved = (await listItems("conflicts"))[0];
    expect(saved.type).toBe("conflicting");
    expect(saved.evidenceAId).toBe(a);
    expect(saved.evidenceBId).toBe(b);
  });

  it("Workflow E: collection → bibliography with style switching and export text", async () => {
    const col = await createItem("researchCollections", newResearchCollection({ name: "Pro case" }));
    const s1 = await createItem("sources", newSource({ title: "Zebra Study", authors: [{ name: "Ann Author" }], publication: "Nature", publishDate: "2026-01-01", collectionIds: [col] }));
    const s2 = await createItem("sources", newSource({ title: "Apple Report", url: "https://x.io", collectionIds: [col] }));
    const chosen = (await listItems("sources")).filter((s) => (s.collectionIds || []).includes(col));
    const mla = buildBibliography(chosen, "mla");
    const apa = buildBibliography(chosen, "apa");
    expect(mla.items.map((i) => i.source.id)).toEqual([s2, s1]); // alphabetical by author/title
    expect(mla.text).not.toBe(apa.text);
    expect(apa.text).toContain("Author, A. (2026, January 1). Zebra study.");
    expect(mla.issues.some((x) => x.issues.length > 0)).toBe(true); // Apple Report missing fields
  });
});
