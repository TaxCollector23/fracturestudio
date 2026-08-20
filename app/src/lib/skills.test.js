import { describe, it, expect } from "vitest";
import {
  auditSkillScores, computeProfile, recommendNext, daysUntil, levelForProfile, SKILLS
} from "./skills.js";

// A realistic normalized argument-mode audit (shape produced by normalizeAudit).
const ARG_AUDIT = {
  overall_score: 68,
  score_breakdown: { claim_clarity: 15, evidence_strength: 12, warrant_strength: 11, rebuttal_readiness: 10, logical_consistency: 13, impact_weighing: 7, source_strength: 8 },
  verdict: "The case holds together but the warrant chain has gaps.",
  claims: [
    { quote: "Schools should start later.", rating: "STRONG", warrant: "Later starts match adolescent circadian rhythms.", fix: "Keep." },
    { quote: "Later starts improve grades.", rating: "WEAK", warrant: "", missing_warrant: "No mechanism is given.", fix: "Add the sleep-academics link." },
    { quote: "Later starts reduce dropout.", rating: "MODERATE", warrant: "Attendance improves.", fix: "Cite the Minnesota study." }
  ],
  strengths: [{ quote: "Schools should start later.", why: "Clear, narrow, arguable." }],
  collapse_point: { quote: "Later starts improve grades.", survival_probability: 40, strongest_attack: "Correlation vs causation." },
  attack_tree: [
    { attack: "Attendance confounder", targets: "grades claim", why_dangerous: "Kills the causal link.", response: "Randomized studies control for it.", crossfire_question: "What is your mechanism?" },
    { attack: "Cost objection", targets: "transport", why_dangerous: "District budgets.", response: "Staggered bell schedules cut cost." }
  ],
  counter_arguments: [{ steelman: "Costs outweigh benefits.", suggested_rebuttal: "Staggered schedules cut costs." }],
  rhetorical_analysis: {
    logical_flow: "Clear claim-to-warrant movement in section one, then drift.",
    persuasion_assessment: "Strong opening, thin evidence section.",
    strongest_sentence: { quote: "Schools should start later.", why: "Direct and debatable." },
    weakest_sentence: { quote: "Later starts improve grades.", why: "No mechanism.", fix: "Add the sleep-academics link." }
  },
  assumption_audit: [{ assumption: "Districts can absorb cost.", if_rejected: "Case loses solvency.", how_to_defend: "Staggered schedules." }],
  priority_fixes: [
    { problem: "Missing warrant on grades claim.", why_it_matters: "Opponent exploits it.", exact_fix: "Add mechanism sentence.", fatality: "MAJOR" },
    { problem: "Impact not weighed.", why_it_matters: "Judge cannot compare.", exact_fix: "Weigh magnitude vs probability.", fatality: "MODERATE" }
  ]
};

const SPEECH_AUDIT = {
  overall_score: 74,
  score_breakdown: { audience_clarity: 18, hook_strength: 16, structure: 19, delivery_readiness: 15, persuasion: 16, memorability: 12, call_to_action_strength: 14 },
  verdict: "Strong structure, delivery risks in the middle.",
  claims: [{ quote: "We must act on sleep.", rating: "STRONG", warrant: "Health data.", fix: "Keep." }],
  strengths: [{ quote: "We must act on sleep.", why: "Clear." }],
  delivery_markup: [
    { original_text: "We must act.", annotated: "We must [pause] act [slow down].", note: "Builds tension." }
  ],
  delivery_risks: [
    { quote: "Statistic dump in minute three", risk: "Listener loses thread", fix: "Add one signpost" }
  ],
  call_to_action: { present: true, current: "Sign today.", stronger_ending: "Sign before you leave the auditorium tonight." },
  audience_clarity: { main_message_obvious: true, confusing_terms: ["circadian"], level_assessment: "appropriate" },
  rhetorical_analysis: { persuasion_assessment: "Persuasive arc.", strongest_sentence: { quote: "We must act.", why: "Direct." }, weakest_sentence: { quote: "Statistic dump", why: "Too dense", fix: "Simplify" } }
};

