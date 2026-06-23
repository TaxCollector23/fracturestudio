export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "openai/gpt-oss-120b:free";

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
        rewrite: "My claim is that [specific position] because [reason], and this matters because [impact].",
        improvement: "The template preserves the writer's topic while adding a claim, warrant, and impact for Fracture to evaluate."
      }
    ]
  }, text);
}

export async function collectOpenRouterContent(upstreamRes, onChunk, options = {}) {
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder("utf-8");
  // If a model goes silent mid-stream (no chunk for inactivityMs), abandon it so the
  // caller can fail over to the next model instead of hanging until the function dies.
  const inactivityMs = options.inactivityMs || 0;
  let buffer = "";
  let content = "";

  while (true) {
    let result;
    if (inactivityMs > 0) {
      let timer;
      const stall = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Model stream stalled — no output received.")), inactivityMs);
      });
      try {
        result = await Promise.race([reader.read(), stall]);
      } catch (err) {
        reader.cancel().catch(() => {});
        throw err;
      } finally {
        clearTimeout(timer);
      }
    } else {
      result = await reader.read();
    }
    const { value, done } = result;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) processLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);
  return content;

  function processLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      const streamError = json?.error?.message || json?.choices?.[0]?.error?.message;
      if (streamError) throw new Error(streamError);
      const delta = json?.choices?.[0]?.delta?.content || "";
      if (delta) {
        content += delta;
        if (onChunk) onChunk(delta, content.length);
      }
    } catch (err) {
      if (err instanceof SyntaxError) return;
      throw err;
    }
  }
}

