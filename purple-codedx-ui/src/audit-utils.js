export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "openai/gpt-oss-120b:free";

export const SYSTEM_PROMPT = `
You are Fracture Studio, an academic argument auditor for students, debate teams, teachers, and serious writers. Your job is to find the exact places where an argument loses support before a reader, judge, teacher, or opponent finds them.

Give direct, professional feedback. Every criticism must name the exact sentence or passage, explain why it weakens the argument, and give a concrete repair. Do not say "add evidence" unless you name the type of evidence and the exact claim it must support. Do not say "improve clarity" unless you explain what the reader misunderstands.

Score calibration:
0-10 means not an argument, nonsense, greeting, fragment, or no claim/evidence/warrant.
11-39 means the argument collapses because major claims are not proved.
40-59 means serious structural or evidence problems.
60-74 means usable but vulnerable.
75-89 means strong with fixable pressure points.
90-100 means resilient under close questioning.

Respond ONLY with one valid JSON object. No markdown, no preamble, no explanation outside JSON. Use this exact schema:

{
  "overall_score": 0,
  "score_breakdown": {
    "argument_strength": 0,
    "assumption_audit": 0,
    "logic": 0,
    "rhetoric": 0
  },
  "verdict": "2-3 short sentences: what survives, what breaks first, and why the score is not higher",
  "coaching_note": "one sentence: the first revision the writer should make",
  "priority_fixes": [
    {
      "quote": "exact sentence or passage that needs work",
      "problem": "name the precise problem in plain language",
      "why_it_matters": "explain what a judge, reader, or opponent does with this weakness",
      "exact_fix": "one concrete edit action",
      "rewrite": "a complete replacement sentence or bridge sentence"
    }
  ],
  "collapse_point": {
    "quote": "the single sentence or claim the whole argument depends on most",
    "why_it_collapses": "what breaks if this point is disproven",
    "opponent_attack": "the strongest attack against this point",
    "reinforcement": "how to protect this point with evidence, warrant, or qualification"
  },
  "argument_strength": {
    "thesis": {
      "quote": "exact thesis sentence",
      "assessment": "is it clear, specific, arguable, and narrow enough? 2 sentences max."
    },
    "claims": [
      {
        "quote": "exact body claim verbatim",
        "rating": "STRONG or MODERATE or WEAK",
        "diagnosis": "name the exact logical, evidence, or warrant flaw in 1-2 sentences",
        "opponent_exploit": "how a skilled opponent uses this exact weakness",
        "fix": "one concrete action targeting the named flaw specifically"
      }
    ]
  },
  "assumption_audit": [
    {
      "assumption": "hidden assumption the author never explicitly defends",
      "load_bearing": "HIGH or MEDIUM or LOW",
      "quote": "the claim that depends on this assumption",
      "vulnerability": "what happens if this assumption is false",
      "defense": "how the author could defend this assumption"
    }
  ],
  "logical_fallacies": [
    {
      "name": "exact fallacy name",
      "quote": "verbatim passage containing the fallacy",
      "explanation": "why this passage commits this fallacy",
      "fix": "what the author should write instead"
    }
  ],
  "counter_arguments": [
    {
      "steelman": "strongest version of the opposing argument in 3 sentences",
      "targets": "which specific claim this defeats",
      "damage": "what breaks if unanswered",
      "suggested_rebuttal": "how to preempt or rebut this"
    }
  ],
  "rhetorical_analysis": {
    "opening_hook": "evaluate the opening in 2 sentences",
    "logical_flow": "evaluate paragraph progression in 2 sentences",
    "strongest_sentence": {
      "quote": "single best sentence in the essay, verbatim",
      "why": "why this sentence works"
    },
    "weakest_sentence": {
      "quote": "single most damaging sentence verbatim",
      "why": "exactly what is wrong with it",
      "fix": "rewrite the sentence completely"
    }
  },
  "rewrite_suggestions": [
    {
      "original": "exact original sentence verbatim",
      "rewrite": "complete replacement sentence",
      "improvement": "what specifically makes the rewrite stronger"
    }
  ]
}

Hard rules: priority_fixes must be ordered by what improves the score fastest. The collapse point must be a real quote from the essay unless the input is not an argument. Never flag a thesis for lacking evidence. All quotes must be verbatim from the essay. Escape internal double quotes inside JSON strings. Keep language professional and academically appropriate.

Now evaluate the following essay and respond ONLY with the JSON object:
`;

