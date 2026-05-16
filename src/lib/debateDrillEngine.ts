import { analyzeArgument, type ClaimFinding, type FractureAnalysis } from './fractureEngine';
import { buildRebuttalCards, type OpponentPersona, type RebuttalCard } from './rebuttalEngine';

export type DrillSegmentKind = 'prep' | 'speak' | 'reflect';

export type TimedRebuttalDrillSegment = {
  kind: DrillSegmentKind;
  label: string;
  startsAtSecond: number;
  endsAtSecond: number;
  prompt: string;
};

export type TimedRebuttalDrillRound = {
  id: string;
  card: RebuttalCard;
  focus: string;
  goal: string;
  coachCue: string;
  successCriteria: string[];
  segments: TimedRebuttalDrillSegment[];
  totalSeconds: number;
};

export type TimedRebuttalDrillSession = {
  id: string;
  persona: OpponentPersona;
  totalSeconds: number;
  warmup: string[];
  rounds: TimedRebuttalDrillRound[];
  cooldown: string[];
  timeline: Array<TimedRebuttalDrillSegment & { roundId: string }>;
};

export type TimedRebuttalDrillInput = {
  opponentText: string;
  userCase: string;
  persona?: OpponentPersona;
  maxRounds?: number;
  totalSeconds?: number;
  prepSeconds?: number;
  responseSeconds?: number;
  reflectionSeconds?: number;
};

export type PersonaIntensity = 'calm' | 'balanced' | 'pressing';

export type GeneratedOpponentPersona = {
  id: string;
  persona: OpponentPersona;
  label: string;
  intensity: PersonaIntensity;
  summary: string;
  traits: string[];
  debatePriorities: string[];
  likelyPresses: string[];
  openingChallenge: string;
  mimicryGuardrails: string[];
};

export type PersonaGenerationInput = {
  userCase?: string;
  opponentText?: string;
  analysis?: FractureAnalysis;
  persona?: OpponentPersona;
  intensity?: PersonaIntensity;
  requestedInspiration?: string;
  seed?: string;
};

export type SpeechRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SpeechRiskCategory = 'time' | 'evidence' | 'warrant' | 'overclaim' | 'impact' | 'tone' | 'coverage' | 'clarity';

export type SpeechRiskSignal = {
  category: SpeechRiskCategory;
  score: number;
  level: SpeechRiskLevel;
  finding: string;
  coachingMove: string;
};

export type SpeechRiskReport = {
  overallRisk: number;
  level: SpeechRiskLevel;
  estimatedSeconds: number;
  targetSeconds?: number;
  wordsPerMinute: number;
  signals: SpeechRiskSignal[];
  safestNextMove: string;
  rehearsalFocus: string[];
};

export type SpeechRiskInput = {
  speechText: string;
  analysis?: FractureAnalysis;
  rebuttalCards?: RebuttalCard[];
  targetSeconds?: number;
  wordsPerMinute?: number;
};

export type ImpactFactorName = 'magnitude' | 'probability' | 'timeframe' | 'reversibility';

export type ImpactFactorValue = number | string | undefined;

export type ImpactWeighingInput = {
  label: string;
  side?: string;
  description?: string;
  magnitude?: ImpactFactorValue;
  probability?: ImpactFactorValue;
  timeframe?: ImpactFactorValue;
  reversibility?: ImpactFactorValue;
  evidence?: string;
};

export type ImpactFactorScore = {
  factor: ImpactFactorName;
  score: number;
  label: string;
  rationale: string;
};

export type ImpactWeighingResult = {
  label: string;
  side?: string;
  score: number;
  factors: ImpactFactorScore[];
  rankHint: string;
  weighingSentence: string;
  vulnerability: string;
};

export type ImpactComparison = {
  winner?: string;
  margin: number;
  summary: string;
  ordered: ImpactWeighingResult[];
};

export type CrossfireFollowUp = {
  question: string;
  purpose: string;
  ifAnswered: string;
  ifEvaded: string;
};

export type CrossfireFollowUpChain = {
  id: string;
  targetClaim: string;
  rootQuestion: string;
  followUps: CrossfireFollowUp[];
  closingPin: string;
};

export type CrossfireFollowUpInput = {
  topicText?: string;
  analysis?: FractureAnalysis;
  rebuttalCards?: RebuttalCard[];
  depth?: number;
  maxChains?: number;
};

export type JudgeBallotIssue = {
  label: string;
  winner: string;
  weight: number;
  reason: string;
};

export type JudgeBallotSummary = {
  winner: string;
  speakerPoints: number;
  reasonForDecision: string;
  votingIssues: JudgeBallotIssue[];
  droppedArguments: string[];
  riskNotes: string[];
  comparativeWeighing: string;
  nextRoundAdvice: string[];
};

export type JudgeBallotInput = {
  sideLabel?: string;
  opponentLabel?: string;
  userCase?: string;
  opponentText?: string;
  analysis?: FractureAnalysis;
  opponentAnalysis?: FractureAnalysis;
  impacts?: ImpactWeighingInput[];
  riskReport?: SpeechRiskReport;
};

export type SpeakerRole = 'constructive' | 'rebuttal' | 'summary' | 'final-focus';

export type SpeakerFlowSectionKind =
  | 'opening'
  | 'thesis'
  | 'contention'
  | 'rebuttal'
  | 'weighing'
  | 'crystallization'
  | 'crossfire-prep';

export type SpeakerFlowSection = {
  id: string;
  kind: SpeakerFlowSectionKind;
  title: string;
  targetSeconds: number;
  bullets: string[];
  flowTags: string[];
  transitionLine: string;
};

