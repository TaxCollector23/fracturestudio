import { parseSourcesText, type CitationSource } from './citationEngine';
import { buildEvidenceReport, type EvidenceEngineReport } from './evidenceEngine';
import { analyzeArgument, type ClaimFinding, type FractureAnalysis, type JudgeMode } from './fractureEngine';
import { buildRebuttalCards, type OpponentPersona } from './rebuttalEngine';

export type GraphNodeType = 'thesis' | 'claim' | 'evidence' | 'warrant' | 'assumption' | 'impact' | 'rebuttal';
export type GraphEdgeStyle = 'solid' | 'thin' | 'broken';
export type JudgeBallotPersona = 'teacher' | 'professor' | 'debate judge' | 'lay judge' | 'evidence-heavy judge' | 'skeptical reader';
export type RubricStatus = 'satisfied' | 'partially satisfied' | 'missing';

export type InteractiveGraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  strength: number;
  role: string;
  whyItMatters: string;
  weakness: string;
  fix: string;
  askPrompt: string;
};

export type InteractiveGraphEdge = {
  from: string;
  to: string;
  label: string;
  strength: number;
  style: GraphEdgeStyle;
  issue: string;
};

export type InteractiveArgumentGraph = {
  nodes: InteractiveGraphNode[];
  edges: InteractiveGraphEdge[];
  unsupportedClaimIds: string[];
};

export type CollapsePointReport = {
  sentence: string;
  dependsOn: string[];
  opponentAttack: string;
  reinforcePlan: string[];
  saferReplacement: string;
};

export type SourceClaimVerificationItem = {
  claimId: string;
  claim: string;
  sourceId?: string;
  sourceLabel: string;
  supportStrength: number;
  status: 'supported' | 'partial' | 'unsupported' | 'suspicious';
  problems: string[];
  fix: string;
};

export type SourceClaimVerificationReport = {
  sources: CitationSource[];
  items: SourceClaimVerificationItem[];
  decorativeSources: string[];
  evidenceReport: EvidenceEngineReport;
};

export type WarRoomAttackType = 'logic attack' | 'evidence attack' | 'moral attack' | 'practicality attack' | 'definition attack' | 'delivery attack';

export type WarRoomAttack = {
  type: WarRoomAttackType;
  target: string;
  opponentWillSay: string;
  whyDangerous: string;
  howToAnswer: string;
  crossfireQuestion: string;
  evidenceThatShutsItDown: string;
  severity: number;
};

export type SpeedDebateBrief = {
  tenSecondAnswer: string;
  thirtySecondAnswer: string;
  twoMinuteRebuttal: string;
  crossfireQuestion: string;
  weighingLine: string;
  riskWarning: string;
};

export type RevisionMissionDetail = {
  title: string;
  target: string;
  whyItMatters: string;
  whatToChange: string;
  successLooksLike: string;
  suggestedRewrite: string;
};

export type JudgeBallotPrediction = {
  persona: JudgeBallotPersona;
  predictedScore: number;
  ballot: string;
  whatTheyLike: string;
  whatTheyAttack: string;
  whatCouldLose: string;
  fixFirst: string;
};

export type SpeechDeliveryReport = {
  wordCount: number;
  slowSeconds: number;
  averageSeconds: number;
  fastSeconds: number;
  pacingBySection: string[];
  denseSentences: string[];
  pauseCues: string[];
  emphasisCues: string[];
  openingCheck: string;
  endingCheck: string;
  performanceScript: string;
};

export type RubricCriterionCheck = {
  criterion: string;
  status: RubricStatus;
  pointRisk: number;
  evidenceInDraft: string;
  revisionTask: string;
};

export type RubricAlignmentReport = {
  criteria: RubricCriterionCheck[];
  overallReadiness: number;
  summary: string;
};

export type VersionHistoryEntry = {
  id: string;
  createdAt: string;
  title: string;
  score: number;
  verdict: string;
  wordCount: number;
  fixedWeaknesses: string[];
  remainingWeaknesses: string[];
  strongestRevision: boolean;
  draft: string;
  report: string;
};

export type AdvancedFeaturePack = {
  analysis: FractureAnalysis;
  graph: InteractiveArgumentGraph;
  collapse: CollapsePointReport;
  sourceVerification: SourceClaimVerificationReport;
  warRoom: WarRoomAttack[];
  speedBrief: SpeedDebateBrief;
  methodReport: string;
  missions: RevisionMissionDetail[];
  ballots: JudgeBallotPrediction[];
  speechDelivery: SpeechDeliveryReport;
  rubric: RubricAlignmentReport;
};