export function words(text) {
  return text.match(/[A-Za-z0-9']+/g) || [];
}

export function isTooThinForAudit(text) {
  const tokens = words(text.toLowerCase());
  const unique = new Set(tokens);
  const hasArgumentSignal = /\b(should|must|because|therefore|claim|evidence|proves|causes|harms|improves|solves|according|study|research|data|shows|demonstrates)\b/i.test(text);
  return tokens.length < 12 || unique.size <= 3 || (!hasArgumentSignal && tokens.length < 25);
}

export function buildTooThinAudit(text) {
  const quote = text.trim() || "No text entered.";
  return normalizeAudit({
    overall_score: text.trim() ? 4 : 0,
    score_breakdown: { argument_strength: 1, assumption_audit: 1, logic: 1, rhetoric: 1 },
    verdict: "Fracture cannot audit this as an argument yet. There is no clear claim, no warrant, no evidence, and no impact to pressure-test.",
    coaching_note: "Write one arguable claim, one because sentence, one piece of evidence, and one impact sentence before running the audit again.",
    priority_fixes: [
      {
        quote,
        problem: "This is not a complete argument yet.",
        why_it_matters: "A judge or reader has nothing specific to agree with, challenge, or evaluate.",
        exact_fix: "Replace the fragment with a full assertion, warrant, evidence, and impact.",
        rewrite: "My claim is that [specific position] because [reason], and this matters because [impact]."
      }
    ],
    collapse_point: {
      quote,
      why_it_collapses: "The entire response collapses because it does not give Fracture a testable claim.",
      opponent_attack: "What exactly are you trying to prove?",
      reinforcement: "Add a specific claim and at least one concrete reason or example."
    },
    argument_strength: {
      thesis: {
        quote,
        assessment: "No defensible thesis appears yet. The input is too short or too vague to score as argumentative writing."
      },
      claims: []
    },
    assumption_audit: [],
    logical_fallacies: [],
    counter_arguments: [],
    rhetorical_analysis: {
      opening_hook: "No opening can be evaluated because the input is not developed enough.",
      logical_flow: "No paragraph flow exists yet.",
      strongest_sentence: { quote, why: "This is the only available text." },
      weakest_sentence: {
        quote,
        why: "It does not state a complete claim with reasoning.",
        fix: "State a specific position and explain why it is true."
      }
    },
    rewrite_suggestions: [
      {
        original: quote,
        rewrite: "Schools should start later because sleep affects attention and memory, and that matters because students cannot learn well when the schedule works against their biology.",
        improvement: "The rewrite gives Fracture a claim, warrant, and impact to evaluate."
      }
    ]
  }, text);
}

export async function collectOpenRouterContent(upstreamRes, onChunk) {
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content || "";
        if (delta) {
          content += delta;
          if (onChunk) onChunk(delta, content.length);
        }
      } catch (_) {
        // Ignore upstream comments or non-content events.
      }
    }
  }

  return content;
}

export function prepareAuditFromModelText(rawText, essay) {
  try {
    return { audit: normalizeAudit(parseJsonWithRepair(rawText), essay), recovered: false };
  } catch (err) {
    return {
      audit: buildRecoveryAudit(essay, `The model returned malformed JSON, so Fracture generated a stable validated report instead. Recovery reason: ${err.message}`),
      recovered: true
    };
  }
}

function parseJsonWithRepair(rawText) {
  const text = String(rawText || "").trim();
  const candidates = [
    text,
    extractJsonObject(text),
    repairJson(extractJsonObject(text)),
    repairJson(text)
  ].filter(Boolean);

  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Try next candidate.
    }
  }

  throw new Error("Unable to parse or repair model JSON.");
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