export type SpeakerFlowOutline = {
  totalSeconds: number;
  role: SpeakerRole;
  thesis: string;
  sections: SpeakerFlowSection[];
  deliveryNotes: string[];
  flowLine: string[];
};

export type SpeakerFlowInput = {
  caseText?: string;
  analysis?: FractureAnalysis;
  rebuttalCards?: RebuttalCard[];
  impacts?: ImpactWeighingInput[];
  totalSeconds?: number;
  role?: SpeakerRole;
  includeCrossfirePrep?: boolean;
};

const personaBlueprints: Record<
  OpponentPersona,
  {
    label: string;
    summary: string;
    traits: string[];
    priorities: string[];
    presses: string[];
  }
> = {
  logical: {
    label: 'Warrant Technician',
    summary: 'Tests whether each claim has a clean evidence-to-warrant bridge.',
    traits: ['methodical', 'calm', 'definition-focused'],
    priorities: ['claim precision', 'logical consistency', 'burden of proof'],
    presses: ['Which warrant connects your evidence to the claim?', 'What definition are you relying on?', 'Does your conclusion follow from your premise?'],
  },
  aggressive: {
    label: 'Pressure Cross-Examiner',
    summary: 'Pushes for concessions, overclaims, and missing standards.',
    traits: ['direct', 'fast', 'concession-seeking'],
    priorities: ['absolute wording', 'yes-or-no pressure', 'collapse points'],
    presses: ['Is that always true?', 'What part of your case are you willing to concede?', 'Why should the judge trust that standard?'],
  },
  emotional: {
    label: 'Human Impact Framer',
    summary: 'Centers affected people and asks whether the case feels detached from lived stakes.',
    traits: ['empathetic', 'story-driven', 'audience-aware'],
    priorities: ['human stakes', 'moral framing', 'concrete examples'],
    presses: ['Who is most affected?', 'What does this look like for one person?', 'Why should the judge care beyond the statistic?'],
  },
  'evidence-heavy': {
    label: 'Source Auditor',
    summary: 'Checks source quality, recency, representativeness, and comparative proof.',
    traits: ['detail-oriented', 'skeptical', 'source-forward'],
    priorities: ['source quality', 'comparative evidence', 'sample fit'],
    presses: ['How recent is that source?', 'Is the evidence representative?', 'What comparison proves your side is stronger?'],
  },
  skeptical: {
    label: 'Alternative-Cause Tester',
    summary: 'Treats claims as plausible until alternatives are ruled out.',
    traits: ['careful', 'probability-focused', 'counterexample-minded'],
    priorities: ['alternate causes', 'qualification', 'probability'],
    presses: ['What else could explain the same fact?', 'How likely is your impact?', 'What would make your claim false?'],
  },
  'debate-champion': {
    label: 'Impact Weigher',
    summary: 'Collapses the round to magnitude, probability, timeframe, and reversibility.',
    traits: ['strategic', 'comparative', 'ballot-focused'],
    priorities: ['voting issues', 'impact calculus', 'dropped arguments'],
    presses: ['Why does your impact outweigh?', 'What should the judge write as the voting issue?', 'Which argument decides the round?'],
  },
};