export function prepareAuditFromModelText(rawText, essay, mode) {
  try {
    return { audit: normalizeAudit(parseJsonWithRepair(rawText), essay, mode), recovered: false };
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

export function normalizeAudit(audit, essay, mode) {
  const text = String(essay || "").trim();
  const essaySentences = splitSentences(text);
  const fallbackQuote = essaySentences[0] || text || "No text entered.";
  const input = audit && typeof audit === "object" ? audit : {};
  const scoreBreakdown = input.score_breakdown && typeof input.score_breakdown === "object" ? input.score_breakdown : {};

  // Speech audits use a different schema — return the model output with minimal normalization
  if (mode === 'speech' || input.mode_analysis?.monroe_sequence) {
    // Strip argument-mode fields the model sometimes appends despite schema instructions.
    // These inflate token count and don't belong in speech output.
    const SPEECH_FORBIDDEN = new Set([
      'claims', 'collapse_point', 'argument_strength', 'argument_dependency_graph',
      'counterargument', 'rewrite_suggestions', 'rhetorical_analysis', 'assumption_audit',
      'logical_fallacies', 'truth_audit', 'attack_tree', 'counter_arguments',
      'priority_fixes', 'thesis',
    ]);
    const cleaned = {};
    for (const [k, v] of Object.entries(input)) {
      if (!SPEECH_FORBIDDEN.has(k)) cleaned[k] = v;
    }
    const modeAnalysis = input.mode_analysis || {};
    const monroe = modeAnalysis.monroe_sequence || {};
    const appeals = (modeAnalysis.rhetorical_appeals) || {};

    // Determine if all five Monroe steps and all three Aristotelian proofs are graded A or B.
    // If so, override overall_score to 100 — the model's warrant-based internal reasoning
    // sometimes anchors at 94-96 despite all structural elements being fully present.
    const isTopGrade = (g) => g === 'A' || g === 'B';
    const allMonroe = (
      monroe.attention?.present !== false && isTopGrade(monroe.attention?.grade) &&
      monroe.need?.present !== false && isTopGrade(monroe.need?.grade) &&
      monroe.satisfaction?.present !== false && isTopGrade(monroe.satisfaction?.grade) &&
      monroe.visualization?.present !== false && isTopGrade(monroe.visualization?.vividness || monroe.visualization?.grade) &&
      monroe.action?.present !== false && isTopGrade(monroe.action?.grade)
    );
    const allAristotle = (
      isTopGrade(appeals.ethos?.grade) &&
      isTopGrade(appeals.pathos?.grade) &&
      isTopGrade(appeals.logos?.grade)
    );

    const modelScore = clampInt(input.overall_score, null, 0, 100);
    const finalScore = (allMonroe && allAristotle && modelScore > 0) ? 100 : modelScore;

    return {
      ...cleaned,
      overall_score: finalScore,
      score_breakdown: input.score_breakdown || {},
      score_explanations: input.score_explanations || {},
      verdict: stringOr(input.verdict, ""),
      coaching_note: stringOr(input.coaching_note, ""),
      strengths: ensureArray(input.strengths),
      mode_analysis: modeAnalysis,
      audience_clarity: input.audience_clarity || {},
      hook_analysis: input.hook_analysis || {},
      structure_analysis: input.structure_analysis || {},
      memorability_check: input.memorability_check || {},
      call_to_action: input.call_to_action || {}
    };
  }
  const argumentStrength = input.argument_strength && typeof input.argument_strength === "object" ? input.argument_strength : {};
  const thesis = argumentStrength.thesis && typeof argumentStrength.thesis === "object" ? argumentStrength.thesis : {};
  const claims = ensureArray(argumentStrength.claims).map((claim) => ({
    quote: sourceQuoteOr(claim?.quote, text, fallbackQuote),
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
    score_explanations: {
      argument_strength: stringOr(input.score_explanations?.argument_strength, "How effectively the thesis, claims, warrants, and impacts work together as one argument."),
      assumption_audit: stringOr(input.score_explanations?.assumption_audit, "How safely the argument handles the unstated ideas it depends on."),
      logic: stringOr(input.score_explanations?.logic, "How reliably the reasoning moves from evidence and warrants to conclusions without gaps."),
      rhetoric: stringOr(input.score_explanations?.rhetoric, "How clearly and persuasively the argument guides its intended reader or audience.")
    },
    verdict: stringOr(input.verdict, "Fracture found an argument, but the current version does not yet provide enough clear support for its central claim."),
    coaching_note: stringOr(input.coaching_note, "Start by defining the main claim and attaching direct evidence to the sentence that carries the most weight."),
    priority_fixes: ensureArray(input.priority_fixes).map((fix) => ({
      quote: sourceQuoteOr(fix?.quote, text, fallbackQuote),
      fatality: normalizeFatality(fix?.fatality),
      fatality_score: clampInt(fix?.fatality_score, 50, 0, 100),
      necessity: stringOr(fix?.necessity, "This repair protects a point the argument currently needs."),
      affected_claims: stringArray(fix?.affected_claims),
      problem: stringOr(fix?.problem, "This point needs more precise support."),
      why_it_matters: stringOr(fix?.why_it_matters, "A reader can challenge this before accepting the argument."),
      exact_fix: stringOr(fix?.exact_fix, "Add specific evidence, then write one warrant sentence explaining why that evidence proves the claim."),
      rewrite: stringOr(fix?.rewrite, "")
    })),
    collapse_point: {
      quote: sourceQuoteOr(input.collapse_point?.quote, text, claims[0]?.quote || fallbackQuote),
      why_it_collapses: stringOr(input.collapse_point?.why_it_collapses, "If this point is disproven or unsupported, the argument loses its main source of force."),
      dependency_count: clampInt(input.collapse_point?.dependency_count, 0, 0, 100),
      affected_claims: stringArray(input.collapse_point?.affected_claims),
      survival_probability: clampInt(input.collapse_point?.survival_probability, 50, 0, 100),
      strongest_attack: stringOr(input.collapse_point?.strongest_attack, input.collapse_point?.opponent_attack, "What proves this point, and why should the reader accept the scope of the conclusion?"),
      strongest_defense: stringOr(input.collapse_point?.strongest_defense, input.collapse_point?.reinforcement, "State the warrant directly, narrow the scope if needed, and support the claim with the strongest directly relevant evidence."),
      opponent_attack: stringOr(input.collapse_point?.opponent_attack, "What evidence proves this exact point rather than merely asserting it?"),
      reinforcement: stringOr(input.collapse_point?.reinforcement, "Support it with a verifiable source, a clear warrant, and a narrower qualification.")
    },
    argument_dependency_graph: {
      explanation: stringOr(input.argument_dependency_graph?.explanation, "The thesis depends on the claims and reasoning bridges below. The weakest connection is the first place to repair."),
      links: ensureArray(input.argument_dependency_graph?.links).map((link) => ({
        from: stringOr(link?.from, "Supporting point"),
        to: stringOr(link?.to, "Dependent point"),
        relationship: normalizeRelationship(link?.relationship),
        strength: normalizeRating(link?.strength),
        risk: stringOr(link?.risk, "If this link breaks, the dependent point loses force.")
      }))
    },
    argument_strength: {
      thesis: {
        quote: sourceQuoteOr(thesis.quote, text, fallbackQuote),
        assessment: stringOr(thesis.assessment, "The thesis is present, but it needs a clearer standard, narrower scope, and stronger reason for the reader to accept it.")
      },
      claims
    },
    assumption_audit: ensureArray(input.assumption_audit).map((item) => ({
      assumption: stringOr(item?.assumption, "The reader accepts a premise that has not been defended yet."),
      load_bearing: normalizeLoad(item?.load_bearing),
      criticality_score: clampInt(item?.criticality_score, 50, 0, 100),
      quote: sourceQuoteOr(item?.quote, text, fallbackQuote),
      hinges_on: stringArray(item?.hinges_on),
      if_changed: stringOr(item?.if_changed, item?.vulnerability, "If the reader rejects this assumption, the connected claim becomes much weaker."),
      justification: stringOr(item?.justification, item?.defense, "State the assumption directly, qualify it where necessary, and explain why it is reasonable."),
      vulnerability: stringOr(item?.vulnerability, "If this premise is false, the connected claim becomes much less persuasive."),
      defense: stringOr(item?.defense, "State the premise directly and support it with a source, example, or limiting qualifier.")
    })),
    logical_fallacies: ensureArray(input.logical_fallacies).map((item) => ({
      name: stringOr(item?.name, "Unsupported Assertion"),
      quote: sourceQuoteOr(item?.quote, text, fallbackQuote),
      explanation: stringOr(item?.explanation, "The passage asserts more than it proves."),
      fix: stringOr(item?.fix, "Replace the assertion with a claim supported by evidence and a warrant.")
    })),
    counter_arguments: ensureArray(input.counter_arguments).map((item) => ({
      steelman: stringOr(item?.steelman, "A skeptical reader would argue that the evidence does not yet prove the conclusion."),
      rank: clampInt(item?.rank, 1, 1, 99),
      attack_type: stringOr(item?.attack_type, "logic"),
      fatality_score: clampInt(item?.fatality_score, 50, 0, 100),
      targets: stringOr(item?.targets, fallbackQuote),
      damage: stringOr(item?.damage, "If unanswered, this weakens the central claim."),
      suggested_rebuttal: stringOr(item?.suggested_rebuttal, "Answer by narrowing the claim and adding direct support."),
      preparation: stringOr(item?.preparation, "Prepare one direct answer and the strongest support for the claim under attack.")
    })),
    attack_tree: ensureArray(input.attack_tree).map((item) => ({
      rank: clampInt(item?.rank, 1, 1, 99),
      attack: stringOr(item?.attack, "Challenge the argument's weakest reasoning bridge."),
      targets: stringOr(item?.targets, fallbackQuote),
      why_dangerous: stringOr(item?.why_dangerous, "If unanswered, this attack weakens the conclusion."),
      fatality_score: clampInt(item?.fatality_score, 50, 0, 100),
      response: stringOr(item?.response, "Narrow the claim and state the missing warrant directly."),
      crossfire_question: stringOr(item?.crossfire_question, "Which part of the reasoning do you dispute, and why?")
    })),
    truth_audit: ensureArray(input.truth_audit).map((item) => ({
      claim: sourceQuoteOr(item?.claim, text, fallbackQuote),
      truth_status: normalizeTruthStatus(item?.truth_status),
      why_check: stringOr(item?.why_check, "The argument relies on this factual statement."),
      verification_step: stringOr(item?.verification_step, "Use Verify Sources to compare this claim against a public source.")
    })),
    alternative_solutions_test: ensureArray(input.alternative_solutions_test).map((item) => ({
      alternative: stringOr(item?.alternative, "A credible competing approach"),
      why_it_competes: stringOr(item?.why_it_competes, "A reader may prefer this option if it addresses the same problem with less risk."),
      what_writer_must_prove: stringOr(item?.what_writer_must_prove, "Explain why the proposed approach performs better against the argument's stated goal."),
      response: stringOr(item?.response, "Compare the alternatives fairly and narrow the claim to what the draft can prove.")
    })),
    rhetorical_analysis: {
      opening_hook: stringOr(input.rhetorical_analysis?.opening_hook, "The opening states a position but needs a more precise frame for the reader."),
      logical_flow: stringOr(input.rhetorical_analysis?.logical_flow, "The sequence needs clearer claim-to-evidence movement."),
      persuasion_assessment: stringOr(input.rhetorical_analysis?.persuasion_assessment, "The argument becomes more persuasive when each major claim is followed by a visible reasoning bridge and a clear impact."),
      clarity_assessment: stringOr(input.rhetorical_analysis?.clarity_assessment, "Make each paragraph perform one clear job and define any term that carries the conclusion."),
      flow_repairs: stringArray(input.rhetorical_analysis?.flow_repairs),
      world_changing_views: {
        present: normalizeYesNo(input.rhetorical_analysis?.world_changing_views?.present),
        idea: stringOr(input.rhetorical_analysis?.world_changing_views?.idea, ""),
        reader_risk: stringOr(input.rhetorical_analysis?.world_changing_views?.reader_risk, ""),
        make_reasonable: stringOr(input.rhetorical_analysis?.world_changing_views?.make_reasonable, "")
      },
      strongest_sentence: {
        quote: sourceQuoteOr(input.rhetorical_analysis?.strongest_sentence?.quote, text, fallbackQuote),
        why: stringOr(input.rhetorical_analysis?.strongest_sentence?.why, "This sentence gives the clearest available statement of the argument.")
      },
      weakest_sentence: {
        quote: sourceQuoteOr(input.rhetorical_analysis?.weakest_sentence?.quote, text, fallbackQuote),
        why: stringOr(input.rhetorical_analysis?.weakest_sentence?.why, "This sentence carries more argumentative weight than it currently supports."),
        fix: stringOr(input.rhetorical_analysis?.weakest_sentence?.fix, "Rewrite it with a specific standard, source, and warrant.")
      }
    },
    rewrite_suggestions: ensureArray(input.rewrite_suggestions).map((item) => ({
      original: sourceQuoteOr(item?.original, text, fallbackQuote),
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

  normalized.overall_score = calibrateShortCoherentArgumentScore(normalized.overall_score, text, essaySentences);

  rebalanceScoreBreakdown(normalized);

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

  if (!normalized.argument_dependency_graph.links.length) {
    normalized.argument_dependency_graph.links = buildHeuristicDependencyLinks(normalized);
  }

  if (!normalized.attack_tree.length) {
    normalized.attack_tree = normalized.counter_arguments.slice(0, 4).map((item, index) => ({
      rank: index + 1,
      attack: item.steelman,
      targets: item.targets,
      why_dangerous: item.damage,
      fatality_score: item.fatality_score,
      response: item.suggested_rebuttal,
      crossfire_question: "What part of the original reasoning does your objection disprove?"
    }));
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

  // ── Preserve the model's lean-schema output ──────────────────────────────
  // The block above rebuilds the legacy schema for backward compatibility, but
  // the current engine + readable report use the lean schema. Overlay the
  // model's real fields so they reach the renderer instead of being discarded.
  if (input.thesis && typeof input.thesis === "object") {
    normalized.thesis = {
      quote: sourceQuoteOr(input.thesis.quote, text, ""),
      assessment: stringOr(input.thesis.assessment, "")
    };
  }
  normalized.strengths = ensureArray(input.strengths)
    .map((s) => ({ quote: stringOr(s?.quote, ""), why: stringOr(s?.why, "") }))
    .filter((s) => s.quote || s.why);
  const leanClaims = ensureArray(input.claims)
    .map((c) => ({
      quote: sourceQuoteOr(c?.quote, text, ""),
      rating: normalizeRating(c?.rating),
      warrant: stringOr(c?.warrant, ""),
      missing_warrant: stringOr(c?.missing_warrant, ""),
      diagnosis: stringOr(c?.diagnosis, ""),
      fix: stringOr(c?.fix, "")
    }))
    .filter((c) => c.quote);
  if (leanClaims.length) normalized.claims = leanClaims;
  if (input.counterargument && typeof input.counterargument === "object") {
    normalized.counterargument = {
      strongest_objection: stringOr(input.counterargument.strongest_objection, ""),
      how_to_answer: stringOr(input.counterargument.how_to_answer, "")
    };
  }
  // Preserve the richer v6-style sections the model produced.
  normalized.assumption_audit = ensureArray(input.assumption_audit)
    .map((a) => ({
      assumption: stringOr(a?.assumption, ""),
      load_bearing: normalizeLoad(a?.load_bearing),
      if_rejected: stringOr(a?.if_rejected, a?.if_changed, a?.vulnerability, ""),
      how_to_defend: stringOr(a?.how_to_defend, a?.justification, a?.defense, "")
    }))
    .filter((a) => a.assumption);
  normalized.logical_fallacies = ensureArray(input.logical_fallacies)
    .map((f) => ({
      name: stringOr(f?.name, ""),
      quote: sourceQuoteOr(f?.quote, text, ""),
      explanation: stringOr(f?.explanation, ""),
      fix: stringOr(f?.fix, "")
    }))
    .filter((f) => f.name && f.explanation);
  normalized.attack_tree = ensureArray(input.attack_tree)
    .map((t) => ({
      attack: stringOr(t?.attack, ""),
      targets: stringOr(t?.targets, ""),
      why_dangerous: stringOr(t?.why_dangerous, ""),
      response: stringOr(t?.response, "")
    }))
    .filter((t) => t.attack);
  if (input.rhetorical_analysis && typeof input.rhetorical_analysis === "object") {
    const ra = input.rhetorical_analysis;
    normalized.rhetorical_analysis = {
      strongest_sentence: {
        quote: sourceQuoteOr(ra.strongest_sentence?.quote, text, ""),
        why: stringOr(ra.strongest_sentence?.why, "")
      },
      weakest_sentence: {
        quote: sourceQuoteOr(ra.weakest_sentence?.quote, text, ""),
        why: stringOr(ra.weakest_sentence?.why, ""),
        fix: stringOr(ra.weakest_sentence?.fix, "")
      }
    };
  }
  // Pass through mode_analysis (impact_weighing, stock_issues, monroe_sequence, etc.)
  if (input.mode_analysis && typeof input.mode_analysis === 'object') {
    normalized.mode_analysis = input.mode_analysis;
  }

  // Keep the model's own score_breakdown + explanations when it used lean keys
  // (anything other than the four legacy dimensions). Rescale so dimensions sum to overall_score.
  if (input.score_breakdown && typeof input.score_breakdown === "object") {
    const keys = Object.keys(input.score_breakdown);
    const legacy = ["argument_strength", "assumption_audit", "logic", "rhetoric"];
    if (keys.some((k) => !legacy.includes(k))) {
      const rawBreakdown = {};
      for (const k of keys) rawBreakdown[k] = Math.max(0, Number(input.score_breakdown[k]) || 0);
      // Rescale so dimensions sum to overall_score regardless of how many dims there are.
      if (keys.length >= 2 && Number.isFinite(normalized.overall_score) && normalized.overall_score > 0) {
        const sum = keys.reduce((t, k) => t + rawBreakdown[k], 0);
        if (sum > 0 && sum !== normalized.overall_score) {
          const scale = normalized.overall_score / sum;
          let running = 0;
          keys.forEach((k, i) => {
            if (i < keys.length - 1) {
              rawBreakdown[k] = Math.max(0, Math.round(rawBreakdown[k] * scale));
              running += rawBreakdown[k];
            } else {
              rawBreakdown[k] = Math.max(0, normalized.overall_score - running);
            }
          });
        }
      }
      normalized.score_breakdown = rawBreakdown;
      if (input.score_explanations && typeof input.score_explanations === "object") {
        normalized.score_explanations = input.score_explanations;
      }
    }
  }

  // Pass through all mode-specific top-level fields the model produced.
  // This makes normalizeAudit forward-compatible with any new schema shape.
  const legacyTopLevelKeys = new Set([
    "overall_score", "score_breakdown", "score_explanations", "verdict", "coaching_note",
    "priority_fixes", "collapse_point", "argument_dependency_graph", "argument_strength",
    "assumption_audit", "logical_fallacies", "counter_arguments", "attack_tree",
    "truth_audit", "alternative_solutions_test", "rhetorical_analysis", "rewrite_suggestions",
    "thesis", "strengths", "claims", "counterargument", "mode_analysis"
  ]);
  for (const key of Object.keys(input)) {
    if (!legacyTopLevelKeys.has(key) && input[key] !== undefined && input[key] !== null) {
      normalized[key] = input[key];
    }
  }

  return normalized;
}

function rebalanceScoreBreakdown(audit) {
  const keys = ["argument_strength", "assumption_audit", "logic", "rhetoric"];
  const totalScore = clampInt(audit.overall_score, 0, 0, 100);
  const values = keys.map((key) => clampInt(audit.score_breakdown[key], 0, 0, 25));
  const currentTotal = values.reduce((sum, value) => sum + value, 0);
  if (currentTotal === totalScore) return;

  const raw = currentTotal > 0
    ? values.map((value) => totalScore * value / currentTotal)
    : keys.map(() => totalScore / keys.length);
  const next = raw.map((value) => Math.min(25, Math.floor(value)));
  let remainder = totalScore - next.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  while (remainder > 0) {
    let changed = false;
    for (const item of order) {
      if (next[item.index] >= 25 || remainder <= 0) continue;
      next[item.index] += 1;
      remainder -= 1;
      changed = true;
    }
    if (!changed) break;
  }

  keys.forEach((key, index) => {
    audit.score_breakdown[key] = next[index];
  });
}

function calibrateShortCoherentArgumentScore(score, text, sentences) {
  const clean = String(text || "").trim();
  const current = clampInt(score, 0, 0, 100);
  const words = clean.split(/\s+/).filter(Boolean).length;
  const hasPosition = /\b(should|must|ought|because|therefore|may|can|will|would|improves?|reduces?|causes?|leads? to)\b/i.test(clean);
  const hasReasoningBridge = /\b(because|therefore|since|so|so that|which means|as a result|but|however|although)\b/i.test(clean);
  const hasLoadedInsult = /\b(bum|idiot|stupid|lazy|evil|bad person|loser)\b/i.test(clean);
  const isNonsense = words < 12 || !hasPosition;
  if (isNonsense || hasLoadedInsult) return current;
  if (current < 60 && words >= 24 && sentences.length >= 2 && hasReasoningBridge) {
    return 62;
  }
  return current;
}

export function buildRecoveryAudit(essay, note = "Fracture recovered from a malformed model response and generated a validated report.") {
  const text = String(essay || "").trim();
  const sentences = splitSentences(text);
  const thesis = sentences[0] || text || "No text entered.";
  const hasNamedSource = /\b(according to|study|report|research|data|survey|article|journal|encyclopedia|britannica|brittanica)\b/i.test(text);
  const hasWarrant = /\b(because|therefore|since|so that|which means|as a result|this matters because|thus)\b/i.test(text);
  const hasImpact = /\b(impact|matters|harm|benefit|consequence|therefore|ultimately|important)\b/i.test(text);
  const hasCounter = /\b(however|although|critics|opponents|some may argue|counterargument|but)\b/i.test(text);
  const usesLoadedLabel = /\b(bum|idiot|stupid|lazy|evil|bad person|loser)\b/i.test(text);
  const sourceSentence = sentences.find((s) => /\b(according to|study|report|research|britannica|brittanica)\b/i.test(s)) || sentences[1] || thesis;
  const collapseSentence = sentences.find((s) => /\b(should|must|because|causes?|leads? to|therefore|proves?|improves?|reduces?)\b/i.test(s)) || thesis;
  const score = heuristicScore(text, { hasNamedSource, hasWarrant, hasImpact, hasCounter, usesLoadedLabel });

  return normalizeAudit({
    overall_score: score,
    score_breakdown: {
      argument_strength: Math.min(25, Math.max(3, Math.round(score * 0.34))),
      assumption_audit: Math.min(25, Math.max(2, Math.round(score * 0.18))),
      logic: Math.min(25, Math.max(3, Math.round(score * 0.24))),
      rhetoric: Math.min(25, Math.max(4, Math.round(score * 0.24)))
    },
    verdict: usesLoadedLabel
      ? "The draft states a position, but loaded wording prevents the reader from evaluating a precise academic standard. The fastest repair is to define the claim neutrally, explain the reasoning bridge, and then check the source details separately."
      : "This stable report found a visible argument structure and the most important reasoning risks available from the draft. Strengthen the claim-to-warrant chain first, then use source verification for any factual statements that still need checking.",
    coaching_note: usesLoadedLabel
      ? "Replace loaded wording with a neutral, testable claim and write one warrant sentence that explains the standard."
      : "Make the central warrant explicit: state why the strongest evidence logically supports the conclusion.",
    priority_fixes: buildHeuristicFixes(text),
    collapse_point: {
      quote: collapseSentence,
      why_it_collapses: "This sentence carries the argument's main inferential weight. If the reader rejects its reasoning or scope, the conclusion loses force.",
      opponent_attack: "Why does this point prove the broader conclusion, and what happens if a reasonable counterexample exists?",
      reinforcement: "Narrow the wording if needed, then add one explicit warrant and the strongest directly relevant evidence."
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
        rating: ratingForSentence(sentence),
        diagnosis: /\b(because|therefore|since|which means|as a result)\b/i.test(sentence)
          ? "This sentence attempts a reasoning bridge. Check whether its conclusion is narrower than the evidence and whether the causal step is explained."
          : "This sentence advances a point, but the connection to the thesis is not explicit enough for a skeptical reader.",
        opponent_exploit: "A skeptical reader can ask why this sentence changes the conclusion rather than simply adding another fact or assertion.",
        fix: "Add one warrant sentence that names the connection to the thesis. Use source verification separately if the sentence also makes a factual claim."
      }))
    },
    assumption_audit: [
      {
        assumption: usesLoadedLabel
          ? "The reader accepts the loaded label as a meaningful standard."
          : "The reader accepts the unstated bridge between the evidence and the conclusion.",
        load_bearing: "HIGH",
        quote: collapseSentence,
        vulnerability: "If the bridge is too broad, the same evidence may support a smaller conclusion without proving this one.",
        defense: "State the warrant directly, qualify the claim where necessary, and explain why plausible alternatives do not defeat the inference."
      },
      {
        assumption: usesLoadedLabel
          ? "The label used in the thesis is acceptable as an academic category."
          : "The thesis is scoped narrowly enough for the available reasoning to prove.",
        load_bearing: "MEDIUM",
        quote: thesis,
        vulnerability: usesLoadedLabel
          ? "If the label is seen as vague or pejorative, the reader may reject the tone before evaluating the evidence."
          : "If the thesis is too broad, a single counterexample can defeat more of the argument than necessary.",
        defense: usesLoadedLabel
          ? "Use a neutral term and define the exact condition or behavior being evaluated."
          : "Define the standard, narrow the scope, and connect the evidence to that smaller claim."
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
      ...(hasNamedSource ? [{
        name: "Source Verification Needed",
        quote: sourceSentence,
        explanation: "The draft invokes an outside source. That is a research task to verify separately, not automatic proof that the reasoning fails.",
        fix: "Use Verify Sources to check the match, then cite the exact passage if the source supports this claim."
      }] : [])
    ],
    counter_arguments: [
      {
        steelman: usesLoadedLabel
          ? "A skeptical reader could argue that the draft relies on a loaded label instead of a defined standard. Even if some supporting details are accurate, the conclusion remains vague until the writer explains what the label means and why those details satisfy it."
          : "A skeptical reader could accept the draft's evidence and still reject the conclusion. The missing step is the warrant: the draft needs to explain why the evidence proves this specific claim rather than a narrower one.",
        targets: collapseSentence,
        damage: "This challenge breaks the reasoning bridge between the support and the conclusion.",
        suggested_rebuttal: usesLoadedLabel
          ? "Answer by replacing the label with a neutral standard and showing how the evidence meets that standard."
          : "Answer by writing the missing warrant explicitly and qualifying the conclusion to match what the evidence can prove."
      }
    ],
    rhetorical_analysis: {
      opening_hook: usesLoadedLabel
        ? "The opening is direct, but the tone is not yet academic. A more professional opening would define the claim before evaluating evidence."
        : "The opening is direct, but it needs a more precise standard and a clearer path into the evidence.",
      logical_flow: "The draft should move through assertion, reasoning, evidence, and impact in a visible order. Check whether each paragraph completes one of those jobs before moving to the next point.",
      strongest_sentence: {
        quote: hasNamedSource ? sourceSentence : collapseSentence,
        why: hasNamedSource ? "This sentence attempts to ground the argument in outside evidence." : "This sentence carries the clearest available reasoning signal in the draft."
      },
      weakest_sentence: {
        quote: thesis,
        why: usesLoadedLabel
          ? "It uses a loaded label without defining the standard."
          : "It carries major argumentative weight without making the warrant explicit.",
        fix: usesLoadedLabel
          ? "The argument should identify a specific, verifiable condition and avoid pejorative labels."
          : "The argument should define the standard, state the warrant, and use source verification separately for factual claims."
      }
    },
    rewrite_suggestions: [
      {
        original: thesis,
        rewrite: usesLoadedLabel
          ? "The subject should be described with a precise, verifiable claim rather than a loaded label, and that claim should be supported by a complete citation."
          : "The thesis should define a precise standard and state the central reason the reader should accept it.",
        improvement: "The rewrite turns the sentence into an academic standard the reader can evaluate."
      },
      ...(hasNamedSource ? [{
        original: sourceSentence,
        rewrite: "According to [source], [specific finding]. This supports the claim because [explicit warrant].",
        improvement: "The rewrite keeps source verification and logical explanation visible as two separate tasks."
      }] : [])
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
  const observation = sentences.find((s) => s !== thesis && s !== sourceSentence) || sentences[2] || sourceSentence;
  const loaded = /\b(bum|idiot|stupid|lazy|evil|bad person|loser)\b/i.test(thesis);
  const hasSource = /\b(according to|study|report|research|data|survey|article|journal|encyclopedia|britannica|brittanica)\b/i.test(text);

  return [
    {
      quote: thesis,
      problem: loaded ? "The thesis uses a loaded label instead of an academic standard." : "The thesis needs a clearer standard.",
      why_it_matters: "Loaded or undefined wording makes the argument easier to dismiss before the evidence is evaluated.",
      exact_fix: "Define the exact condition being argued, narrow the scope, and use neutral language.",
      rewrite: "The argument should state a specific, neutral claim and name the standard the reader should apply."
    },
    {
      quote: observation,
      problem: "The draft needs a more explicit warrant.",
      why_it_matters: "A reader can accept this sentence and still ask why it proves the conclusion.",
      exact_fix: "Add one sentence that begins with a clear reasoning move such as 'This matters because' or 'This supports the claim because.'",
      rewrite: "This supports the claim because [explain the exact connection between the evidence and the conclusion]."
    },
    ...(hasSource ? [{
      quote: sourceSentence,
      problem: "The source reference needs a separate verification pass.",
      why_it_matters: "The reasoning can be evaluated now, but the writer should still confirm that the cited source supports this exact claim.",
      exact_fix: "Use Verify Sources, inspect the retrieved page, and add the author, title, date, locator, and exact relevant passage.",
      rewrite: "According to [source], [specific finding]. This supports the claim because [warrant]."
    }] : [])
  ];
}

function heuristicScore(text, signals) {
  const tokenCount = words(text).length;
  const sentenceCount = splitSentences(text).length;
  let score = 18;
  if (tokenCount >= 45) score += 8;
  if (tokenCount >= 120) score += 8;
  if (tokenCount >= 350) score += 6;
  if (sentenceCount >= 4) score += 7;
  if (sentenceCount >= 8) score += 5;
  if (signals.hasWarrant) score += 10;
  if (signals.hasImpact) score += 6;
  if (signals.hasCounter) score += 6;
  if (signals.hasNamedSource) score += 5;
  if (signals.usesLoadedLabel) score -= 14;
  return Math.max(8, Math.min(72, score));
}

function ratingForSentence(sentence) {
  const hasReasoning = /\b(because|therefore|since|which means|as a result|so that)\b/i.test(sentence);
  const hasEvidence = /\b(according to|study|report|research|data|survey|shows?|found)\b/i.test(sentence);
  if (hasReasoning && hasEvidence) return "STRONG";
  if (hasReasoning || hasEvidence) return "MODERATE";
  return "WEAK";
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

function sourceQuoteOr(value, sourceText, fallback) {
  const candidate = stringOr(value);
  const source = String(sourceText || "");
  if (candidate && source) {
    const index = source.toLowerCase().indexOf(candidate.toLowerCase());
    if (index >= 0) return source.slice(index, index + candidate.length);
  }
  return stringOr(fallback, source);
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

function normalizeFatality(value) {
  const fatality = String(value || "").toUpperCase();
  return ["FATAL", "HIGH", "MEDIUM", "LOW"].includes(fatality) ? fatality : "MEDIUM";
}

function normalizeRelationship(value) {
  const relationship = String(value || "").toLowerCase();
  return ["supports", "assumes", "leads to", "rebuts"].includes(relationship) ? relationship : "supports";
}

function normalizeTruthStatus(value) {
  const status = String(value || "").toUpperCase();
  return ["VERIFY", "LIKELY", "UNCLEAR"].includes(status) ? status : "VERIFY";
}

function normalizeYesNo(value) {
  return String(value || "").toUpperCase() === "YES" ? "YES" : "NO";
}

function stringArray(value) {
  return ensureArray(value).map((item) => stringOr(item)).filter(Boolean).slice(0, 12);
}

function buildHeuristicDependencyLinks(audit) {
  const thesis = audit.argument_strength?.thesis?.quote || "Thesis";
  return ensureArray(audit.argument_strength?.claims).slice(0, 6).map((claim) => ({
    from: claim.quote,
    to: thesis,
    relationship: "supports",
    strength: claim.rating,
    risk: claim.rating === "STRONG"
      ? "This connection appears useful, but it should still survive close questioning."
      : "If this connection is not repaired, the thesis loses part of its support."
  }));
}