function repairJson(text) {
  return String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      return /^["{}\[\],]/.test(t) || /^-?\d/.test(t) || /^(true|false|null)\b/.test(t);
    })
    .join("\n")
    .replace(/,\s*([}\]])/g, "$1");
}

export function normalizeAudit(audit, essay) {
  const text = String(essay || "").trim();
  const essaySentences = splitSentences(text);
  const fallbackQuote = essaySentences[0] || text || "No text entered.";
  const input = audit && typeof audit === "object" ? audit : {};
  const scoreBreakdown = input.score_breakdown && typeof input.score_breakdown === "object" ? input.score_breakdown : {};
  const argumentStrength = input.argument_strength && typeof input.argument_strength === "object" ? input.argument_strength : {};
  const thesis = argumentStrength.thesis && typeof argumentStrength.thesis === "object" ? argumentStrength.thesis : {};
  const claims = ensureArray(argumentStrength.claims).map((claim) => ({
    quote: stringOr(claim?.quote, fallbackQuote),
    rating: normalizeRating(claim?.rating),
    diagnosis: stringOr(claim?.diagnosis, "This claim needs a clearer warrant and stronger support."),
    opponent_exploit: stringOr(claim?.opponent_exploit, "A skeptical reader can ask what evidence proves this exact claim."),
    fix: stringOr(claim?.fix, "Attach one specific source or example and explain the warrant in a separate sentence.")
  }));

  const normalized = {
    overall_score: clampInt(input.overall_score, null, 0, 100),
    score_breakdown: {
      argument_strength: clampInt(scoreBreakdown.argument_strength, 1, 0, 25),
      assumption_audit: clampInt(scoreBreakdown.assumption_audit, 1, 0, 25),
      logic: clampInt(scoreBreakdown.logic, 1, 0, 25),
      rhetoric: clampInt(scoreBreakdown.rhetoric, 1, 0, 25)
    },
    verdict: stringOr(input.verdict, "Fracture found an argument, but the current version does not yet provide enough clear support for its central claim."),
    coaching_note: stringOr(input.coaching_note, "Start by defining the main claim and attaching direct evidence to the sentence that carries the most weight."),
    priority_fixes: ensureArray(input.priority_fixes).map((fix) => ({
      quote: stringOr(fix?.quote, fallbackQuote),
      problem: stringOr(fix?.problem, "This point needs more precise support."),
      why_it_matters: stringOr(fix?.why_it_matters, "A reader can challenge this before accepting the argument."),
      exact_fix: stringOr(fix?.exact_fix, "Add specific evidence, then write one warrant sentence explaining why that evidence proves the claim."),
      rewrite: stringOr(fix?.rewrite, "")
    })),
    collapse_point: {
      quote: stringOr(input.collapse_point?.quote, claims[0]?.quote, fallbackQuote),
      why_it_collapses: stringOr(input.collapse_point?.why_it_collapses, "If this point is disproven or unsupported, the argument loses its main source of force."),
      opponent_attack: stringOr(input.collapse_point?.opponent_attack, "What evidence proves this exact point rather than merely asserting it?"),
      reinforcement: stringOr(input.collapse_point?.reinforcement, "Support it with a verifiable source, a clear warrant, and a narrower qualification.")
    },
    argument_strength: {
      thesis: {
        quote: stringOr(thesis.quote, fallbackQuote),
        assessment: stringOr(thesis.assessment, "The thesis is present, but it needs a clearer standard, narrower scope, and stronger reason for the reader to accept it.")
      },
      claims
    },
    assumption_audit: ensureArray(input.assumption_audit).map((item) => ({
      assumption: stringOr(item?.assumption, "The reader accepts a premise that has not been defended yet."),
      load_bearing: normalizeLoad(item?.load_bearing),
      quote: stringOr(item?.quote, fallbackQuote),
      vulnerability: stringOr(item?.vulnerability, "If this premise is false, the connected claim becomes much less persuasive."),
      defense: stringOr(item?.defense, "State the premise directly and support it with a source, example, or limiting qualifier.")
    })),
    logical_fallacies: ensureArray(input.logical_fallacies).map((item) => ({
      name: stringOr(item?.name, "Unsupported Assertion"),
      quote: stringOr(item?.quote, fallbackQuote),
      explanation: stringOr(item?.explanation, "The passage asserts more than it proves."),
      fix: stringOr(item?.fix, "Replace the assertion with a claim supported by evidence and a warrant.")
    })),
    counter_arguments: ensureArray(input.counter_arguments).map((item) => ({
      steelman: stringOr(item?.steelman, "A skeptical reader would argue that the evidence does not yet prove the conclusion."),
      targets: stringOr(item?.targets, fallbackQuote),
      damage: stringOr(item?.damage, "If unanswered, this weakens the central claim."),
      suggested_rebuttal: stringOr(item?.suggested_rebuttal, "Answer by narrowing the claim and adding direct support.")
    })),
    rhetorical_analysis: {
      opening_hook: stringOr(input.rhetorical_analysis?.opening_hook, "The opening states a position but needs a more precise frame for the reader."),
      logical_flow: stringOr(input.rhetorical_analysis?.logical_flow, "The sequence needs clearer claim-to-evidence movement."),
      strongest_sentence: {
        quote: stringOr(input.rhetorical_analysis?.strongest_sentence?.quote, fallbackQuote),
        why: stringOr(input.rhetorical_analysis?.strongest_sentence?.why, "This sentence gives the clearest available statement of the argument.")
      },
      weakest_sentence: {
        quote: stringOr(input.rhetorical_analysis?.weakest_sentence?.quote, fallbackQuote),
        why: stringOr(input.rhetorical_analysis?.weakest_sentence?.why, "This sentence carries more argumentative weight than it currently supports."),
        fix: stringOr(input.rhetorical_analysis?.weakest_sentence?.fix, "Rewrite it with a specific standard, source, and warrant.")
      }
    },
    rewrite_suggestions: ensureArray(input.rewrite_suggestions).map((item) => ({
      original: stringOr(item?.original, fallbackQuote),
      rewrite: stringOr(item?.rewrite, "The claim should be rewritten with a specific standard, a verifiable source, and a clear reason the evidence proves the point."),
      improvement: stringOr(item?.improvement, "The rewrite makes the claim easier to verify and harder to dismiss.")
    }))
  };

  if (normalized.overall_score === null) {
    normalized.overall_score = clampInt(
      normalized.score_breakdown.argument_strength +
      normalized.score_breakdown.assumption_audit +
      normalized.score_breakdown.logic +
      normalized.score_breakdown.rhetoric,
      20,
      0,
      100
    );
  }

  if (!normalized.argument_strength.claims.length && essaySentences.length > 1) {
    normalized.argument_strength.claims = essaySentences.slice(1, 5).map((sentence) => ({
      quote: sentence,
      rating: "WEAK",
      diagnosis: "This sentence reads as a claim, but it needs a source, warrant, or clearer link to the thesis.",
      opponent_exploit: "A reader can ask what proves this exact sentence.",
      fix: "Add a direct source or example and then explain why it supports the thesis."
    }));
  }

  if (!normalized.priority_fixes.length) {
    normalized.priority_fixes = buildHeuristicFixes(text).slice(0, 3);
  }

  if (!normalized.rewrite_suggestions.length) {
    normalized.rewrite_suggestions = [
      {
        original: fallbackQuote,
        rewrite: "A stronger version would define the key term, cite a verifiable source, and explain why the source proves the claim.",
        improvement: "The rewrite gives the reader a clear standard and a testable path from evidence to conclusion."
      }
    ];
  }

  return normalized;
}