const impactTerms = ['magnitude', 'probability', 'timeframe', 'reversibility', 'outweigh', 'impact', 'harm', 'benefit', 'risk', 'irreversible'];
const overclaimTerms = ['always', 'never', 'everyone', 'no one', 'guarantee', 'impossible', 'inevitable', 'obviously', 'undeniable'];
const hostileToneTerms = ['stupid', 'ridiculous', 'absurd', 'lying', 'liar', 'ignorant', 'nonsense'];
const evidenceTerms = ['study', 'research', 'data', 'report', 'survey', 'source', 'according', 'evidence', 'statistic', '%', 'doi', 'court'];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function riskLevel(score: number): SpeechRiskLevel {
  if (score >= 76) {
    return 'critical';
  }
  if (score >= 56) {
    return 'high';
  }
  if (score >= 31) {
    return 'medium';
  }
  return 'low';
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function words(text: string): string[] {
  return text.match(/[A-Za-z0-9']+/g) ?? [];
}

function trimText(text: string, max = 170): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trim()}...`;
}

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return count + (lower.match(new RegExp(`\\b${escaped}\\b`, 'g'))?.length ?? 0);
  }, 0);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicId(prefix: string, value: string): string {
  return `${prefix}-${hashString(value).toString(36)}`;
}

function fallbackCard(userCase: string): RebuttalCard {
  const analysis = analyzeArgument(userCase, { judgeMode: 'debate' });
  const claim = analysis.unsupportedClaims[0]?.text || analysis.thesis.text || 'State the opposing claim before answering it.';
  return {
    claim,
    opponentMove: `They will ask why "${trimText(claim, 90)}" is proven instead of merely asserted.`,
    response: 'Answer with a clear claim, one piece of evidence, the warrant, and one comparative impact.',
    crossfireQuestion: 'What evidence would prove this claim under the judge standard?',
    risk: 'Medium: the answer needs evidence and weighing before it is round-ready.',
  };
}

function focusForCard(card: RebuttalCard): string {
  const claim = card.claim.toLowerCase();
  if (/always|never|everyone|no one|guarantee|inevitable/.test(claim)) {
    return 'Qualify the overclaim before defending the core point.';
  }
  if (/cause|caused|lead|result|because|therefore/.test(claim)) {
    return 'Separate correlation, mechanism, and alternate causes.';
  }
  if (/should|must|policy|ban|require|mandate/.test(claim)) {
    return 'Answer need, solvency, enforcement, and net benefit.';
  }
  return 'Answer the warrant and weigh why the response matters.';
}

function buildRoundSegments(input: {
  card: RebuttalCard;
  prepSeconds: number;
  responseSeconds: number;
  reflectionSeconds: number;
  start: number;
}): TimedRebuttalDrillSegment[] {
  const prepEnd = input.start + input.prepSeconds;
  const speakEnd = prepEnd + input.responseSeconds;
  const reflectEnd = speakEnd + input.reflectionSeconds;
  return [
    {
      kind: 'prep',
      label: 'Prep',
      startsAtSecond: input.start,
      endsAtSecond: prepEnd,
      prompt: `Write the one-sentence answer to: ${input.card.opponentMove}`,
    },
    {
      kind: 'speak',
      label: 'Speak',
      startsAtSecond: prepEnd,
      endsAtSecond: speakEnd,
      prompt: `Deliver the rebuttal: ${input.card.response}`,
    },
    {
      kind: 'reflect',
      label: 'Reflect',
      startsAtSecond: speakEnd,
      endsAtSecond: reflectEnd,
      prompt: `Check whether you answered this crossfire pressure: ${input.card.crossfireQuestion}`,
    },
  ];
}

function allocateRoundSeconds(input: TimedRebuttalDrillInput, roundCount: number): { prep: number; response: number; reflection: number; total: number } {
  const basePrep = clamp(input.prepSeconds ?? 20, 5, 180);
  const baseResponse = clamp(input.responseSeconds ?? 50, 10, 300);
  const baseReflection = clamp(input.reflectionSeconds ?? 15, 5, 120);
  const baseTotal = basePrep + baseResponse + baseReflection;
  const requestedTotal = input.totalSeconds ? clamp(input.totalSeconds, roundCount * 20, 3600) : baseTotal * roundCount;
  const perRound = Math.max(20, Math.floor(requestedTotal / roundCount));
  const scale = perRound / baseTotal;
  const prep = Math.max(5, Math.round(basePrep * scale));
  const response = Math.max(10, Math.round(baseResponse * scale));
  const reflection = Math.max(5, perRound - prep - response);
  return { prep, response, reflection, total: prep + response + reflection };
}

export function createTimedRebuttalDrillSession(input: TimedRebuttalDrillInput): TimedRebuttalDrillSession {
  const persona = input.persona ?? 'logical';
  const rawCards = buildRebuttalCards({ opponentText: input.opponentText, userCase: input.userCase, persona });
  const cards = rawCards.length > 0 ? rawCards : [fallbackCard(input.userCase)];
  const desiredRounds = clamp(input.maxRounds ?? 4, 1, 8);
  const roundCountByTime = input.totalSeconds ? Math.max(1, Math.floor(clamp(input.totalSeconds, 20, 3600) / 20)) : desiredRounds;
  const roundCount = Math.min(cards.length, desiredRounds, roundCountByTime);
  const roundSeconds = allocateRoundSeconds(input, roundCount);
  let cursor = 0;
  const rounds = cards.slice(0, roundCount).map((card, index) => {
    const roundId = `round-${index + 1}`;
    const segments = buildRoundSegments({
      card,
      prepSeconds: roundSeconds.prep,
      responseSeconds: roundSeconds.response,
      reflectionSeconds: roundSeconds.reflection,
      start: cursor,
    });
    cursor += roundSeconds.total;
    return {
      id: roundId,
      card,
      focus: focusForCard(card),
      goal: `Win the answer to "${trimText(card.claim, 90)}" without making a new unsupported claim.`,
      coachCue: 'Claim, because, evidence, therefore, weigh.',
      successCriteria: [
        'Names the opponent claim before answering it.',
        'Uses at least one warrant instead of pure assertion.',
        'Ends with magnitude, probability, timeframe, or reversibility.',
      ],
      segments,
      totalSeconds: roundSeconds.total,
    };
  });

  const timeline = rounds.flatMap((round) => round.segments.map((segment) => ({ ...segment, roundId: round.id })));
  const seed = `${input.userCase}|${input.opponentText}|${persona}|${rounds.length}|${cursor}`;

  return {
    id: deterministicId('drill', seed),
    persona,
    totalSeconds: cursor,
    warmup: [
      'Say the thesis once in plain language.',
      'Name the opponent standard before contesting it.',
      'Pick the one impact you want the judge to remember.',
    ],
    rounds,
    cooldown: [
      'Mark the answer that sounded most evidence-based.',
      'Rewrite one overclaim with a qualifier.',
      'Save one weighing sentence for the next speech.',
    ],
    timeline,
  };
}

function choosePersona(input: PersonaGenerationInput, analysis: FractureAnalysis): OpponentPersona {
  if (input.persona) {
    return input.persona;
  }
  if (analysis.scores.evidence < 55) {
    return 'evidence-heavy';
  }
  if (analysis.scores.rebuttal < 55) {
    return 'debate-champion';
  }
  if (analysis.unsupportedClaims.some((claim) => /cause|because|lead|result/i.test(claim.text))) {
    return 'skeptical';
  }
  const personas: OpponentPersona[] = ['logical', 'aggressive', 'emotional', 'evidence-heavy', 'skeptical', 'debate-champion'];
  const seed = `${input.seed ?? ''}|${input.userCase ?? ''}|${input.opponentText ?? ''}|${input.requestedInspiration ?? ''}`;
  return personas[hashString(seed) % personas.length];
}

function intensityWord(intensity: PersonaIntensity): string {
  if (intensity === 'calm') {
    return 'controlled';
  }
  if (intensity === 'pressing') {
    return 'high-pressure';
  }
  return 'balanced';
}

export function generateOpponentPersona(input: PersonaGenerationInput = {}): GeneratedOpponentPersona {
  const analysis = input.analysis ?? analyzeArgument(input.opponentText || input.userCase || '', { judgeMode: 'debate' });
  const persona = choosePersona(input, analysis);
  const blueprint = personaBlueprints[persona];
  const intensity = input.intensity ?? (analysis.scores.overall >= 70 ? 'pressing' : analysis.scores.overall <= 45 ? 'calm' : 'balanced');
  const weakClaim = analysis.unsupportedClaims[0]?.text || analysis.collapsePoint || analysis.thesis.text;
  const seed = `${persona}|${intensity}|${weakClaim}|${input.seed ?? ''}`;

  return {
    id: deterministicId('persona', seed),
    persona,
    label: `${intensityWord(intensity)} ${blueprint.label}`,
    intensity,
    summary: blueprint.summary,
    traits: [...blueprint.traits],
    debatePriorities: [...blueprint.priorities],
    likelyPresses: [...blueprint.presses],
    openingChallenge: `${blueprint.presses[0]} Start with "${trimText(weakClaim, 100)}."`,
    mimicryGuardrails: [
      'Archetype only; does not imitate a named real person.',
      'Uses debate behaviors, not biography, voice, catchphrases, or identity traits.',
      input.requestedInspiration
        ? 'Requested inspiration was treated as a generic style request and not copied.'
        : 'No real-person inspiration was used.',
    ],
  };
}

function scoreTimeRisk(estimatedSeconds: number, targetSeconds?: number): SpeechRiskSignal {
  if (!targetSeconds) {
    return {
      category: 'time',
      score: 18,
      level: 'low',
      finding: `Estimated speech time is ${estimatedSeconds} seconds without a target cap.`,
      coachingMove: 'Set a target time before the final rehearsal.',
    };
  }
  const ratio = estimatedSeconds / Math.max(1, targetSeconds);
  const score = ratio > 1 ? clamp((ratio - 1) * 120 + 30) : ratio < 0.55 ? clamp((0.55 - ratio) * 90 + 25) : 12;
  const finding =
    ratio > 1
      ? `Estimated ${estimatedSeconds}s exceeds the ${targetSeconds}s target.`
      : ratio < 0.55
        ? `Estimated ${estimatedSeconds}s may be too thin for the ${targetSeconds}s target.`
        : `Estimated ${estimatedSeconds}s fits the ${targetSeconds}s target.`;
  return {
    category: 'time',
    score,
    level: riskLevel(score),
    finding,
    coachingMove: ratio > 1 ? 'Cut one example or collapse two warrants into one sentence.' : 'Add one warranted example or weighing sentence.',
  };
}

function buildRiskSignal(category: SpeechRiskCategory, score: number, finding: string, coachingMove: string): SpeechRiskSignal {
  const safeScore = clamp(score);
  return {
    category,
    score: safeScore,
    level: riskLevel(safeScore),
    finding,
    coachingMove,
  };
}

export function assessSpeechRisk(input: SpeechRiskInput): SpeechRiskReport {
  const speechText = input.speechText.trim();
  const analysis = input.analysis ?? analyzeArgument(speechText, { judgeMode: 'debate' });
  const wordCount = words(speechText).length;
  const wordsPerMinute = clamp(input.wordsPerMinute ?? 150, 80, 220);
  const estimatedSeconds = Math.max(1, Math.round((wordCount / wordsPerMinute) * 60));
  const sentences = splitSentences(speechText);
  const averageSentenceLength = wordCount / Math.max(1, sentences.length);
  const unsupportedRatio = analysis.claims.length > 0 ? analysis.unsupportedClaims.length / analysis.claims.length : speechText ? 0.5 : 1;
  const overclaims = countMatches(speechText, overclaimTerms);
  const evidenceMentions = /\d/.test(speechText) ? countMatches(speechText, evidenceTerms) + 1 : countMatches(speechText, evidenceTerms);
  const impactMentions = countMatches(speechText, impactTerms);
  const hostileMentions = countMatches(speechText, hostileToneTerms) + (speechText.match(/!/g)?.length ?? 0);
  const rebuttalPressure = input.rebuttalCards?.length ? Math.max(0, input.rebuttalCards.length - analysis.scores.rebuttal / 25) : 0;

  const signals: SpeechRiskSignal[] = [
    scoreTimeRisk(estimatedSeconds, input.targetSeconds),
    buildRiskSignal(
      'evidence',
      100 - analysis.scores.evidence + (evidenceMentions === 0 ? 18 : -8),
      evidenceMentions === 0 ? 'Speech has no clear evidence marker.' : `Speech includes ${evidenceMentions} evidence marker(s).`,
      'Attach the strongest source to the claim that decides the ballot.',
    ),
    buildRiskSignal(
      'warrant',
      unsupportedRatio * 85 + analysis.unsupportedClaims.length * 3,
      analysis.unsupportedClaims[0]
        ? `Most exposed claim: "${trimText(analysis.unsupportedClaims[0].text, 100)}."`
        : 'Claims have visible warrant support.',
      'Say the reasoning bridge after the evidence, not only the evidence itself.',
    ),
    buildRiskSignal(
      'overclaim',
      overclaims * 22,
      overclaims > 0 ? `${overclaims} absolute or overconfident phrase(s) detected.` : 'No major absolute wording detected.',
      'Swap absolutes for qualified language you can defend under crossfire.',
    ),
    buildRiskSignal(
      'impact',
      impactMentions === 0 ? 68 : Math.max(8, 45 - impactMentions * 9),
      impactMentions === 0 ? 'Speech does not explicitly weigh impact calculus.' : `Speech uses ${impactMentions} impact-weighing marker(s).`,
      'End the response with magnitude, probability, timeframe, or reversibility.',
    ),
    buildRiskSignal(
      'tone',
      hostileMentions * 18,
      hostileMentions > 0 ? `${hostileMentions} tone-risk marker(s) detected.` : 'Tone is unlikely to distract the judge.',
      'Replace attacks on the opponent with attacks on warrants, evidence, or weighing.',
    ),
    buildRiskSignal(
      'coverage',
      Math.max(0, 100 - analysis.scores.rebuttal + rebuttalPressure * 12),
      input.rebuttalCards?.length
        ? `${input.rebuttalCards.length} rebuttal card(s) are available; coverage score is ${analysis.scores.rebuttal}.`
        : `Rebuttal readiness score is ${analysis.scores.rebuttal}.`,
      'Answer the strongest opponent move before adding a new offensive point.',
    ),
    buildRiskSignal(
      'clarity',
      100 - analysis.scores.clarity + Math.max(0, averageSentenceLength - 24) * 3,
      averageSentenceLength > 24 ? `Average sentence length is ${Math.round(averageSentenceLength)} words.` : 'Sentence length is controlled.',
      'Break long sentences into claim, evidence, warrant, and weighing.',
    ),
  ].sort((a, b) => b.score - a.score);

  const overallRisk = clamp(
    signals.reduce((sum, signal) => {
      const weight = signal.category === 'evidence' || signal.category === 'warrant' || signal.category === 'impact' ? 1.2 : 1;
      return sum + signal.score * weight;
    }, 0) / signals.reduce((sum, signal) => sum + (signal.category === 'evidence' || signal.category === 'warrant' || signal.category === 'impact' ? 1.2 : 1), 0),
  );

  return {
    overallRisk,
    level: riskLevel(overallRisk),
    estimatedSeconds,
    targetSeconds: input.targetSeconds,
    wordsPerMinute,
    signals,
    safestNextMove: signals[0]?.coachingMove || 'Run one more timed repetition.',
    rehearsalFocus: signals.slice(0, 3).map((signal) => `${signal.category}: ${signal.coachingMove}`),
  };
}

function normalizeNumericImpact(value: number): number {
  if (value <= 1) {
    return clamp(value * 100);
  }
  if (value <= 5) {
    return clamp(value * 20);
  }
  return clamp(value);
}

function normalizeImpactValue(factor: ImpactFactorName, value: ImpactFactorValue): ImpactFactorScore {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const score = normalizeNumericImpact(value);
    return {
      factor,
      score,
      label: `${score}/100`,
      rationale: `Numeric ${factor} score supplied by caller.`,
    };
  }

  const text = String(value ?? '').toLowerCase();
  const maps: Record<ImpactFactorName, Array<{ match: RegExp; score: number; label: string; rationale: string }>> = {
    magnitude: [
      { match: /catastrophic|existential|severe|massive/, score: 96, label: 'severe', rationale: 'Large scale harm or benefit.' },
      { match: /high|major|large|substantial/, score: 82, label: 'high', rationale: 'Meaningful scale that can anchor the ballot.' },
      { match: /medium|moderate|noticeable/, score: 58, label: 'medium', rationale: 'Real but not round-collapsing magnitude.' },
      { match: /low|minor|small|minimal/, score: 28, label: 'low', rationale: 'Small magnitude needs strong probability to matter.' },
    ],
    probability: [
      { match: /certain|guaranteed|proven/, score: 95, label: 'certain', rationale: 'The impact is framed as very likely.' },
      { match: /likely|probable|high/, score: 80, label: 'likely', rationale: 'The impact has a credible path to happening.' },
      { match: /possible|medium|plausible/, score: 56, label: 'possible', rationale: 'The impact is plausible but contestable.' },
      { match: /unlikely|speculative|low|remote/, score: 25, label: 'speculative', rationale: 'The impact needs more proof of likelihood.' },
    ],
    timeframe: [
      { match: /immediate|now|today|short/, score: 92, label: 'immediate', rationale: 'Fast timeframe increases urgency.' },
      { match: /soon|near|months?/, score: 76, label: 'near-term', rationale: 'Near-term impact is easy for judges to credit.' },
      { match: /medium|years?/, score: 55, label: 'medium-term', rationale: 'Timeframe is meaningful but less urgent.' },
      { match: /long|eventual|delayed|future/, score: 36, label: 'delayed', rationale: 'Delayed impact needs stronger probability.' },
    ],
    reversibility: [
      { match: /irreversible|permanent|cannot|can't|hard to reverse/, score: 94, label: 'irreversible', rationale: 'Hard-to-reverse impacts carry extra ballot weight.' },
      { match: /difficult|costly|slow/, score: 74, label: 'hard to reverse', rationale: 'The impact can be repaired only with serious cost.' },
      { match: /reversible|temporary|repairable|fixable/, score: 32, label: 'reversible', rationale: 'Reversible impacts need magnitude or probability to outweigh.' },
      { match: /easy|brief|minor/, score: 20, label: 'easily reversible', rationale: 'Easy reversal lowers the comparative weight.' },
    ],
  };
  const match = maps[factor].find((candidate) => candidate.match.test(text));
  if (match) {
    return { factor, score: match.score, label: match.label, rationale: match.rationale };
  }
  return {
    factor,
    score: 50,
    label: 'unrated',
    rationale: `No clear ${factor} signal supplied; defaulting to a neutral score.`,
  };
}

export function weighImpact(input: ImpactWeighingInput): ImpactWeighingResult {
  const factors: ImpactFactorScore[] = [
    normalizeImpactValue('magnitude', input.magnitude),
    normalizeImpactValue('probability', input.probability),
    normalizeImpactValue('timeframe', input.timeframe),
    normalizeImpactValue('reversibility', input.reversibility),
  ];
  const byFactor = Object.fromEntries(factors.map((factor) => [factor.factor, factor.score])) as Record<ImpactFactorName, number>;
  const score = clamp(byFactor.magnitude * 0.34 + byFactor.probability * 0.3 + byFactor.timeframe * 0.18 + byFactor.reversibility * 0.18);
  const strongest = factors.reduce((best, factor) => (factor.score > best.score ? factor : best), factors[0]);
  const weakest = factors.reduce((worst, factor) => (factor.score < worst.score ? factor : worst), factors[0]);
  const rankHint = score >= 78 ? 'strong voting issue' : score >= 58 ? 'viable but contestable' : 'needs more weighing before it decides the ballot';
  const sidePrefix = input.side ? `${input.side} impact` : 'This impact';
  const evidenceClause = input.evidence ? ` backed by ${trimText(input.evidence, 70)}` : '';

  return {
    label: input.label,
    side: input.side,
    score,
    factors,
    rankHint,
    weighingSentence: `${sidePrefix} "${input.label}" weighs at ${score}/100 because its strongest factor is ${strongest.factor} (${strongest.label})${evidenceClause}.`,
    vulnerability: `Opponent should press ${weakest.factor}: ${weakest.rationale}`,
  };
}

export function compareImpactWeighing(impacts: ImpactWeighingResult[]): ImpactComparison {
  const ordered = [...impacts].sort((a, b) => b.score - a.score);
  const best = ordered[0];
  const second = ordered[1];
  const margin = best && second ? best.score - second.score : best?.score ?? 0;
  const winner = best?.side || best?.label;
  const strongestFactor = best ? [...best.factors].sort((a, b) => b.score - a.score)[0].factor : undefined;
  const summary =
    best && second
      ? `${best.label} leads ${second.label} by ${margin} point(s), mostly on ${strongestFactor}.`
      : best
        ? `${best.label} is the only weighed impact, so comparison is incomplete.`
        : 'No impacts supplied for comparison.';
  return { winner, margin, summary, ordered };
}

function claimFromCard(card: RebuttalCard): ClaimFinding {
  return {
    id: deterministicId('claim', card.claim),
    text: card.claim,
    paragraph: 1,
    certainty: 'possible',
    evidence: [],
    warrant: card.response,
    vulnerability: card.risk,
  };
}

function questionForClaim(claim: ClaimFinding, fallback?: string): string {
  if (fallback) {
    return fallback;
  }
  if (/cause|caused|lead|result|because/i.test(claim.text)) {
    return 'What evidence proves causation rather than correlation or sequence?';
  }
  if (/always|never|everyone|no one|guarantee|inevitable/i.test(claim.text)) {
    return 'Can you defend that absolute wording against one clear exception?';
  }
  if (/should|must|policy|ban|require|mandate/i.test(claim.text)) {
    return 'What specific harm exists now, and how does your proposal solve it better than the status quo?';
  }
  return 'What would the judge need to see before treating this claim as proven?';
}

function followUpsForClaim(claim: ClaimFinding): CrossfireFollowUp[] {
  const causal = /cause|caused|lead|result|because/i.test(claim.text);
  const policy = /should|must|policy|ban|require|mandate/i.test(claim.text);
  const absolute = /always|never|everyone|no one|guarantee|inevitable/i.test(claim.text);
  const secondQuestion = causal
    ? 'What alternate cause have you ruled out?'
    : policy
      ? 'What enforcement or feasibility evidence proves the proposal works?'
      : absolute
        ? 'What exception would force you to narrow the claim?'
        : 'Which warrant links the evidence to that conclusion?';

  return [
    {
      question: 'What is the exact source or example that proves the claim?',
      purpose: 'Force evidence specificity.',
      ifAnswered: 'Ask whether that source is recent, representative, and comparative.',
      ifEvaded: 'Mark the claim as asserted and ask for the warrant instead.',
    },
    {
      question: secondQuestion,
      purpose: causal ? 'Test causation.' : policy ? 'Test solvency.' : absolute ? 'Break overclaiming.' : 'Test reasoning.',
      ifAnswered: 'Compare their answer to the original burden of proof.',
      ifEvaded: 'Ask the judge to treat the unsupported part as conceded.',
    },
    {
      question: 'How do you weigh this by magnitude, probability, timeframe, and reversibility?',
      purpose: 'Move from truth of claim to ballot weight.',
      ifAnswered: 'Press the weakest factor in their weighing.',
      ifEvaded: 'Say the claim may be true but still does not decide the round.',
    },
    {
      question: 'What would make your side lose this argument?',
      purpose: 'Find the concession threshold.',
      ifAnswered: 'Use their threshold as the standard for the next speech.',
      ifEvaded: 'Frame their position as unfalsifiable and therefore lower quality.',
    },
    {
      question: 'If both sides win some offense, why should the judge prefer yours?',
      purpose: 'Close on comparative framing.',
      ifAnswered: 'Flow their voting issue and answer it directly.',
      ifEvaded: 'Close by saying they never gave a comparative reason to vote.',
    },
  ];
}

export function buildCrossfireFollowUpChains(input: CrossfireFollowUpInput = {}): CrossfireFollowUpChain[] {
  const analysis = input.analysis ?? (input.topicText ? analyzeArgument(input.topicText, { judgeMode: 'debate' }) : undefined);
  const fromCards = input.rebuttalCards?.map(claimFromCard) ?? [];
  const fromAnalysis = analysis ? [...analysis.unsupportedClaims, ...analysis.claims].slice(0, 8) : [];
  const candidates = [...fromCards, ...fromAnalysis];
  const unique = candidates.filter((claim, index, all) => all.findIndex((candidate) => candidate.text === claim.text) === index);
  const targets = unique.length > 0 ? unique : [claimFromCard(fallbackCard(input.topicText ?? ''))];
  const maxChains = clamp(input.maxChains ?? 4, 1, 8);
  const depth = clamp(input.depth ?? 4, 1, 5);

  return targets.slice(0, maxChains).map((claim, index) => {
    const fallbackQuestion = input.rebuttalCards?.find((card) => card.claim === claim.text)?.crossfireQuestion;
    return {
      id: `crossfire-${index + 1}`,
      targetClaim: trimText(claim.text, 160),
      rootQuestion: questionForClaim(claim, fallbackQuestion),
      followUps: followUpsForClaim(claim).slice(0, depth),
      closingPin: `So the judge should discount "${trimText(claim.text, 90)}" unless the next speech gives evidence, warrant, and comparative impact.`,
    };
  });
}

function ballotIssue(label: string, winner: string, weight: number, reason: string): JudgeBallotIssue {
  return { label, winner, weight: clamp(weight), reason };
}

function speakerPointsFrom(score: number, risk: number): number {
  const points = 20 + score / 12 - risk / 25;
  return Math.max(20, Math.min(30, Math.round(points * 10) / 10));
}

export function buildJudgeBallotSummary(input: JudgeBallotInput): JudgeBallotSummary {
  const sideLabel = input.sideLabel ?? 'Speaker';
  const opponentLabel = input.opponentLabel ?? 'Opponent';
  const analysis = input.analysis ?? analyzeArgument(input.userCase ?? '', { judgeMode: 'debate' });
  const opponentAnalysis = input.opponentAnalysis ?? (input.opponentText ? analyzeArgument(input.opponentText, { judgeMode: 'debate' }) : undefined);
  const riskReport = input.riskReport ?? assessSpeechRisk({ speechText: input.userCase ?? analysis.thesis.text, analysis });
  const impacts = (input.impacts ?? []).map(weighImpact);
  const impactComparison = compareImpactWeighing(impacts);
  const bestImpact = impactComparison.ordered[0];
  const userImpactBonus = bestImpact && (!bestImpact.side || bestImpact.side === sideLabel) ? (bestImpact.score - 50) * 0.16 : 0;
  const adjustedUser = analysis.scores.overall + userImpactBonus - riskReport.overallRisk * 0.12;
  const adjustedOpponent = opponentAnalysis ? opponentAnalysis.scores.overall : 58;
  const winner =
    adjustedUser >= adjustedOpponent + 3
      ? sideLabel
      : adjustedOpponent >= adjustedUser + 3
        ? opponentLabel
        : 'Too close to call';

  const evidenceWinner = opponentAnalysis && opponentAnalysis.scores.evidence > analysis.scores.evidence + 4 ? opponentLabel : sideLabel;
  const warrantWinner = analysis.unsupportedClaims.length <= (opponentAnalysis?.unsupportedClaims.length ?? analysis.unsupportedClaims.length + 1) ? sideLabel : opponentLabel;
  const impactWinner = bestImpact?.side || (impacts.length > 0 ? bestImpact?.label ?? sideLabel : winner);
  const votingIssues = [
    ballotIssue(
      'Evidence quality',
      evidenceWinner,
      Math.abs(analysis.scores.evidence - (opponentAnalysis?.scores.evidence ?? 50)) + 45,
      `${sideLabel} evidence score is ${analysis.scores.evidence}${opponentAnalysis ? `; ${opponentLabel} evidence score is ${opponentAnalysis.scores.evidence}` : ''}.`,
    ),
    ballotIssue(
      'Warrant protection',
      warrantWinner,
      70 - analysis.unsupportedClaims.length * 6,
      analysis.unsupportedClaims[0]
        ? `Most exposed warrant is "${trimText(analysis.unsupportedClaims[0].text, 90)}."`
        : 'Major claims have enough warrant coverage for the ballot.',
    ),
    ballotIssue(
      'Impact comparison',
      impactWinner || winner,
      bestImpact?.score ?? 50,
      bestImpact ? bestImpact.weighingSentence : 'No explicit impact comparison was supplied.',
    ),
  ];

  const droppedArguments = analysis.unsupportedClaims
    .slice(0, 3)
    .map((claim) => `${claim.id}: ${trimText(claim.text, 110)}`)
    .concat(analysis.scores.rebuttal < 55 ? ['Opposing view was not answered before weighing.'] : []);
  const riskNotes = riskReport.signals.slice(0, 3).map((signal) => `${signal.category}: ${signal.finding}`);
  const reasonForDecision =
    winner === 'Too close to call'
      ? `The ballot is close because ${sideLabel} has a ${analysis.scores.overall}/100 case but still carries ${riskReport.level} speech risk.`
      : `${winner} wins because the decisive issues are ${votingIssues
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2)
          .map((issue) => issue.label.toLowerCase())
          .join(' and ')}.`;

  return {
    winner,
    speakerPoints: speakerPointsFrom(analysis.scores.overall, riskReport.overallRisk),
    reasonForDecision,
    votingIssues,
    droppedArguments,
    riskNotes,
    comparativeWeighing: impactComparison.summary,
    nextRoundAdvice: [
      riskReport.safestNextMove,
      analysis.missions[0] ?? 'Add one source-to-claim warrant.',
      bestImpact?.vulnerability ?? 'Add explicit magnitude, probability, timeframe, and reversibility weighing.',
    ],
  };
}

function secondsForSections(totalSeconds: number, weights: number[]): number[] {
  const raw = weights.map((weight) => Math.max(5, Math.round(totalSeconds * weight)));
  const delta = totalSeconds - raw.reduce((sum, value) => sum + value, 0);
  raw[raw.length - 1] += delta;
  return raw;
}

function section(id: string, kind: SpeakerFlowSectionKind, title: string, targetSeconds: number, bullets: string[], flowTags: string[], transitionLine: string): SpeakerFlowSection {
  return { id, kind, title, targetSeconds, bullets, flowTags, transitionLine };
}

function flowClaimBullets(analysis: FractureAnalysis): string[] {
  const claims = analysis.claims.slice(0, 3);
  if (claims.length === 0) {
    return ['State one claim the judge can test.', 'Add one piece of evidence.', 'Explain the warrant in plain language.'];
  }
  return claims.map((claim) => `${claim.id}: ${trimText(claim.text, 110)} | ${claim.warrant}`);
}

export function buildSpeakerFlowOutline(input: SpeakerFlowInput = {}): SpeakerFlowOutline {
  const analysis = input.analysis ?? analyzeArgument(input.caseText ?? '', { judgeMode: 'debate' });
  const role = input.role ?? 'constructive';
  const totalSeconds = clamp(input.totalSeconds ?? (role === 'final-focus' ? 120 : role === 'summary' ? 180 : 240), 60, 720);
  const rebuttalCards = input.rebuttalCards ?? [];
  const weighedImpacts = (input.impacts ?? []).map(weighImpact).sort((a, b) => b.score - a.score);
  const topImpact = weighedImpacts[0];
  const includeCrossfirePrep = input.includeCrossfirePrep ?? role !== 'final-focus';
  const weights = includeCrossfirePrep ? [0.12, 0.14, 0.28, 0.2, 0.16, 0.1] : [0.14, 0.16, 0.32, 0.22, 0.16];
  const times = secondsForSections(totalSeconds, weights);
  const sections: SpeakerFlowSection[] = [
    section(
      'opening',
      'opening',
      'Frame',
      times[0],
      [
        `Judge lens: ${analysis.burdenOfProof}`,
        `Verdict posture: ${analysis.verdict.label} - ${analysis.verdict.reason}`,
      ],
      ['lens', 'burden'],
      'The round should be judged through this burden.',
    ),
    section(
      'thesis',
      'thesis',
      'Thesis',
      times[1],
      [analysis.thesis.text, ...analysis.thesis.precision.slice(0, 2)],
      ['thesis', 'standard'],
      'That thesis creates three places to flow the debate.',
    ),
    section(
      'contentions',
      'contention',
      'Contentions',
      times[2],
      flowClaimBullets(analysis),
      ['claim', 'evidence', 'warrant'],
      'Those contentions matter because they create comparative offense.',
    ),
    section(
      'rebuttal',
      'rebuttal',
      'Rebuttal',
      times[3],
      rebuttalCards.length > 0
        ? rebuttalCards.slice(0, 3).map((card) => `If they say "${trimText(card.claim, 80)}," answer: ${card.response}`)
        : analysis.judgeQuestions.slice(0, 3).map((question) => `Pre-answer judge pressure: ${question}`),
      ['answer', 'turn', 'defense'],
      'Even if they win some defense, the weighing still favors this side.',
    ),
    section(
      'weighing',
      'weighing',
      'Weighing',
      times[4],
      topImpact
        ? [topImpact.weighingSentence, topImpact.vulnerability]
        : analysis.impactChain.slice(0, 3),
      ['magnitude', 'probability', 'timeframe', 'reversibility'],
      'That is the voting issue the judge should write first.',
    ),
  ];

  if (includeCrossfirePrep) {
    sections.push(
      section(
        'crossfire-prep',
        'crossfire-prep',
        'Crossfire Prep',
        times[5],
        buildCrossfireFollowUpChains({ analysis, rebuttalCards, maxChains: 2, depth: 2 }).map((chain) => chain.rootQuestion),
        ['question', 'concession'],
        'The next speech should convert any concession into ballot language.',
      ),
    );
  }

  const flowLine = sections.flatMap((item) => item.flowTags.map((tag) => `${item.id}:${tag}`));

  return {
    totalSeconds,
    role,
    thesis: analysis.thesis.text,
    sections,
    deliveryNotes: [
      'Keep each contention in claim, evidence, warrant order.',
      'Flag turns and concessions before adding new material.',
      'End with one clean voting issue, not a list of everything you said.',
    ],
    flowLine,
  };
}
