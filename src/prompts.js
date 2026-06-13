// prompts.js — Fracture Studio v6.0 — All mode prompts with depth levels

export function buildAuditMessages(essay, preferences) {
  const mode = (preferences && preferences.analysisFormat) || 'argument';
  const depth = (preferences && preferences.depthLevel) || 'medium';
  const systemPrompt = buildSystemPrompt(mode, depth);
  const userPrompt = buildUserPrompt(essay, mode, depth);
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

function buildSystemPrompt(mode, depth) {
  const depthInstruction = getDepthInstruction(depth);
  const modeInstruction = getModeInstruction(mode);
  return `You are Fracture Studio — an elite argument analysis engine built for competitive debate, academic writing, and strategic thinking.

${depthInstruction}

${modeInstruction}

CRITICAL RULES:
1. Every claim that needs evidence MUST include 3-5 real, clickable URLs from authoritative sources (Google Scholar, JSTOR, PubMed, major news outlets, government sites, academic institutions).
2. For every weakness you identify, provide specific counter-evidence with real source URLs that the writer can use to disprove the weakness or strengthen their argument.
3. Format source URLs as actual full URLs: https://...
4. Never invent fake statistics. If a number is needed as example, describe the type of study needed.
5. Return ONLY valid JSON. No markdown, no code fences, no commentary outside JSON.
6. Never repeat the same issue in multiple sections. Each section must add NEW information.
7. Score with ruthless honesty. A weak argument cannot score above 60 regardless of surface polish.`;
}

function getDepthInstruction(depth) {
  switch (depth) {
    case 'surface':
      return `DEPTH: SURFACE LEVEL (Quick Check — like reviewing a school essay)
- Identify the 3 most critical problems only
- Keep explanations brief and actionable
- Provide 2-3 source links per fix
- Score categories with simple labels
- Skip advanced sections like dependency graphs and assumption excavation
- Focus on: main point clarity, obvious evidence gaps, basic logic
- Tone: encouraging but honest`;
    case 'extreme':
      return `DEPTH: EXTREME (Tournament Prep — like preparing for nationals)
- Perform a complete forensic audit of every sentence
- Map every claim, warrant, assumption, dependency
- Generate 5+ opponent attacks with exact rebuttal language
- Provide 5 real source URLs per evidence gap
- Include strategic recommendations for competitive scenarios
- Identify dependent claims that collapse if one assumption fails
- Quote exact text for every problem identified
- Tone: ruthlessly direct, no softening, maximum technical detail
- This analysis must be thorough enough to prepare someone for a national tournament`;
    default: // medium
      return `DEPTH: MEDIUM (Serious Prep — like preparing for a regional debate)
- Full score breakdown with explanations
- Identify all major problems with clear diagnosis
- Provide 3-4 real source URLs per evidence gap
- Include counterargument analysis and rebuttal guidance
- Cover claims, warrants, assumptions, and rhetoric
- Tone: direct and technical but clear`;
  }
}

function getModeInstruction(mode) {
  switch (mode) {
    case 'speech':
      return `MODE: SPEECH/PRESENTATION
Focus on: audience clarity, delivery markup, hook strength, memorability, persuasion, visual aid suggestions, speaking flow, call to action strength.
Include delivery notes like [pause], [emphasize], [eye contact] inline with text.`;
    case 'essay':
      return `MODE: ESSAY/ACADEMIC WRITING
Focus on: thesis precision, paragraph architecture, evidence-to-analysis ratio, transitions, grammar/style, redundancy, conclusion strength, counterargument integrity.`;
    case 'rubric':
      return `MODE: RUBRIC GRADING
Grade ONLY based on the rubric provided. Map each rubric criterion to scoring. Include teacher-style comments and a point recovery plan.`;
    case 'college-essay':
      return `MODE: COLLEGE ACADEMIC ESSAY
Focus on: thesis arguability, paragraph job map, close reading quality, historical/philosophical reasoning, academic tone, professor-style feedback.`;
    case 'research-paper':
      return `MODE: RESEARCH PAPER
Focus on: research question clarity, thesis-evidence alignment, literature review quality, source quality ranking, citation coverage, claim-to-citation mapping, missing citations.`;
    case 'model-un':
      return `MODE: MODEL UNITED NATIONS
Focus on: country position accuracy, policy consistency, resolution clause quality, diplomatic language, bloc strategy, caucus topic strength, realistic solutions.`;
    default: // argument/debate
      return `MODE: ARGUMENT/DEBATE
Focus on: thesis burden, claim-evidence-warrant chain, rebuttal readiness, logical fallacies, impact weighing, attackable gaps, source strength, extra arguments the writer is missing.`;
  }
}

function buildUserPrompt(essay, mode, depth) {
  const schema = getSchema(mode, depth);
  return `Analyze this writing and return ONLY the JSON object below. No text before or after.

WRITING TO ANALYZE:
"""
${essay}
"""

Return this exact JSON structure:
${schema}`;
}

function getSchema(mode, depth) {
  const isSurface = depth === 'surface';
  const isExtreme = depth === 'extreme';

  if (mode === 'rubric') {
    return JSON.stringify({
      overall_score: 0,
      percentage: "0%",
      letter_grade: "B",
      verdict: "string",
      rubric_breakdown: [{
        criterion: "string",
        score_earned: 0,
        score_possible: 0,
        reason: "string",
        evidence_from_text: "string",
        what_is_missing: "string",
        how_to_improve: "string"
      }],
      teacher_comment: "string",
      point_recovery_plan: [{
        action: "string",
        points_possible: 0,
        how_to_do_it: "string"
      }],
      fastest_improvements: ["string"],
      score_breakdown: { thesis: 0, evidence: 0, analysis: 0, grammar: 0, structure: 0 }
    }, null, 2);
  }

  const baseSchema = {
    overall_score: 85,
    verdict: "One paragraph verdict on the argument's overall strength and primary failure point.",
    score_breakdown: {
      argument_strength: 20,
      assumption_audit: 18,
      logic: 19,
      rhetoric: 18,
      source_quality: 10,
      score_descriptions: {
        argument_strength: "Why this score",
        assumption_audit: "Why this score",
        logic: "Why this score",
        rhetoric: "Why this score",
        source_quality: "Why this score"
      }
    },
    thesis_check: {
      quote: "Exact thesis sentence from the text",
      is_arguable: true,
      is_too_broad: false,
      burden_of_proof: "What the writer must prove to win",
      assessment: "Detailed assessment of thesis strength",
      improvement: "Exact improved thesis sentence"
    },
    claims: [
      {
        quote: "Exact claim text",
        rating: "STRONG|MODERATE|WEAK",
        diagnosis: "What is wrong or right with this claim",
        missing_warrant: "The logical step that was skipped",
        evidence_needed: "What type of evidence would prove this",
        opponent_exploit: "How an opponent would attack this specific claim",
        fix: "Exact repair sentence",
        sources_to_find: [
          { description: "What to look for", search_terms: "search query", url: "https://scholar.google.com/scholar?q=your+search+here" },
          { description: "What to look for", search_terms: "search query", url: "https://www.jstor.org/stable/search?query=your+search" }
        ]
      }
    ],
    attackable_gaps: [
      {
        gap: "Description of the gap",
        why_vulnerable: "Why an opponent can exploit this",
        quote: "The exact text that has the gap",
        how_to_close: "Exact fix",
        evidence_to_add: [
          { type: "What kind of source", search_terms: "search terms", url: "https://pubmed.ncbi.nlm.nih.gov/?term=your+search" }
        ]
      }
    ],
    rebuttal_prep: {
      strongest_rebuttal: {
        attack: "The strongest attack an opponent could make",
        targets: "Which part of the argument this destroys",
        how_to_answer: "Exact language to answer this attack",
        evidence_to_block_it: [
          { description: "What evidence would block this attack", url: "https://www.google.com/search?q=your+search+here" }
        ]
      },
      easiest_rebuttal: {
        attack: "The easiest attack",
        why_easy: "Why this is easy to attack",
        how_to_answer: "Exact answer"
      },
      sneakiest_rebuttal: {
        attack: "The sneakiest attack",
        why_sneaky: "What makes this hard to see coming",
        how_to_answer: "Exact answer"
      }
    },
    logical_fallacies: [
      {
        name: "Fallacy name",
        quote: "Exact text containing the fallacy",
        explanation: "Why this is a fallacy (not just the name)",
        fix: "How to rewrite this without the fallacy"
      }
    ],
    extra_arguments: [
      {
        argument: "A strong argument the writer is completely missing",
        why_important: "Why this argument would strengthen the case",
        how_to_add: "Where and how to integrate this into the existing argument",
        sources: [
          { description: "Source to find this evidence", url: "https://scholar.google.com/scholar?q=your+search" },
          { description: "Another source", url: "https://www.jstor.org/stable/search?query=your+search" }
        ]
      }
    ],
    impact_weighing: {
      does_argument_weigh: false,
      why_weighing_matters: "Why impact comparison matters in this context",
      magnitude: "Assessment of claim magnitude",
      probability: "Assessment of probability",
      timeframe: "Assessment of timeframe",
      how_to_outweigh: "Exact language to add for impact comparison"
    },
    rhetorical_analysis: {
      opening_hook: "Assessment of the opening",
      hook_strength: "STRONG|MODERATE|WEAK",
      logical_flow: "Assessment of logical flow",
      persuasion_assessment: "How persuasive is this for the target audience",
      strongest_sentence: { quote: "exact text", why: "why it is strong" },
      weakest_sentence: { quote: "exact text", why: "why it is weak", fix: "exact rewrite" }
    }
  };

  if (!isSurface) {
    Object.assign(baseSchema, {
      assumption_audit: [
        {
          assumption: "What is being assumed without proof",
          type: "HIDDEN|ACKNOWLEDGED_BUT_UNDEFENDED|STRUCTURAL",
          quote: "Text that depends on this assumption",
          if_assumption_fails: "What collapses if this assumption is wrong",
          how_to_defend: "Exact sentence that would defend this assumption",
          sources: [
            { description: "What to find", url: "https://scholar.google.com/scholar?q=your+search" }
          ]
        }
      ],
      collapse_point: {
        quote: "The single most load-bearing sentence",
        why_it_collapses: "Why this is the fatal weak point",
        dependent_claims: ["claim that depends on this"],
        survival_probability: 45,
        strongest_attack: "The attack that targets this point",
        strongest_defense: "Exact sentence to add to protect this point"
      },
      argument_dependency_graph: {
        explanation: "How the argument's parts connect",
        links: [
          { from: "Supporting point", relationship: "proves", to: "Main claim", strength: "WEAK|MODERATE|STRONG", risk: "What breaks if this link fails" }
        ]
      }
    });
  }

  if (isExtreme) {
    Object.assign(baseSchema, {
      definitional_audit: [
        {
          term: "Key term used in argument",
          defined_in_text: false,
          definition_stable: true,
          how_opponent_contests: "How an opponent could redefine this term to sidestep the argument",
          recommended_definition: "Exact definition to add"
        }
      ],
      citation_integrity: [
        {
          claim: "The specific claim citing evidence",
          source_named: false,
          rating: "STRONG|USABLE|WEAK|FABRICATION_RISK",
          population_match: true,
          is_current: true,
          intent_outcome_conflation: false,
          problem: "What is wrong with this citation",
          fix: "How to repair the citation"
        }
      ],
      internal_consistency: [
        {
          contradiction: "Description of the contradiction",
          text_a: "First contradicting passage",
          text_b: "Second contradicting passage",
          how_to_resolve: "Exact fix"
        }
      ],
      opponent_stress_test: [
        {
          objection: "Exact language opponent would use out loud",
          targets_section: "Which part of the speech this targets",
          current_handling: "HANDLES|PARTIALLY_HANDLES|DOES_NOT_HANDLE",
          language_to_add: "Exact sentence to add to handle this"
        }
      ],
      strategic_recommendations: [
        {
          recommendation: "Strategic advice for competitive use",
          why: "Why this would improve competitive performance"
        }
      ]
    });
  }

  const priorityFixes = {
    priority_fixes: [
      {
        problem: "Problem name in one line",
        quote: "Exact text to fix",
        why_it_matters: "Why this damages the argument",
        exact_fix: "Exact replacement sentence",
        rewrite: "Full rewritten version",
        score_impact: "+5 points"
      }
    ]
  };

  return JSON.stringify({ ...baseSchema, ...priorityFixes }, null, 2);
}

export function buildRebuttalMessages(draft, report, focus) {
  return [
    {
      role: 'system',
      content: `You are Fracture Studio's Rebuttal Engine. Generate a strategic, citation-rich rebuttal preparation plan.

For every weakness you expose, provide:
1. The exact attack an opponent would make
2. Evidence the writer can use to counter-attack (with real URLs)
3. Exact rebuttal language to deliver out loud

Include real source URLs from Google Scholar, JSTOR, PubMed, government sites.
Format as readable text with clear sections. No JSON.`
    },
    {
      role: 'user',
      content: `Generate a complete rebuttal preparation plan for this argument.

ARGUMENT:
${draft}

${report ? `FRACTURE REPORT CONTEXT:\nVerdict: ${report.verdict || 'Not available'}\nCollapse point: ${(report.collapse_point || {}).quote || 'Not identified'}\n` : ''}

${focus ? `SPECIFIC FOCUS: ${focus}` : ''}

Structure your response as:
1. STEELMAN (the strongest version of the opposing argument)
2. TOP 3 ATTACKS (most dangerous opponent moves with exact language)
3. REBUTTAL ARSENAL (counter-evidence with source URLs for each attack)
4. CROSSFIRE PREPARATION (5 questions your opponent will ask + your answers)
5. IMPACT COMPARISON (why your argument outweighs)
6. CLOSING LANGUAGE (exact 30-second closing that addresses the main attacks)

For each section, include 2-3 real source URLs that support your rebuttal evidence.`
    }
  ];
}

export function buildChatMessages(message, draft, report, selectedPoint, history) {
  return [
    {
      role: 'system',
      content: `You are Fracture Chat — a focused argument coach. You help writers strengthen specific parts of their argument.

When asked about evidence gaps, always provide real source URLs.
When suggesting rewrites, write the exact sentence.
Keep responses focused and practical.
If the writer asks about a specific claim or pressure point, focus all advice on that exact text.`
    },
    ...history.slice(-6),
    {
      role: 'user',
      content: `${selectedPoint ? `SELECTED PRESSURE POINT: "${selectedPoint}"\n\n` : ''}${message}

${draft ? `DRAFT CONTEXT:\n${draft.slice(0, 2000)}` : ''}
${report ? `\nFRACTURE REPORT: Score ${report.overall_score}/100. Verdict: ${report.verdict || ''}` : ''}`
    }
  ];
}