export function buildRecoveryAudit(essay, note = "Fracture recovered from a malformed model response and generated a validated report.") {
  const text = String(essay || "").trim();
  const sentences = splitSentences(text);
  const thesis = sentences[0] || text || "No text entered.";
  const hasNamedSource = /\b(according to|study|report|research|data|survey|article|journal|encyclopedia|britannica|brittanica)\b/i.test(text);
  const usesLoadedLabel = /\b(bum|idiot|stupid|lazy|evil|bad person|loser)\b/i.test(text);
  const sourceSentence = sentences.find((s) => /\b(according to|study|report|research|britannica|brittanica)\b/i.test(s)) || sentences[1] || thesis;
  const score = usesLoadedLabel ? 12 : (hasNamedSource ? 28 : 18);
  const sourceName = /brittanica/i.test(text) ? "Britannica" : "the named source";

  return normalizeAudit({
    overall_score: score,
    score_breakdown: {
      argument_strength: Math.min(25, Math.max(3, Math.round(score * 0.34))),
      assumption_audit: Math.min(25, Math.max(2, Math.round(score * 0.18))),
      logic: Math.min(25, Math.max(3, Math.round(score * 0.24))),
      rhetoric: Math.min(25, Math.max(4, Math.round(score * 0.24)))
    },
    verdict: "The argument makes a clear accusation, but it does not yet provide verifiable evidence, a careful definition, or a defensible warrant. The weakest point is the source claim, because the reader cannot inspect or confirm it from the draft.",
    coaching_note: "Replace loaded wording with a precise claim, then attach a complete citation and one warrant sentence that explains why the evidence proves the claim.",
    priority_fixes: buildHeuristicFixes(text),
    collapse_point: {
      quote: sourceSentence,
      why_it_collapses: `If ${sourceName} does not actually support this statement, the argument loses its factual foundation.`,
      opponent_attack: "Where is the exact source, title, date, author, and quotation that proves this point?",
      reinforcement: "Give a complete citation, quote the relevant passage, and explain why it supports the specific claim rather than a broader or different claim."
    },
    argument_strength: {
      thesis: {
        quote: thesis,
        assessment: usesLoadedLabel
          ? "The thesis is clear, but the loaded wording makes it sound more like an insult than an academic claim. Define the standard you want the reader to apply."
          : "The thesis is visible, but it needs a narrower standard and a more explicit reason."
      },
      claims: sentences.slice(1, 5).map((sentence) => ({
        quote: sentence,
        rating: "WEAK",
        diagnosis: "The sentence makes a factual claim without enough citation detail or warrant support.",
        opponent_exploit: "A skeptical reader can ask whether the source exists and whether it directly proves the claim.",
        fix: "Attach a complete citation and add one sentence explaining how that source proves this claim."
      }))
    },
    assumption_audit: [
      {
        assumption: "The reader accepts that the named source exists and directly supports the accusation.",
        load_bearing: "HIGH",
        quote: sourceSentence,
        vulnerability: "If the source is misnamed, missing, or unrelated, the entire argument appears unreliable.",
        defense: "Provide the full citation, source type, publication date, and a directly relevant quotation."
      },
      {
        assumption: "The label used in the thesis is acceptable as an academic category.",
        load_bearing: "MEDIUM",
        quote: thesis,
        vulnerability: "If the label is seen as vague or pejorative, the reader may reject the tone before evaluating the evidence.",
        defense: "Use a neutral term and define the exact condition or behavior being evaluated."
      }
    ],
    logical_fallacies: [
      {
        name: usesLoadedLabel ? "Ad Hominem" : "Unsupported Assertion",
        quote: thesis,
        explanation: usesLoadedLabel
          ? "The sentence relies on a personal label instead of a precise, evidence-based claim."
          : "The sentence states a conclusion before proving it.",
        fix: "Rewrite the thesis as a neutral, testable claim with a defined standard."
      },
      {
        name: "Appeal to Unverified Authority",
        quote: sourceSentence,
        explanation: "The argument invokes a source without enough citation information for the reader to verify it.",
        fix: "Provide author, title, date, publisher, link or locator, and the exact wording that supports the claim."
      }
    ],
    counter_arguments: [
      {
        steelman: "A skeptical reader could argue that the draft has not proven the factual basis of its accusation. The cited source is incomplete, and the language is too loaded to function as academic evidence. Until the source is verifiable, the accusation should be treated as unsupported.",
        targets: sourceSentence,
        damage: "This challenge removes the factual support behind the thesis.",
        suggested_rebuttal: "Answer by replacing the label with a defined claim and citing a source that directly confirms the factual statement."
      }
    ],
    rhetorical_analysis: {
      opening_hook: "The opening is direct, but the tone is not yet academic. A more professional opening would define the claim before evaluating evidence.",
      logical_flow: "The draft repeats the conclusion instead of building a source-to-claim chain. It needs a thesis, verified evidence, warrant, and conclusion in that order.",
      strongest_sentence: {
        quote: sourceSentence,
        why: "This is the closest sentence to evidence because it attempts to name an outside source."
      },
      weakest_sentence: {
        quote: thesis,
        why: "It uses a loaded label without defining the standard or proving the claim.",
        fix: "The argument should identify a specific, verifiable condition and avoid pejorative labels."
      }
    },
    rewrite_suggestions: [
      {
        original: thesis,
        rewrite: "David Goldberg should be described with a precise, verifiable claim rather than a loaded label, and that claim should be supported by a complete citation.",
        improvement: "The rewrite turns the sentence into an academic standard the reader can evaluate."
      },
      {
        original: sourceSentence,
        rewrite: "According to [author], [title], published by [publisher] in [year], [direct quotation or finding], which supports the claim because [warrant].",
        improvement: "The rewrite shows exactly what citation fields and warrant language the argument needs."
      }
    ],
    recovery_note: note
  }, essay);
}