describe("auditSkillScores", () => {
  it("scores only skills relevant to the mode", () => {
    const scores = auditSkillScores(ARG_AUDIT, "argument");
    expect(Object.keys(scores).length).toBeGreaterThan(0);
    expect(scores.argumentation).toBeDefined();
    expect(scores.rebuttal).toBeDefined();
    // Vocal delivery is not relevant to argument mode audits.
    expect(scores.delivery).toBeUndefined();
    expect(scores["time-management"]).toBeUndefined();
  });

  it("scores speech skills for speech audits", () => {
    const scores = auditSkillScores(SPEECH_AUDIT, "speech");
    expect(scores.delivery).toBeDefined();
    expect(scores.confidence).toBeDefined();
    expect(scores.pacing).toBeDefined();
    expect(scores["time-management"]).toBeDefined();
    expect(scores.crossEx || scores["cross-ex"]).toBeUndefined();
  });

  it("returns null-free numeric scores in 0..100", () => {
    for (const scores of [auditSkillScores(ARG_AUDIT, "argument"), auditSkillScores(SPEECH_AUDIT, "speech")]) {
      for (const entry of Object.values(scores)) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
        expect(entry.score).toBeLessThanOrEqual(100);
        expect(Number.isFinite(entry.score)).toBe(true);
      }
    }
  });

  it("skips skills with no signal (never forces every skill)", () => {
    const thin = { overall_score: 60, claims: [], strengths: [], attack_tree: [], rhetorical_analysis: {} };
    const scores = auditSkillScores(thin, "argument");
    // No claims, no attacks, no rhetorical content → nothing meaningful.
    expect(Object.keys(scores).length).toBeLessThan(SKILLS.length);
  });
});

describe("computeProfile", () => {
  const projects = [
    { id: "a", title: "First", mode: "argument", score: 60, audit: ARG_AUDIT, createdAt: { seconds: 1700000000 } },
    { id: "b", title: "Second", mode: "argument", score: 72, audit: { ...ARG_AUDIT, overall_score: 72, collapse_point: { ...ARG_AUDIT.collapse_point, survival_probability: 60 } }, createdAt: { seconds: 1700008000 } },
    { id: "c", title: "Speech", mode: "speech", score: 74, audit: SPEECH_AUDIT, createdAt: { seconds: 1700016000 } }
  ];

  it("builds per-skill series with trends", () => {
    const p = computeProfile(projects);
    expect(p.sessions).toBe(3);
    expect(p.lastScore).toBe(74);
    expect(p.prevScore).toBe(72);
    expect(p.scoreDelta).toBe(2);
    expect(p.weakest).toBeTruthy();
    expect(p.strongest).toBeTruthy();
    expect(p.strongest.id).toBeDefined();
  });

  it("counts modes and overall averages", () => {
    const p = computeProfile(projects);
    expect(p.modes.argument).toBe(2);
    expect(p.modes.speech).toBe(1);
    expect(p.mostPracticedMode).toBe("argument");
    expect(p.overallAvg).toBeGreaterThan(0);
  });

  it("handles empty input gracefully", () => {
    const p = computeProfile([]);
    expect(p.sessions).toBe(0);
    expect(p.weakest).toBeNull();
    expect(p.lastScore).toBeNull();
  });
});

describe("recommendNext", () => {
  it("recommends a full simulation when a goal is close", () => {
    const today = new Date("2026-08-20");
    const recs = recommendNext({
      profile: computeProfile([{ id: "a", mode: "argument", score: 70, audit: ARG_AUDIT, createdAt: { seconds: 1700000000 } }]),
      drills: [{ id: "rebuttal-blitz", title: "Rebuttal blitz", skills: ["rebuttal"] }],
      completedDrills: [],
      goals: [{ text: "Win regionals", targetDate: "2026-08-23", status: "active" }],
      today
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].why).toContain("goal");
  });

  it("every recommendation has an explainable why and an action", () => {
    const recs = recommendNext({
      profile: computeProfile([{ id: "a", mode: "argument", score: 70, audit: ARG_AUDIT, createdAt: { seconds: 1700000000 } }]),
      drills: [],
      completedDrills: [],
      goals: []
    });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.why).toBeTruthy();
      expect(r.action).toBeTruthy();
      expect(r.action.type).toBeTruthy();
    }
  });

  it("does not recommend an already-completed drill", () => {
    const recs = recommendNext({
      profile: computeProfile([{ id: "a", mode: "argument", score: 40, audit: ARG_AUDIT, createdAt: { seconds: 1700000000 } }]),
      drills: [{ id: "rebuttal-blitz", title: "Rebuttal blitz", skills: ["rebuttal"] }],
      completedDrills: ["rebuttal-blitz"],
      goals: []
    });
    const drillRec = recs.find((r) => r.action?.type === "drill");
    expect(drillRec?.action?.target).not.toBe("rebuttal-blitz");
  });
});

describe("helpers", () => {
  it("computes days until a date", () => {
    const today = new Date("2026-08-20");
    expect(daysUntil("2026-08-23", today)).toBe(3);
    expect(daysUntil("2026-08-20", today)).toBe(0);
    expect(daysUntil("", today)).toBeNull();
    expect(daysUntil("not-a-date", today)).toBeNull();
  });

  it("maps overall averages to levels", () => {
    expect(levelForProfile({ overallAvg: 30 })).toBe("beginner");
    expect(levelForProfile({ overallAvg: 50 })).toBe("intermediate");
    expect(levelForProfile({ overallAvg: 70 })).toBe("advanced");
    expect(levelForProfile({ overallAvg: 88 })).toBe("competitive");
    expect(levelForProfile(null)).toBe("beginner");
  });
});