const VERSION_HISTORY_KEY = 'fracture-studio-version-history-v2';
const judgePersonas: JudgeBallotPersona[] = ['teacher', 'professor', 'debate judge', 'lay judge', 'evidence-heavy judge', 'skeptical reader'];
const attackTypes: WarRoomAttackType[] = ['logic attack', 'evidence attack', 'moral attack', 'practicality attack', 'definition attack', 'delivery attack'];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trim(value: string, max = 150): string {
  const clean = compact(value);
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trim()}...`;
}

function words(value: string): string[] {
  return value.match(/[A-Za-z0-9']+/g) ?? [];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includeAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function qualify(value: string): string {
  return compact(value)
    .replace(/\balways\b/gi, 'often')
    .replace(/\bnever\b/gi, 'rarely')
    .replace(/\beveryone\b/gi, 'many people')
    .replace(/\bno one\b/gi, 'few people')
    .replace(/\bguarantees?\b/gi, 'makes more likely')
    .replace(/\binevitably\b/gi, 'can');
}

function strengthForClaim(claim: ClaimFinding): number {
  if (claim.certainty === 'likely' || claim.certainty === 'proven') {
    return claim.evidence.length > 0 ? 76 : 64;
  }
  if (claim.certainty === 'possible') {
    return 58;
  }
  if (claim.certainty === 'exaggerated' || claim.certainty === 'false-looking') {
    return 26;
  }
  return 34;
}

function edgeStyle(strength: number, hasMissingLink = false): GraphEdgeStyle {
  if (hasMissingLink || strength < 35) {
    return 'broken';
  }
  if (strength < 62) {
    return 'thin';
  }
  return 'solid';
}

function graphNode(input: Omit<InteractiveGraphNode, 'askPrompt'>): InteractiveGraphNode {
  return {
    ...input,
    askPrompt: `Explain this ${input.type} and help me repair it: ${input.label}. Weakness: ${input.weakness}. Fix: ${input.fix}`,
  };
}

function graphEdge(from: string, to: string, label: string, strength: number, issue: string): InteractiveGraphEdge {
  return {
    from,
    to,
    label,
    strength: clamp(strength),
    style: edgeStyle(strength, /missing|unsupported|decorative/i.test(issue)),
    issue,
  };
}

export function buildInteractiveArgumentGraph(analysis: FractureAnalysis): InteractiveArgumentGraph {
  const nodes: InteractiveGraphNode[] = [
    graphNode({
      id: 'thesis',
      type: 'thesis',
      label: trim(analysis.thesis.text, 120),
      strength: analysis.thesis.score,
      role: 'Main claim the rest of the case must prove.',
      whyItMatters: 'Every claim, source, and impact should point back to this sentence.',
      weakness: analysis.thesis.precision.find((item) => /too|needs|overconfident|broad/i.test(item)) ?? 'The thesis is usable, but it still needs pressure from the rest of the graph.',
      fix: 'Keep the thesis specific, arguable, narrow, and connected to a clear burden of proof.',
    }),
  ];
  const edges: InteractiveGraphEdge[] = [];
  const unsupportedClaimIds: string[] = [];

  analysis.claims.slice(0, 6).forEach((claim, index) => {
    const claimStrength = strengthForClaim(claim);
    const claimId = claim.id;
    if (claimStrength < 45) {
      unsupportedClaimIds.push(claimId);
    }

    nodes.push(
      graphNode({
        id: claimId,
        type: 'claim',
        label: trim(claim.text, 120),
        strength: claimStrength,
        role: `Claim ${index + 1} supporting the thesis.`,
        whyItMatters: 'If this branch fails, the thesis has less support and the judge has less reason to believe the case.',
        weakness: claim.vulnerability,
        fix: claim.evidence.length > 0 ? 'Add a clearer warrant that explains why the evidence proves this claim.' : 'Attach direct evidence before polishing the sentence.',
      }),
    );
    edges.push(graphEdge('thesis', claimId, 'supported by claim', claimStrength, claimStrength < 45 ? 'Claim is not protected enough yet.' : 'Claim is connected to thesis.'));

    const evidenceId = `${claimId}-evidence`;
    if (claim.evidence[0]) {
      nodes.push(
        graphNode({
          id: evidenceId,
          type: 'evidence',
          label: trim(claim.evidence[0], 120),
          strength: 68,
          role: 'Data, example, or source that grounds the claim.',
          whyItMatters: 'Evidence turns the claim from assertion into something a reader can check.',
          weakness: 'This evidence still needs source quality and relevance checks.',
          fix: 'Verify source authority, date, and direct connection to the claim.',
        }),
      );
      edges.push(graphEdge(evidenceId, claimId, 'grounds', 68, 'Evidence exists, but it still needs a source-to-claim check.'));
    } else {
      nodes.push(
        graphNode({
          id: evidenceId,
          type: 'evidence',
          label: `Missing evidence for ${claim.id}`,
          strength: 0,
          role: 'The claim currently has no direct proof.',
          whyItMatters: 'A skilled opponent can force the writer to defend the claim with nothing but wording.',
          weakness: 'Unsupported claim.',
          fix: 'Add a statistic, primary source, expert source, concrete example, or comparison.',
        }),
      );
      edges.push(graphEdge(evidenceId, claimId, 'missing proof', 0, 'Missing evidence creates a broken support line.'));
    }

    const warrantId = `${claimId}-warrant`;
    const warrantMissing = /^missing/i.test(claim.warrant);
    const warrantStrength = warrantMissing ? 18 : /^thin/i.test(claim.warrant) ? 44 : 72;
    nodes.push(
      graphNode({
        id: warrantId,
        type: 'warrant',
        label: trim(claim.warrant, 120),
        strength: warrantStrength,
        role: 'Reasoning bridge between evidence and claim.',
        whyItMatters: 'True evidence does not automatically prove a claim. The warrant is the bridge.',
        weakness: warrantMissing ? 'The bridge is missing.' : /^thin/i.test(claim.warrant) ? 'The bridge is visible but too thin.' : 'The bridge is usable.',
        fix: 'Write one because sentence that names the mechanism from evidence to conclusion.',
      }),
    );
    edges.push(graphEdge(warrantId, claimId, 'reasoning bridge', warrantStrength, claim.warrant));

    const assumption = analysis.assumptions[index];
    if (assumption) {
      const assumptionId = `${claimId}-assumption`;
      const assumptionStrength = claimStrength < 50 ? 34 : 56;
      nodes.push(
        graphNode({
          id: assumptionId,
          type: 'assumption',
          label: trim(assumption, 120),
          strength: assumptionStrength,
          role: 'Hidden premise the reader must accept.',
          whyItMatters: 'Hidden assumptions are dangerous because opponents can attack them before the writer notices.',
          weakness: claimStrength < 50 ? 'This assumption is carrying too much weight without proof.' : 'This assumption should still be stated more directly.',
          fix: 'Make the assumption explicit and defend it with one sentence of evidence or reasoning.',
        }),
      );
      edges.push(graphEdge(assumptionId, claimId, 'hidden premise', assumptionStrength, claimStrength < 50 ? 'Risky hidden assumption.' : 'Assumption should be made explicit.'));
    }

    const rebuttalId = `${claimId}-rebuttal`;
    nodes.push(
      graphNode({
        id: rebuttalId,
        type: 'rebuttal',
        label: trim(claim.vulnerability, 120),
        strength: 100 - claimStrength,
        role: 'Likely attack against this branch.',
        whyItMatters: 'This is where an opponent, judge, or teacher will apply pressure.',
        weakness: 'The draft needs a prepared answer.',
        fix: 'Answer with a qualifier, source, warrant, and impact comparison.',
      }),
    );
    edges.push(graphEdge(rebuttalId, claimId, 'attacks', 100 - claimStrength, 'Opponent pressure point.'));
  });

  const impactId = 'impact';
  nodes.push(
    graphNode({
      id: impactId,
      type: 'impact',
      label: trim(analysis.impactChain.at(-1) ?? 'Why the argument matters.', 120),
      strength: clamp((analysis.scores.rebuttal + analysis.scores.logic) / 2),
      role: 'Significance of the argument for the reader or judge.',
      whyItMatters: 'A proven claim still needs a reason to matter.',
      weakness: analysis.scores.rebuttal < 60 ? 'The impact is not weighed against likely objections.' : 'The impact is present, but can be made more comparative.',
      fix: 'Weigh magnitude, probability, timeframe, reversibility, and scope.',
    }),
  );
  edges.push(graphEdge('thesis', impactId, 'creates impact', analysis.scores.rebuttal, 'Impact depends on thesis surviving pressure.'));

  return { nodes, edges, unsupportedClaimIds };
}

export function detectCollapsePoint(analysis: FractureAnalysis, graph = buildInteractiveArgumentGraph(analysis)): CollapsePointReport {
  const directClaim = analysis.claims.find((claim) => claim.text === analysis.collapsePoint || analysis.collapsePoint.includes(claim.text.slice(0, 40)));
  const target = directClaim ?? analysis.unsupportedClaims[0] ?? analysis.claims[0];
  const sentence = target?.text || analysis.collapsePoint || analysis.thesis.text;
  const relatedEdges = target ? graph.edges.filter((edge) => edge.from.includes(target.id) || edge.to.includes(target.id)) : [];
  const dependsOn = relatedEdges.length
    ? relatedEdges.map((edge) => `${edge.from} -> ${edge.to}: ${edge.label}`)
    : ['The thesis and final impact depend on this point being believable.'];
  const vulnerability = target?.vulnerability || 'An opponent can ask what proof makes this point true.';

  return {
    sentence,
    dependsOn,
    opponentAttack: `Your argument depends heavily on this point. If an opponent disproves it, the rest of the case loses force. Attack they will use: ${vulnerability}`,
    reinforcePlan: [
      'Define the key term in this sentence so the opponent cannot shift its meaning.',
      'Attach the strongest direct evidence to this exact claim.',
      'Write the warrant as a because sentence instead of implying it.',
      'Add one qualifier so the claim survives counterexamples.',
    ],
    saferReplacement: `${qualify(sentence)} This matters because the evidence should show the mechanism, rule out the strongest alternative explanation, and connect the result back to the thesis.`,
  };
}

function sourceLinesFrom(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /https?:\/\/|doi|journal|report|study|publisher|\b(19|20)\d{2}\b|\|/i.test(line))
    .join('\n');
}

function sourceLabel(source: CitationSource | undefined): string {
  if (!source) {
    return 'No source attached';
  }
  return `${source.id}: ${source.title || source.url || source.doi || source.raw}`;
}

function sourceProblems(source: CitationSource | undefined, evidence: EvidenceEngineReport, claim: string): string[] {
  if (!source) {
    return ['claim has no source'];
  }
  const problems: string[] = [];
  const credibility = evidence.credibilityScores.find((item) => item.sourceId === source.id);
  const freshness = evidence.freshness.find((item) => item.sourceId === source.id);
  const hallucination = evidence.hallucinationRisks.find((item) => item.sourceId === source.id);
  const match = evidence.sourceClaimMatches.find((item) => item.sourceId === source.id && item.claim === claim);

  if (credibility && credibility.label === 'weak') {
    problems.push('weak source');
  }
  if (credibility && credibility.label === 'risky') {
    problems.push('risky or low-authority source');
  }
  if (freshness?.needsUpdate) {
    problems.push('outdated source');
  }
  if (hallucination && hallucination.level !== 'low') {
    problems.push(`possible citation hallucination: ${hallucination.missingFields.join(', ') || hallucination.suspiciousFields.join(', ') || 'metadata risk'}`);
  }
  if (match && match.score < 50) {
    problems.push('source mismatch');
  }
  if (source.missingFields?.length) {
    problems.push(`missing ${source.missingFields.join(', ')}`);
  }
  if (problems.length === 0) {
    problems.push('verify that the source directly supports the claim before final submission');
  }
  return problems;
}

export function verifySourcesToClaims(input: { draft: string; supplementalText?: string; analysis: FractureAnalysis }): SourceClaimVerificationReport {
  const sourceText = [sourceLinesFrom(input.draft), sourceLinesFrom(input.supplementalText ?? '')].filter(Boolean).join('\n');
  const sources = parseSourcesText(sourceText);
  const claims = input.analysis.claims.length ? input.analysis.claims.slice(0, 8).map((claim) => claim.text) : [input.analysis.thesis.text];
  const evidenceReport = buildEvidenceReport({ sources, claims, claimText: claims[0], freshnessSensitivity: 'standard' });
  const usedSources = new Set<string>();
  const items = claims.map((claimText, index) => {
    const claim = input.analysis.claims.find((item) => item.text === claimText);
    const matches = evidenceReport.sourceClaimMatches
      .filter((match) => match.claim === claimText)
      .sort((a, b) => b.score - a.score);
    const best = matches[0];
    const source = best ? sources.find((item) => item.id === best.sourceId) : undefined;
    if (source && best.score >= 35) {
      usedSources.add(source.id);
    }
    const problems = sourceProblems(source, evidenceReport, claimText);
    const supportStrength = best?.score ?? (claim?.evidence.length ? 35 : 0);
    const status: SourceClaimVerificationItem['status'] =
      !source ? 'unsupported' : supportStrength >= 70 && !problems.some((problem) => /hallucination|missing|mismatch|weak|risky|outdated/i.test(problem)) ? 'supported' : supportStrength >= 38 ? 'partial' : 'suspicious';

    return {
      claimId: claim?.id ?? `claim-${index + 1}`,
      claim: claimText,
      sourceId: source?.id,
      sourceLabel: sourceLabel(source),
      supportStrength,
      status,
      problems,
      fix:
        status === 'supported'
          ? 'Keep this source connected to the exact claim and cite it near the sentence it supports.'
          : 'Add a stronger source that directly names the claim terms, then explain why the source proves the claim.',
    };
  });
  const decorativeSources = sources
    .filter((source) => !usedSources.has(source.id))
    .map((source) => `${source.id}: listed but not strongly attached to a claim.`);

  return { sources, items, decorativeSources, evidenceReport };
}

function attackFor(type: WarRoomAttackType, analysis: FractureAnalysis, cardTarget: string): WarRoomAttack {
  const weakClaim = analysis.unsupportedClaims[0]?.text || analysis.collapsePoint || analysis.thesis.text;
  const target = cardTarget || weakClaim;
  const baseSeverity = analysis.scores.overall < 55 ? 82 : analysis.scores.rebuttal < 60 ? 72 : 58;

  if (type === 'logic attack') {
    return {
      type,
      target,
      opponentWillSay: `Your reasoning jumps from "${trim(target, 90)}" to the conclusion without proving the bridge.`,
      whyDangerous: 'It attacks the warrant, so even true evidence may stop mattering.',
      howToAnswer: 'State the mechanism in one because sentence, then connect it to the thesis.',
      crossfireQuestion: 'Which exact warrant connects your evidence to your conclusion?',
      evidenceThatShutsItDown: 'A mechanism study, comparative example, or step-by-step causal chain.',
      severity: baseSeverity,
    };
  }

  if (type === 'evidence attack') {
    return {
      type,
      target,
      opponentWillSay: 'Your source does not directly prove the claim, or the claim has no source at all.',
      whyDangerous: 'It turns the case into assertion and makes the judge distrust later impacts.',
      howToAnswer: 'Name the strongest source, date, author, and the exact fact it proves.',
      crossfireQuestion: 'What source proves this sentence specifically, not just the topic generally?',
      evidenceThatShutsItDown: 'A current source with named author, date, method, and direct claim overlap.',
      severity: clamp(baseSeverity + 8),
    };
  }

  if (type === 'moral attack') {
    return {
      type,
      target,
      opponentWillSay: 'Your case treats the impact as technical and does not justify why people should care.',
      whyDangerous: 'A morally clearer opponent can win audience trust even with less detail.',
      howToAnswer: 'Explain who is harmed, who benefits, and why the tradeoff is fair.',
      crossfireQuestion: 'Who pays the cost of your argument, and why is that burden justified?',
      evidenceThatShutsItDown: 'Human-impact evidence, stakeholder testimony, or a principled framework.',
      severity: clamp(baseSeverity - 4),
    };
  }

  if (type === 'practicality attack') {
    return {
      type,
      target,
      opponentWillSay: 'Even if the idea sounds good, the plan is too vague or hard to implement.',
      whyDangerous: 'It can concede the value of the goal while defeating the solution.',
      howToAnswer: 'Answer who acts, what changes, how enforcement works, and what happens if compliance fails.',
      crossfireQuestion: 'Who implements this, and what exactly changes tomorrow?',
      evidenceThatShutsItDown: 'Implementation evidence, cost comparison, pilot program, or enforcement model.',
      severity: clamp(baseSeverity + (/should|policy|ban|require|mandate/i.test(target) ? 10 : 0)),
    };
  }

  if (type === 'definition attack') {
    return {
      type,
      target,
      opponentWillSay: 'Your key terms are vague, too broad, or unfairly narrow.',
      whyDangerous: 'If definitions move, the whole argument can be forced into a different debate.',
      howToAnswer: 'Define the central term, explain the scope, and show why the definition is fair.',
      crossfireQuestion: 'What definition are you using, and what cases does it include or exclude?',
      evidenceThatShutsItDown: 'Dictionary, legal, academic, or topic-specific definition with scope explanation.',
      severity: clamp(baseSeverity - 2),
    };
  }

  return {
    type,
    target,
    opponentWillSay: 'The speech may be too dense, too fast, or unclear for the audience to flow.',
    whyDangerous: 'A judge cannot vote on an argument they cannot follow.',
    howToAnswer: 'Slow down at claims, pause before evidence, and signpost each weighing move.',
    crossfireQuestion: 'What is the one sentence the judge should write down from your speech?',
    evidenceThatShutsItDown: 'A cleaner delivery script with pause cues and one final voting issue.',
    severity: clamp(100 - analysis.scores.clarity + 40),
  };
}

export function buildRebuttalWarRoom(input: {
  draft: string;
  opponentText?: string;
  analysis: FractureAnalysis;
  persona?: OpponentPersona;
}): WarRoomAttack[] {
  const cards = buildRebuttalCards({
    opponentText: input.opponentText?.trim() || input.analysis.unsupportedClaims[0]?.text || input.analysis.thesis.text,
    userCase: input.draft,
    persona: input.persona ?? 'logical',
  });
  const cardTarget = cards[0]?.claim || input.analysis.collapsePoint;
  return attackTypes.map((type) => attackFor(type, input.analysis, cardTarget)).sort((a, b) => b.severity - a.severity);
}

export function buildSpeedDebateBrief(input: { draft: string; opponentText?: string; analysis: FractureAnalysis; persona?: OpponentPersona }): SpeedDebateBrief {
  const cards = buildRebuttalCards({
    opponentText: input.opponentText?.trim() || input.analysis.unsupportedClaims[0]?.text || input.analysis.thesis.text,
    userCase: input.draft,
    persona: input.persona ?? 'debate-champion',
  });
  const first = cards[0];
  const claim = first?.claim || input.analysis.collapsePoint;
  const response = first?.response || 'Answer with claim, warrant, evidence, and impact.';
  const crossfire = first?.crossfireQuestion || input.analysis.crossfireQuestions[0] || 'What evidence proves the claim?';

  return {
    tenSecondAnswer: `They are overclaiming ${trim(claim, 70)}. The answer is simple: ${trim(response, 120)}`,
    thirtySecondAnswer: `On their claim, first, they have not proven the warrant. Second, even if the claim is plausible, it does not outweigh without magnitude, probability, and timeframe. Our response is: ${response}`,
    twoMinuteRebuttal: [
      `Judge, collapse this response to the warrant behind "${trim(claim, 100)}."`,
      `Their argument only works if that warrant is true, but they have not protected it from counterexamples or alternate causes.`,
      `Our answer is ${response}`,
      'Even if they win some defense, they still need comparative impact. We outweigh because our side gives the judge a clearer mechanism, a lower risk of overclaiming, and a more direct path to the final impact.',
      'So the ballot should prefer the side with the better evidence-to-warrant bridge, not the side with the louder claim.',
    ].join(' '),
    crossfireQuestion: crossfire,
    weighingLine: 'We outweigh on probability and clarity because our argument has a clearer warrant and fewer unsupported assumptions.',
    riskWarning: first?.risk || 'Do not answer speed with more assertion. Give one warrant and one weighing line.',
  };
}

export function buildRevisionMissionDetails(analysis: FractureAnalysis): RevisionMissionDetail[] {
  const fallbackTarget = analysis.unsupportedClaims[0]?.text || analysis.collapsePoint || analysis.thesis.text;
  const rawMissions = analysis.missions.length ? analysis.missions : ['Prove the main claim.', 'Repair the weakest warrant.', 'Add a real counterargument.'];
  return rawMissions.slice(0, 5).map((mission, index) => {
    const claim = analysis.unsupportedClaims[index] || analysis.claims[index] || analysis.unsupportedClaims[0];
    const target = claim?.text || fallbackTarget;
    const evidenceMove = analysis.evidenceUpgrades[index] || 'Add one source, statistic, primary example, or concrete case that directly proves this claim.';
    return {
      title: `Mission ${index + 1}: ${mission.replace(/^Mission\s*\d+:\s*/i, '')}`,
      target,
      whyItMatters: claim?.vulnerability || 'This repair protects the sentence that carries the most pressure in the argument.',
      whatToChange: index === 1 ? 'Write the warrant explicitly as a because sentence.' : index === 2 ? 'Add a fair objection and answer it before the conclusion.' : evidenceMove,
      successLooksLike: 'A skeptical reader can point to the claim, source, warrant, and impact without guessing.',
      suggestedRewrite: `${qualify(target)} This is true because the draft should show the mechanism with direct evidence, then explain why the result matters more than the strongest objection.`,
    };
  });
}

function personaAdjustment(persona: JudgeBallotPersona, analysis: FractureAnalysis): number {
  if (persona === 'teacher') {
    return analysis.scores.clarity * 0.08 + analysis.scores.evidence * 0.04 - 7;
  }
  if (persona === 'professor') {
    return analysis.scores.logic * 0.08 + analysis.scores.originality * 0.06 - 8;
  }
  if (persona === 'debate judge') {
    return analysis.scores.rebuttal * 0.1 + analysis.scores.evidence * 0.06 - 9;
  }
  if (persona === 'lay judge') {
    return analysis.scores.clarity * 0.12 - 6;
  }
  if (persona === 'evidence-heavy judge') {
    return analysis.scores.evidence * 0.14 - 10;
  }
  return analysis.scores.logic * 0.1 + analysis.scores.rebuttal * 0.04 - 8;
}

export function simulateJudgeBallots(analysis: FractureAnalysis): JudgeBallotPrediction[] {
  return judgePersonas.map((persona) => {
    const predictedScore = clamp(analysis.scores.overall + personaAdjustment(persona, analysis));
    const weakest = analysis.unsupportedClaims[0]?.text || analysis.collapsePoint;
    const fix = analysis.missions[0] || 'Add direct evidence and a clearer warrant.';
    return {
      persona,
      predictedScore,
      ballot:
        predictedScore >= 75
          ? 'Likely favorable, but still expects the top vulnerability to be answered.'
          : predictedScore >= 55
            ? 'Competitive but vulnerable. The judge sees a case, not a finished proof.'
            : 'Likely unfavorable unless the draft repairs its proof and warrant chain.',
      whatTheyLike: predictedScore >= 65 ? `The judge will like the thesis direction and the clearest claim: ${trim(analysis.claims[0]?.text || analysis.thesis.text, 100)}` : 'The judge will like that there is at least a testable direction to repair.',
      whatTheyAttack: `They will attack: ${trim(weakest, 120)}`,
      whatCouldLose: analysis.scores.evidence < 55 ? 'Missing or mismatched evidence could lose the grade or round.' : 'A weak rebuttal or collapse point could decide against the draft.',
      fixFirst: fix,
    };
  });
}

export function analyzeSpeechDelivery(draft: string, analysis: FractureAnalysis): SpeechDeliveryReport {
  const sentences = splitSentences(draft);
  const wordCount = words(draft).length;
  const slowSeconds = Math.round((wordCount / 120) * 60);
  const averageSeconds = Math.round((wordCount / 150) * 60);
  const fastSeconds = Math.round((wordCount / 185) * 60);
  const paragraphs = splitParagraphs(draft);
  const denseSentences = sentences.filter((sentence) => words(sentence).length > 28).slice(0, 8);
  const pauseCues = sentences
    .filter((sentence) => includeAny(sentence, ['therefore', 'however', 'because', 'as a result', 'this matters', 'finally']))
    .slice(0, 8)
    .map((sentence) => `Pause before: ${trim(sentence, 100)}`);
  const emphasisCues = [analysis.thesis.text, ...analysis.claims.slice(0, 3).map((claim) => claim.text)].map((sentence) => `Emphasize: ${trim(sentence, 100)}`);
  const pacingBySection = paragraphs.length
    ? paragraphs.slice(0, 6).map((paragraph, index) => {
        const sectionWords = words(paragraph).length;
        return `Section ${index + 1}: ${sectionWords} words, about ${Math.round((sectionWords / 150) * 60)} seconds at normal pace.`;
      })
    : ['No sections detected yet. Paste a full speech to calculate section pacing.'];
  const opening = sentences[0] || '';
  const ending = sentences.at(-1) || '';
  const performanceScript = sentences
    .slice(0, 12)
    .map((sentence, index) => {
      const marker = index === 0 ? '[steady opening]' : includeAny(sentence, ['therefore', 'however', 'because']) ? '[pause]' : words(sentence).length > 28 ? '[slow down]' : '[continue]';
      return `${marker} ${sentence}`;
    })
    .join('\n');

  return {
    wordCount,
    slowSeconds,
    averageSeconds,
    fastSeconds,
    pacingBySection,
    denseSentences: denseSentences.map((sentence) => trim(sentence, 150)),
    pauseCues: pauseCues.length ? pauseCues : ['Add pause cues before thesis, evidence, and final weighing.'],
    emphasisCues,
    openingCheck: opening ? `Opening check: ${trim(opening, 120)}. Make sure it earns attention before the thesis.` : 'No opening sentence found.',
    endingCheck: ending ? `Ending check: ${trim(ending, 120)}. End with one final reason the argument matters.` : 'No ending sentence found.',
    performanceScript: performanceScript || 'No performance script yet. Paste a speech first.',
  };
}

function criterionTerms(criterion: string): string[] {
  return Array.from(new Set(words(criterion.toLowerCase()).filter((word) => word.length > 3 && !['with', 'that', 'this', 'from', 'your', 'will', 'have', 'must', 'should'].includes(word))));
}

export function checkRubricAlignment(input: { draft: string; rubricText?: string; analysis: FractureAnalysis }): RubricAlignmentReport {
  const lines = (input.rubricText ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 8)
    .slice(0, 12);

  if (lines.length === 0) {
    return {
      criteria: [],
      overallReadiness: 0,
      summary: 'Paste a rubric, ballot, or assignment sheet in the supplemental field to run rubric alignment.',
    };
  }

  const draftLower = input.draft.toLowerCase();
  const criteria = lines.map((criterion) => {
    const terms = criterionTerms(criterion);
    const hits = terms.filter((term) => draftLower.includes(term));
    const ratio = terms.length ? hits.length / terms.length : 0;
    const status: RubricStatus = ratio >= 0.55 ? 'satisfied' : ratio >= 0.25 ? 'partially satisfied' : 'missing';
    const pointRisk = status === 'satisfied' ? 12 : status === 'partially satisfied' ? 48 : 86;
    return {
      criterion,
      status,
      pointRisk,
      evidenceInDraft: hits.length ? `Draft mentions: ${hits.slice(0, 8).join(', ')}` : 'No clear matching language found.',
      revisionTask:
        status === 'satisfied'
          ? 'Keep this criterion visible and tie it to a claim.'
          : `Add one sentence that explicitly satisfies this criterion: ${trim(criterion, 100)}`,
    };
  });
  const overallReadiness = clamp(100 - criteria.reduce((sum, item) => sum + item.pointRisk, 0) / criteria.length);

  return {
    criteria,
    overallReadiness,
    summary:
      overallReadiness >= 75
        ? 'Rubric fit is strong, but make the matched criteria visible in the final draft.'
        : overallReadiness >= 50
          ? 'Rubric fit is partial. A few requirements are visible, but point risk remains.'
          : 'Rubric fit is weak. The draft needs explicit sentences that answer the assignment language.',
  };
}

function modelFinding(pass: FractureAnalysis['modelPasses'][number]): string {
  return `${pass.model} found: ${pass.diagnosis} Next move: ${pass.nextMove}`;
}

export function renderSourceClaimVerification(report: SourceClaimVerificationReport): string {
  const lines = report.items.map((item) =>
    [
      `${item.claimId}: ${item.status}, support ${item.supportStrength}/100`,
      `Claim: ${item.claim}`,
      `Source: ${item.sourceLabel}`,
      `Problems: ${item.problems.join('; ')}`,
      `Fix: ${item.fix}`,
    ].join('\n'),
  );
  const decorative = report.decorativeSources.length ? report.decorativeSources.join('\n') : 'No decorative sources detected from the supplied text.';
  return `Source-to-Claim Verification\n\n${lines.join('\n\n') || 'No claims found for source verification.'}\n\nDecorative citations\n${decorative}`;
}

export function renderWarRoom(attacks: WarRoomAttack[]): string {
  return `Rebuttal War Room\n\n${attacks
    .map(
      (attack, index) =>
        `${index + 1}. ${attack.type}, severity ${attack.severity}/100\nTarget: ${attack.target}\nOpponent will say: ${attack.opponentWillSay}\nWhy dangerous: ${attack.whyDangerous}\nHow to answer: ${attack.howToAnswer}\nCrossfire question: ${attack.crossfireQuestion}\nEvidence that shuts it down: ${attack.evidenceThatShutsItDown}`,
    )
    .join('\n\n')}`;
}

export function renderSpeedDebateBrief(brief: SpeedDebateBrief): string {
  return `Real Speed Mode Debate Assistant\n\n10-second answer\n${brief.tenSecondAnswer}\n\n30-second answer\n${brief.thirtySecondAnswer}\n\n2-minute rebuttal\n${brief.twoMinuteRebuttal}\n\nCrossfire question\n${brief.crossfireQuestion}\n\nWeighing line\n${brief.weighingLine}\n\nRisk warning\n${brief.riskWarning}`;
}

export function renderCollapsePoint(report: CollapsePointReport): string {
  return `Collapse Point Detector\n\nCollapse sentence\n${report.sentence}\n\nWhat depends on it\n${report.dependsOn.join('\n')}\n\nOpponent attack\n${report.opponentAttack}\n\nHow to reinforce it\n${report.reinforcePlan.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\nSafer replacement\n${report.saferReplacement}`;
}

export function renderRevisionMissions(missions: RevisionMissionDetail[]): string {
  return `Revision Mission System\n\n${missions
    .map(
      (mission) =>
        `${mission.title}\nTarget: ${mission.target}\nWhy it matters: ${mission.whyItMatters}\nWhat to change: ${mission.whatToChange}\nSuccess looks like: ${mission.successLooksLike}\nSuggested rewrite: ${mission.suggestedRewrite}`,
    )
    .join('\n\n')}`;
}

export function renderJudgeBallots(ballots: JudgeBallotPrediction[]): string {
  return `Judge Ballot Simulator\n\n${ballots
    .map(
      (ballot) =>
        `${ballot.persona}: ${ballot.predictedScore}/100\nBallot: ${ballot.ballot}\nWhat they like: ${ballot.whatTheyLike}\nWhat they attack: ${ballot.whatTheyAttack}\nWhat could lose: ${ballot.whatCouldLose}\nFix first: ${ballot.fixFirst}`,
    )
    .join('\n\n')}`;
}

export function renderSpeechDelivery(report: SpeechDeliveryReport): string {
  return `Speech Delivery Lab v2\n\nTiming\nWords: ${report.wordCount}\nSlow: ${report.slowSeconds} seconds\nAverage: ${report.averageSeconds} seconds\nFast: ${report.fastSeconds} seconds\n\nPacing by section\n${report.pacingBySection.join('\n')}\n\nDense sentences\n${report.denseSentences.join('\n') || 'No unusually dense sentence detected.'}\n\nPause cues\n${report.pauseCues.join('\n')}\n\nEmphasis cues\n${report.emphasisCues.join('\n')}\n\nOpening and ending\n${report.openingCheck}\n${report.endingCheck}\n\nPerformance script\n${report.performanceScript}`;
}

export function renderRubricAlignment(report: RubricAlignmentReport): string {
  return `Rubric Alignment Checker\n\nReadiness: ${report.overallReadiness}/100\n${report.summary}\n\n${report.criteria
    .map(
      (criterion, index) =>
        `${index + 1}. ${criterion.status}, point risk ${criterion.pointRisk}/100\nCriterion: ${criterion.criterion}\nEvidence in draft: ${criterion.evidenceInDraft}\nRevision task: ${criterion.revisionTask}`,
    )
    .join('\n\n') || 'No rubric criteria available yet.'}`;
}

export function renderInteractiveGraphText(graph: InteractiveArgumentGraph): string {
  const nodes = graph.nodes.map((node) => `${node.id}: ${node.type}, ${node.strength}/100. ${node.label}`);
  const edges = graph.edges.map((edge) => `${edge.from} -> ${edge.to}: ${edge.label}, ${edge.style}, ${edge.strength}/100. ${edge.issue}`);
  return `Interactive Argument Graph Engine\n\nNodes\n${nodes.join('\n')}\n\nLines\n${edges.join('\n')}`;
}

export function renderMethodReportV2(pack: Omit<AdvancedFeaturePack, 'methodReport'>): string {
  const score = pack.analysis.scores;
  const topWeaknesses = [
    ...pack.analysis.unsupportedClaims.slice(0, 3).map((claim) => `${claim.id}: ${claim.text}. Fix: ${claim.warrant}`),
    ...pack.sourceVerification.items.filter((item) => item.status !== 'supported').slice(0, 2).map((item) => `${item.claimId}: source problem. ${item.fix}`),
  ].slice(0, 6);
  const graphSummary = pack.graph.edges
    .filter((edge) => edge.style !== 'solid')
    .slice(0, 6)
    .map((edge) => `${edge.from} -> ${edge.to}: ${edge.issue}`);
  const sourceProblems = pack.sourceVerification.items
    .filter((item) => item.status !== 'supported')
    .slice(0, 5)
    .map((item) => `${item.claimId}: ${item.problems.join('; ')}`);

  return `Fracture Method Report v2\n\nVerdict\n${pack.analysis.verdict.label}. ${pack.analysis.verdict.reason}\n\nScore\nOverall ${score.overall}/100. Logic ${score.logic}. Evidence ${score.evidence}. Clarity ${score.clarity}. Originality ${score.originality}. Rebuttal ${score.rebuttal}.\n\nWhy it got that score\nThe score measures whether the argument survives pressure, not whether the prose sounds polished. The main pressure point is: ${pack.collapse.sentence}\n\nTop weaknesses\n${topWeaknesses.join('\n') || 'No major weakness detected yet.'}\n\nArgument graph\n${graphSummary.join('\n') || 'No broken graph lines detected. Check the visual graph for details.'}\n\nModel findings\n${pack.analysis.modelPasses.map(modelFinding).join('\n')}\n\nOpponent attacks\n${pack.warRoom.slice(0, 4).map((attack) => `${attack.type}: ${attack.opponentWillSay}`).join('\n')}\n\nSource problems\n${sourceProblems.join('\n') || 'No source problems detected from supplied source text.'}\n\nRevision missions\n${pack.missions.map((mission) => `${mission.title}: ${mission.whatToChange}`).join('\n')}`;
}

export function buildAdvancedFeaturePack(input: {
  draft: string;
  supplementalText?: string;
  analysis?: FractureAnalysis;
  judgeMode?: JudgeMode;
  persona?: OpponentPersona;
}): AdvancedFeaturePack {
  const analysis = input.analysis ?? analyzeArgument(input.draft, { judgeMode: input.judgeMode ?? 'debate', rubric: input.supplementalText });
  const graph = buildInteractiveArgumentGraph(analysis);
  const collapse = detectCollapsePoint(analysis, graph);
  const sourceVerification = verifySourcesToClaims({ draft: input.draft, supplementalText: input.supplementalText, analysis });
  const warRoom = buildRebuttalWarRoom({ draft: input.draft, opponentText: input.supplementalText, analysis, persona: input.persona });
  const speedBrief = buildSpeedDebateBrief({ draft: input.draft, opponentText: input.supplementalText, analysis, persona: input.persona });
  const missions = buildRevisionMissionDetails(analysis);
  const ballots = simulateJudgeBallots(analysis);
  const speechDelivery = analyzeSpeechDelivery(input.draft, analysis);
  const rubric = checkRubricAlignment({ draft: input.draft, rubricText: input.supplementalText, analysis });
  const partial = { analysis, graph, collapse, sourceVerification, warRoom, speedBrief, missions, ballots, speechDelivery, rubric };
  return { ...partial, methodReport: renderMethodReportV2(partial) };
}

export function loadVersionHistory(): VersionHistoryEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(VERSION_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as VersionHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVersionHistoryEntry(input: { draft: string; pack: AdvancedFeaturePack; title?: string }): VersionHistoryEntry[] {
  const current = loadVersionHistory();
  const previousBest = Math.max(0, ...current.map((entry) => entry.score));
  const remainingWeaknesses = input.pack.missions.slice(0, 5).map((mission) => mission.target);
  const prior = current[0];
  const fixedWeaknesses = prior
    ? prior.remainingWeaknesses.filter((weakness) => !remainingWeaknesses.some((remaining) => remaining.slice(0, 60) === weakness.slice(0, 60))).slice(0, 5)
    : [];
  const entry: VersionHistoryEntry = {
    id: `version-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    title: input.title || `Version ${current.length + 1}`,
    score: input.pack.analysis.scores.overall,
    verdict: input.pack.analysis.verdict.label,
    wordCount: input.pack.analysis.wordCount,
    fixedWeaknesses,
    remainingWeaknesses,
    strongestRevision: input.pack.analysis.scores.overall >= previousBest,
    draft: input.draft,
    report: input.pack.methodReport,
  };
  const next = [entry, ...current].slice(0, 20);
  try {
    globalThis.localStorage?.setItem(VERSION_HISTORY_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function renderVersionHistory(history: VersionHistoryEntry[]): string {
  if (history.length === 0) {
    return 'Version History and Score Tracking\n\nNo saved versions yet. Run Fracture, then save a version.';
  }
  const best = history.reduce((winner, entry) => (entry.score > winner.score ? entry : winner), history[0]);
  return `Version History and Score Tracking\n\nStrongest revision\n${best.title}: ${best.score}/100, ${best.verdict}\n\nHistory\n${history
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.title}, ${entry.score}/100, ${entry.verdict}, ${entry.wordCount} words\nFixed weaknesses: ${entry.fixedWeaknesses.join('; ') || 'No prior weakness fix detected yet.'}\nRemaining weaknesses: ${entry.remainingWeaknesses.slice(0, 3).join('; ') || 'No remaining weakness recorded.'}`,
    )
    .join('\n\n')}`;
}
