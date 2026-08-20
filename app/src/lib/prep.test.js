import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  makeLocalStore, setPrepStore, listItems, createItem, updateItem, removeItem, getItem,
  newCase, newSection, newEvidence, newBlock, newResponseTree, newBranch, newFlashcard,
  checkCase, cardDue, scheduleReview, evidenceUsedInCase, sectionResponses, relatedByTag,
  filterByQuery, outlineTotal, fmtSeconds, timeAgo, COLS
} from "./prep.js";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
beforeAll(() => {
  globalThis.localStorage = new MemoryStorage();
  setPrepStore(makeLocalStore());
});
beforeEach(() => { localStorage.clear(); });

describe("generic CRUD over content types", () => {
  it("creates, lists, updates, and removes items with ids + timestamps", async () => {
    const id = await createItem("evidence", newEvidence({ text: "A study shows X.", source: "Study (2026)" }));
    expect(id).toBeTruthy();
    const items = await listItems("evidence");
    expect(items.length).toBe(1);
    expect(items[0].text).toBe("A study shows X.");
    expect(items[0].createdAt).toBeTruthy();

    await updateItem("evidence", id, { text: "A newer study shows X." });
    const after = await getItem("evidence", id);
    expect(after.text).toBe("A newer study shows X.");

    await removeItem("evidence", id);
    expect(await listItems("evidence")).toHaveLength(0);
  });

  it("keeps each collection separate", async () => {
    await createItem("blocks", newBlock({ tag: "No link" }));
    await createItem("inbox", { content: "note" });
    expect(await listItems("blocks")).toHaveLength(1);
    expect(await listItems("inbox")).toHaveLength(1);
    expect(COLS.includes("cases")).toBe(true);
  });
});

describe("case completeness checker", () => {
  it("flags missing claim, warrant, and impact", () => {
    const caze = newCase({
      id: "c1",
      sections: [
        newSection({ title: "Contention 1", claim: "", warrant: "", impact: "" }),
        newSection({ title: "Contention 2", claim: "Schools should start later.", warrant: "", impact: "" }),
        newSection({ title: "Contention 3", claim: "Sleep improves grades.", warrant: "Teens need 9 hours.", impact: "Higher GPAs." })
      ]
    });
    const { score, issues, counts } = checkCase(caze, []);
    expect(counts.errors).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.label === "Missing warrant")).toBe(true);
    expect(issues.some((i) => i.label === "No claim")).toBe(true);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it("scores a complete case 100 and flags duplicate claims", () => {
    const caze = newCase({
      id: "c1",
      sections: [
        newSection({ title: "One", claim: "Later start times improve learning.", warrant: "Teens match circadian rhythms.", evidenceIds: ["e1"], impact: "Higher achievement." }),
        newSection({ title: "Two", claim: "Later start times improve learning.", warrant: "More sleep.", evidenceIds: ["e2"], impact: "Better health." })
      ]
    });
    const { score, issues } = checkCase(caze, [{ id: "e1" }, { id: "e2" }]);
    expect(issues.some((i) => i.label === "Duplicate argument")).toBe(true);
    expect(score).toBeLessThan(100);
    expect(issues.some((i) => i.label === "Missing warrant")).toBe(false);
  });

  it("flags broken and unused evidence links", () => {
    const caze = newCase({
      id: "c1",
      sections: [newSection({ title: "One", claim: "C", warrant: "W", evidenceIds: ["ghost"], impact: "I" })]
    });
    const { issues } = checkCase(caze, [{ id: "e1", caseIds: ["c1"] }]);
    expect(issues.some((i) => i.label === "Broken evidence link")).toBe(true);
    expect(issues.some((i) => i.label === "Unused evidence")).toBe(true);
  });

  it("flags responses without a trigger", () => {
    const caze = newCase({
      id: "c1",
      sections: [newSection({
        title: "One", claim: "C", warrant: "W", impact: "I", evidenceIds: ["e1"],
        responses: [{ id: "r1", trigger: "", response: "Extend." }]
      })]
    });
    const { issues } = checkCase(caze, [{ id: "e1" }]);
    expect(issues.some((i) => i.label === "Response with no target")).toBe(true);
  });
});

describe("flashcard scheduling", () => {
  it("treats cards with past due dates as due", () => {
    expect(cardDue({ due: "2020-01-01T00:00:00Z" }, new Date("2026-08-20"))).toBe(true);
    expect(cardDue({ due: "2099-01-01T00:00:00Z" }, new Date("2026-08-20"))).toBe(false);
    expect(cardDue({}, new Date("2026-08-20"))).toBe(true);
  });

  it("grows intervals on good reviews and resets on bad ones", () => {
    let card = newFlashcard({ front: "Q", back: "A" });
    const now = new Date("2026-08-20");
    card = scheduleReview(card, 5, now);
    expect(card.intervalDays).toBe(1);
    card = scheduleReview(card, 5, new Date(now.getTime() + 86400000));
    expect(card.intervalDays).toBe(3);
    const reviewAt = now.getTime() + 4 * 86400000;
    card = scheduleReview(card, 2, new Date(reviewAt));
    expect(card.intervalDays).toBe(0);
    expect(new Date(card.due).getTime() - reviewAt).toBe(10 * 60000);
  });
});

describe("relationships", () => {
  it("finds which cases use an evidence card", () => {
    const cases = [
      newCase({ id: "c1", sections: [newSection({ evidenceIds: ["e1"] })] }),
      newCase({ id: "c2", sections: [newSection({ evidenceIds: ["e9"] })] })
    ];
    expect(evidenceUsedInCase("e1", cases).map((c) => c.id)).toEqual(["c1"]);
  });

  it("finds related items by shared topic or tags", () => {
    const base = { id: "a", topic: "sleep", tags: ["health"] };
    const others = [
      { id: "b", topic: "sleep", tags: [] },
      { id: "c", topic: "guns", tags: [] },
      { id: "d", topic: "", tags: ["health"] }
    ];
    const related = relatedByTag(base, others);
    expect(related.map((i) => i.id).sort()).toEqual(["b", "d"]);
  });
});

describe("helpers", () => {
  it("filters by query text", () => {
    const items = [{ id: "1", text: "sleep research" }, { id: "2", text: "gun control" }];
    expect(filterByQuery(items, "SLEEP").map((i) => i.id)).toEqual(["1"]);
    expect(filterByQuery(items, "")).toHaveLength(2);
  });

  it("sums outline times and formats seconds", () => {
    expect(outlineTotal({ segments: [{ seconds: 30 }, { seconds: 120 }] })).toBe(150);
    expect(fmtSeconds(90)).toBe("1m 30s");
    expect(fmtSeconds(45)).toBe("45s");
    expect(fmtSeconds(0)).toBe("0s");
  });

  it("formats relative time", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    expect(timeAgo("2026-08-20T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-08-20T11:00:00Z", now)).toBe("1h ago");
    expect(timeAgo("2026-08-19T12:00:00Z", now)).toBe("1d ago");
    expect(timeAgo("", now)).toBe("");
  });
});