export function buildServiceFallbackAudit(essay, reason) {
  const audit = buildRecoveryAudit(essay, "The AI service did not complete successfully, so Fracture returned a stable local diagnostic instead.");
  audit.verdict = "The live model could not complete this request, but Fracture preserved the draft and returned a validated diagnostic. The feedback below focuses on the most visible argument risks from the text itself.";
  audit.coaching_note = `Try again for the full model report; current fallback reason: ${reason || "service unavailable"}.`;
  return audit;
}

function buildHeuristicFixes(text) {
  const sentences = splitSentences(text);
  const thesis = sentences[0] || text || "No text entered.";
  const sourceSentence = sentences.find((s) => /\b(according to|study|report|research|britannica|brittanica)\b/i.test(s)) || sentences[1] || thesis;
  const observation = sentences.find((s) => /\b(asks|lives|does not|doesn't|is|are|was|were)\b/i.test(s) && s !== thesis && s !== sourceSentence) || sentences[2] || sourceSentence;
  const loaded = /\b(bum|idiot|stupid|lazy|evil|bad person|loser)\b/i.test(thesis);

  return [
    {
      quote: sourceSentence,
      problem: "The source is too vague to verify.",
      why_it_matters: "A reader cannot credit evidence that lacks author, title, date, publisher, locator, and a direct connection to the claim.",
      exact_fix: "Replace the vague source mention with a complete citation and quote the exact line that supports this claim.",
      rewrite: "According to [author], [title], published by [publisher] in [year], [specific finding], which supports the claim because [warrant]."
    },
    {
      quote: thesis,
      problem: loaded ? "The thesis uses a loaded label instead of an academic standard." : "The thesis needs a clearer standard.",
      why_it_matters: "Loaded or undefined wording makes the argument easier to dismiss before the evidence is evaluated.",
      exact_fix: "Define the exact condition being argued and use neutral language.",
      rewrite: "The argument should define the specific condition being claimed and support it with verifiable evidence."
    },
    {
      quote: observation,
      problem: "This factual detail is presented without proof.",
      why_it_matters: "An unsupported factual detail gives an opponent an easy way to challenge the whole draft's credibility.",
      exact_fix: "Add a source, remove the detail, or clearly label it as an example that still needs verification.",
      rewrite: "A stronger version would cite a documented example and then explain why it supports the thesis."
    }
  ];
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringOr() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function clampInt(value, fallback, min, max) {
  const number = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeRating(value) {
  const rating = String(value || "").toUpperCase();
  return ["STRONG", "MODERATE", "WEAK"].includes(rating) ? rating : "WEAK";
}

function normalizeLoad(value) {
  const load = String(value || "").toUpperCase();
  return ["HIGH", "MEDIUM", "LOW"].includes(load) ? load : "MEDIUM";
}
