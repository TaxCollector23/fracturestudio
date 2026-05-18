export type JudgeMode = 'teacher' | 'debate' | 'historian' | 'professor' | 'reader';

export type CertaintyLabel = 'proven' | 'likely' | 'possible' | 'exaggerated' | 'unsupported' | 'false-looking';

export type HeatmapKind =
  | 'unsupported claim'
  | 'weak evidence'
  | 'unclear reasoning'
  | 'contradiction'
  | 'exaggeration'
  | 'off-topic'
  | 'strong support';

export type FractureAnalysisOptions = {
  judgeMode?: JudgeMode;
  rubric?: string;
  audience?: string;
};

export type ClaimFinding = {
  id: string;
  text: string;
  paragraph: number;
  certainty: CertaintyLabel;
  evidence: string[];
  warrant: string;
  vulnerability: string;
};

export type HeatmapFinding = {
  sentence: string;
  severity: 1 | 2 | 3 | 4 | 5;
  kind: HeatmapKind;
  fix: string;
};

export type ArgumentGraphNode = {
  id: string;
  label: string;
  type: 'thesis' | 'claim' | 'evidence' | 'warrant' | 'impact' | 'rebuttal';
  strength: number;
};

export type ArgumentGraphEdge = {
  from: string;
  to: string;
  label: string;
};

export type SpeakingModelPass = {
  model: string;
  purpose: string;
  diagnosis: string;
  nextMove: string;
};

export type FractureAnalysis = {
  wordCount: number;
  scores: {
    overall: number;
    logic: number;
    evidence: number;
    clarity: number;
    originality: number;
    rebuttal: number;
  };
  thesis: {
    text: string;
    score: number;
    precision: string[];
  };
  claims: ClaimFinding[];
  unsupportedClaims: ClaimFinding[];
  assumptions: string[];
  contradictions: string[];
  fallacies: { label: string; severity: number; reason: string }[];
  burdenOfProof: string;
  impactChain: string[];
  collapsePoint: string;
  paragraphRankings: { paragraph: number; score: number; reason: string }[];
  heatmap: HeatmapFinding[];
  graph: { nodes: ArgumentGraphNode[]; edges: ArgumentGraphEdge[] };
  crossfireQuestions: string[];
  judgeQuestions: string[];
  readerConfusion: string[];
  quoteIntegration: string[];
  evidenceUpgrades: string[];
  modelPasses: SpeakingModelPass[];
  flow: string[];
  verdict: {
    label: 'Survives' | 'Shaky' | 'Cracked' | 'Collapsed';
    reason: string;
  };
  missions: string[];
};

const modelBlueprints = [
  {
    model: 'Toulmin Model',
    purpose: 'claim, grounds, warrant, backing, qualifier, rebuttal',
    nextMove: 'Name the warrant after each major piece of evidence.',
  },
  {
    model: 'Assertion-Reasoning-Evidence-Impact',
    purpose: 'assertion, warrant, data, significance',
    nextMove: 'Make every contention say what it proves, why it is true, what proves it, and why it matters.',
  },
  {
    model: 'Rogerian Model',
    purpose: 'fair opposition summary before disagreement',
    nextMove: 'Add the strongest good-faith version of the other side.',
  },
  {
    model: 'Stock Issues Model',
    purpose: 'harm, inherency, solvency, topicality, significance',
    nextMove: 'Show the harm, why it persists now, and why your solution solves it.',
  },
  {
    model: 'Pragma-Dialectics',
    purpose: 'critical discussion, burden, relevance, and rule-breaking moves',
    nextMove: 'Separate what must be proven from what is merely asserted.',
  },
  {
    model: 'Syllogism',
    purpose: 'major premise, minor premise, conclusion',
    nextMove: 'Rewrite the central logic as two premises and one conclusion.',
  },
  {
    model: 'Enthymeme',
    purpose: 'unstated premise that the audience must supply',
    nextMove: 'Expose the missing premise and decide whether readers will accept it.',
  },
  {
    model: "Monroe's Motivated Sequence",
    purpose: 'attention, need, satisfaction, visualization, action',
    nextMove: 'Convert the argument into a listener-facing speech path.',
  },
  {
    model: 'Dependency Model',
    purpose: 'which claims depend on which prior claims',
    nextMove: 'Find the upstream sentence that other paragraphs rely on.',
  },
  {
    model: 'Casuistry',
    purpose: 'case comparison and precedent reasoning',
    nextMove: 'Add a similar case and explain why the analogy holds.',
  },
  {
    model: 'Evolutionary Model of Conceptual Change',
    purpose: 'how the audience moves from old belief to better belief',
    nextMove: 'Name the old model, its failure, and the replacement model.',
  },
];

const claimSignals = [
  'should',
  'must',
  'need',
  'therefore',
  'because',
  'proves',
  'shows',
  'means',
  'causes',
  'improves',
  'harms',
  'solves',
  'best',
  'worst',
  'always',
  'never',
  'inevitably',
  'fundamentally',
];

const evidenceSignals = [
  'study',
  'research',
  'data',
  'according',
  'report',
  'survey',
  'trial',
  'experiment',
  'historian',
  'court',
  'law',
  'statistic',
  'percent',
  '%',
  'doi',
  'http',
  'source',
  'quote',
  'evidence',
];

const personalEssaySignals = [
  'college',
  'application',
  'admission',
  'admissions',
  'personal statement',
  'common app',
  'essay',
  'my family',
  'my community',
  'my school',
  'my identity',
  'i learned',
  'i realized',
  'i discovered',
  'i began',
  'i built',
  'i created',
  'i volunteered',
  'i tutored',
  'i led',
  'i worked',
];

const livedSupportSignals = [
  'for example',
  'for instance',
  'when i',
  'after i',
  'before i',
  'during',
  'each week',
  'every morning',
  'summer',
  'freshman',
  'sophomore',
  'junior',
  'senior',
  'teacher',
  'mentor',
  'classroom',
  'lab',
  'club',
  'team',
  'project',
  'prototype',
  'competition',
  'volunteer',
  'community',
  'family',
  'kitchen',
  'hospital',
  'library',
  'neighborhood',
];

const reflectionSignals = [
  'i learned',
  'i realized',
  'i discovered',
  'i noticed',
  'i understood',
  'taught me',
  'changed how',
  'helped me',
  'made me',
  'now i',
  'because of this',
  'from that',
];

const transitionSignals = ['because', 'therefore', 'so', 'thus', 'since', 'as a result', 'which means'];
const contrastSignals = ['however', 'but', 'although', 'despite', 'yet', 'nevertheless'];
const exaggerationSignals = ['always', 'never', 'everyone', 'no one', 'guarantee', 'impossible', 'inevitable', 'all'];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function words(text: string): string[] {
  return text.match(/[A-Za-z0-9']+/g) ?? [];
}

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function livedExperienceSupport(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  const wordCount = words(sentence).length;
  const firstPerson = /\b(i|my|me|we|our)\b/i.test(sentence);
  const concreteMarker = includesAny(lower, livedSupportSignals);
  const actionMarker = /\b(built|created|led|organized|taught|tutored|worked|served|volunteered|coded|wrote|translated|cared|practiced|competed|researched)\b/i.test(sentence);
  return firstPerson && wordCount >= 8 && (concreteMarker || actionMarker);
}

function hasEvidence(sentence: string): boolean {
  return /\d/.test(sentence) || /"[^"]{8,}"/.test(sentence) || includesAny(sentence, evidenceSignals) || livedExperienceSupport(sentence);
}

function isClaim(sentence: string): boolean {
  const count = words(sentence).length;
  if (count < 5) {
    return false;
  }
  return includesAny(sentence, claimSignals) || (count > 12 && !hasEvidence(sentence));
}

function trimSentence(sentence: string, max = 190): string {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) {
    return clean;
  }
  return `${clean.slice(0, max - 3).trim()}...`;
}

function getThesis(paragraphs: string[], sentences: string[]): string {
  const candidates = sentences.filter((sentence) => isClaim(sentence));
  const firstParagraphClaim = splitSentences(paragraphs[0] ?? '').find((sentence) => isClaim(sentence));
  return trimSentence(firstParagraphClaim || candidates[0] || sentences[0] || 'Add a specific thesis before analysis can anchor the case.');
}

function certaintyFor(sentence: string, evidence: string[]): CertaintyLabel {
  const lower = sentence.toLowerCase();
  if (includesAny(lower, exaggerationSignals) && evidence.length === 0) {
    return 'exaggerated';
  }
  if (/(false|fake|hoax|impossible|guarantee)/i.test(sentence) && evidence.length === 0) {
    return 'false-looking';
  }
  if (evidence.length >= 2) {
    return 'likely';
  }
  if (evidence.length === 1) {
    return hasEvidence(evidence[0]) ? 'possible' : 'unsupported';
  }
  return 'unsupported';
}

function buildWarrant(claim: string, evidence: string[]): string {
  if (evidence.length === 0) {
    return 'Missing warrant: the claim needs evidence plus an explanation of why that evidence proves this exact point.';
  }
  if (!includesAny(claim, transitionSignals) && !evidence.some((line) => includesAny(line, transitionSignals))) {
    return 'Thin warrant: evidence appears nearby, but the reasoning bridge is not explicit.';
  }
  return 'Usable warrant: the draft gives readers a reason to connect evidence to the claim.';
}

function buildVulnerability(claim: string, evidence: string[]): string {
  if (evidence.length === 0) {
    return 'Opponent can ask for proof and force the claim to stand alone.';
  }
  if (includesAny(claim, exaggerationSignals)) {
    return 'Opponent can attack the absolute wording with one counterexample.';
  }
  if (/caus|lead|result|because|therefore/i.test(claim)) {
    return 'Opponent can challenge causation and ask what else changed at the same time.';
  }
  return 'Opponent can ask whether the evidence is representative, recent, and tied to the audience.';
}

function extractClaims(paragraphs: string[]): ClaimFinding[] {
  const claims: ClaimFinding[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const sentences = splitSentences(paragraph);
    sentences.forEach((sentence, sentenceIndex) => {
      if (!isClaim(sentence)) {
        return;
      }
      const nearby = sentences
        .filter((candidate, index) => index !== sentenceIndex && Math.abs(index - sentenceIndex) <= 2 && hasEvidence(candidate))
        .map((candidate) => trimSentence(candidate, 160));
      claims.push({
        id: `claim-${claims.length + 1}`,
        text: trimSentence(sentence),
        paragraph: paragraphIndex + 1,
        certainty: certaintyFor(sentence, nearby),
        evidence: nearby,
        warrant: buildWarrant(sentence, nearby),
        vulnerability: buildVulnerability(sentence, nearby),
      });
    });
  });
  return claims.slice(0, 12);
}

function thesisPrecision(thesis: string): string[] {
  const checks: string[] = [];
  const count = words(thesis).length;
  checks.push(count >= 8 ? 'Specific enough to test' : 'Too short to carry a case');
  checks.push(includesAny(thesis, ['should', 'must', 'because', 'causes', 'improves', 'harms']) ? 'Arguable' : 'Needs a sharper stance');
  checks.push(!includesAny(thesis, exaggerationSignals) ? 'Controlled wording' : 'Overconfident wording');
  checks.push(count <= 35 ? 'Narrow enough for one draft' : 'May be too broad for one draft');
  checks.push(hasEvidence(thesis) ? 'Already gestures at proof' : 'Needs evidence after the thesis');
  return checks;
}

function detectAssumptions(claims: ClaimFinding[]): string[] {
  const assumptions = claims.slice(0, 5).map((claim) => {
    if (/uniform/i.test(claim.text)) {
      return 'Hidden assumption: clothing is a major enough cause of behavior or performance to change outcomes.';
    }
    if (/technology|ai|artificial intelligence/i.test(claim.text)) {
      return 'Hidden assumption: the tool changes thinking more than it changes convenience or speed.';
    }
    if (/ban|require|policy|law|mandate/i.test(claim.text)) {
      return 'Hidden assumption: enforcement costs and side effects will not outweigh the proposed benefit.';
    }
    if (/cause|lead|result|improve|harm/i.test(claim.text)) {
      return 'Hidden assumption: the cause named in this sentence is stronger than competing explanations.';
    }
    return `Hidden assumption: readers will accept the bridge between "${trimSentence(claim.text, 90)}" and the impact without more proof.`;
  });

  return assumptions.length > 0 ? assumptions : ['Hidden assumption: the thesis has not yet stated what readers must believe for the argument to work.'];
}

function detectContradictions(sentences: string[]): string[] {
  const findings: string[] = [];
  const lower = sentences.map((s) => s.toLowerCase());
  if (lower.some((s) => s.includes('always')) && lower.some((s) => s.includes('sometimes') || s.includes('often'))) {
    findings.push('Absolute and qualified language both appear. Decide whether the claim is universal or conditional.');
  }
  if (lower.some((s) => s.includes('never')) && lower.some((s) => s.includes('can') || s.includes('may'))) {
    findings.push('The draft mixes "never" with possibility language. That gives an opponent an easy consistency attack.');
  }
  const contrastWithoutResolution = sentences.find((sentence) => includesAny(sentence, contrastSignals) && !includesAny(sentence, transitionSignals));
  if (contrastWithoutResolution) {
    findings.push(`Contrast introduced without resolution: "${trimSentence(contrastWithoutResolution, 130)}"`);
  }
  return findings;
}

function detectFallacies(claims: ClaimFinding[]): { label: string; severity: number; reason: string }[] {
  const fallacies: { label: string; severity: number; reason: string }[] = [];
  claims.forEach((claim) => {
    if (/after|since|because|caused|led to/i.test(claim.text) && claim.evidence.length === 0) {
      fallacies.push({
        label: 'False cause risk',
        severity: 4,
        reason: `Causal language appears without controlled evidence in claim ${claim.id}.`,
      });
    }
    if (includesAny(claim.text, exaggerationSignals)) {
      fallacies.push({
        label: 'Overgeneralization',
        severity: claim.evidence.length === 0 ? 5 : 3,
        reason: `Absolute wording makes claim ${claim.id} vulnerable to one counterexample.`,
      });
    }
    if (/either|only two|no alternative/i.test(claim.text)) {
      fallacies.push({
        label: 'False dilemma',
        severity: 3,
        reason: `Claim ${claim.id} may exclude middle positions without proving they fail.`,
      });
    }
  });
  return fallacies.slice(0, 6);
}

function heatmapFor(sentences: string[]): HeatmapFinding[] {
  return sentences.slice(0, 24).map((sentence) => {
    if (hasEvidence(sentence) && includesAny(sentence, transitionSignals)) {
      return {
        sentence: trimSentence(sentence, 160),
        severity: 1,
        kind: 'strong support',
        fix: 'Keep this structure: evidence plus reasoning in the same move.',
      };
    }
    if (hasEvidence(sentence)) {
      return {
        sentence: trimSentence(sentence, 160),
        severity: 2,
        kind: 'weak evidence',
        fix: 'Add a warrant sentence that explains why this evidence proves the claim.',
      };
    }
    if (isClaim(sentence) && includesAny(sentence, exaggerationSignals)) {
      return {
        sentence: trimSentence(sentence, 160),
        severity: 5,
        kind: 'exaggeration',
        fix: 'Replace absolute wording with a qualified claim you can defend.',
      };
    }
    if (isClaim(sentence)) {
      return {
        sentence: trimSentence(sentence, 160),
        severity: 4,
        kind: 'unsupported claim',
        fix: 'Attach a source, concrete example, or causal explanation.',
      };
    }
    if (includesAny(sentence, contrastSignals)) {
      return {
        sentence: trimSentence(sentence, 160),
        severity: 3,
        kind: 'unclear reasoning',
        fix: 'Resolve the contrast so readers know which side wins and why.',
      };
    }
    return {
      sentence: trimSentence(sentence, 160),
      severity: 2,
      kind: 'off-topic',
      fix: 'Tie this sentence back to the thesis or cut it.',
    };
  });
}

function scoreParagraph(paragraph: string): { score: number; reason: string } {
  const sentences = splitSentences(paragraph);
  const claimCount = sentences.filter(isClaim).length;
  const evidenceCount = sentences.filter(hasEvidence).length;
  const warrantCount = sentences.filter((sentence) => includesAny(sentence, transitionSignals)).length;
  const score = clampScore(40 + claimCount * 10 + evidenceCount * 18 + warrantCount * 10 - Math.max(0, claimCount - evidenceCount) * 12);
  const reason =
    evidenceCount === 0 && claimCount > 0
      ? 'claim-heavy but evidence-light'
      : warrantCount === 0 && evidenceCount > 0
        ? 'has evidence but needs reasoning bridges'
        : 'has a workable claim-evidence-reasoning mix';
  return { score, reason };
}

function buildGraph(thesis: string, claims: ClaimFinding[]): { nodes: ArgumentGraphNode[]; edges: ArgumentGraphEdge[] } {
  const nodes: ArgumentGraphNode[] = [{ id: 'thesis', label: trimSentence(thesis, 90), type: 'thesis', strength: 70 }];
  const edges: ArgumentGraphEdge[] = [];

  claims.slice(0, 5).forEach((claim, index) => {
    const claimId = claim.id;
    nodes.push({ id: claimId, label: trimSentence(claim.text, 82), type: 'claim', strength: claim.certainty === 'unsupported' ? 35 : 65 });
    edges.push({ from: 'thesis', to: claimId, label: `supports ${index + 1}` });

    if (claim.evidence[0]) {
      const evidenceId = `${claimId}-evidence`;
      nodes.push({ id: evidenceId, label: trimSentence(claim.evidence[0], 82), type: 'evidence', strength: 60 });
      edges.push({ from: evidenceId, to: claimId, label: 'grounds' });
    }

    const warrantId = `${claimId}-warrant`;
    nodes.push({ id: warrantId, label: trimSentence(claim.warrant, 82), type: 'warrant', strength: claim.warrant.startsWith('Missing') ? 25 : 55 });
    edges.push({ from: warrantId, to: claimId, label: 'reasoning bridge' });
  });

  nodes.push({ id: 'impact', label: 'Why this matters to the reader, judge, or audience', type: 'impact', strength: 50 });
  edges.push({ from: 'thesis', to: 'impact', label: 'impact' });

  return { nodes, edges };
}

function buildScores(sentences: string[], claims: ClaimFinding[], paragraphs: string[]) {
  const fullText = sentences.join(' ');
  const allWords = words(fullText);
  const wordCount = allWords.length;
  const personalVoice = sentences.filter((sentence) => /\b(i|my|me|we|our)\b/i.test(sentence)).length;
  const livedSupportCount = sentences.filter(livedExperienceSupport).length;
  const reflectionCount = sentences.filter((sentence) => includesAny(sentence, reflectionSignals)).length;
  const sourcedEvidenceCount = sentences.filter((sentence) => /\d/.test(sentence) || /"[^"]{8,}"/.test(sentence) || includesAny(sentence, evidenceSignals)).length;
  const admissionsEssay =
    personalVoice >= Math.max(2, sentences.length * 0.25) &&
    (livedSupportCount >= 2 || reflectionCount >= 2 || includesAny(fullText, personalEssaySignals));
  const evidenceCount = sentences.filter(hasEvidence).length;
  const claimCount = Math.max(1, claims.length);
  const unsupported = claims.filter((claim) => claim.certainty === 'unsupported' || claim.certainty === 'exaggerated').length;
  const transitions = sentences.filter((sentence) => includesAny(sentence, transitionSignals)).length;
  const rebuttalSignals = sentences.filter((sentence) => /counter|opponent|although|however|critics|rebut/i.test(sentence)).length;
  const contrastCount = sentences.filter((sentence) => includesAny(sentence, contrastSignals)).length;
  const averageSentenceLength = wordCount / Math.max(1, sentences.length);
  const paragraphShape = Math.min(8, paragraphs.length * 2);
  const lexicalRange = new Set(allWords.map((word) => word.toLowerCase())).size / Math.max(1, wordCount);

  const clarity = clampScore(70 - Math.max(0, averageSentenceLength - 26) * 2 + paragraphShape + (wordCount >= 120 ? 8 : wordCount >= 60 ? 4 : 0));
  const originality = clampScore(48 + lexicalRange * 38 + (admissionsEssay ? Math.min(12, livedSupportCount * 3 + reflectionCount * 2) : 0));

  if (admissionsEssay) {
    const support = clampScore(44 + livedSupportCount * 11 + reflectionCount * 6 + sourcedEvidenceCount * 4 - unsupported * 5);
    const logic = clampScore(48 + transitions * 5 + reflectionCount * 6 + contrastCount * 3 - unsupported * 6);
    const rebuttal = clampScore(48 + contrastCount * 8 + reflectionCount * 5 + (wordCount >= 180 ? 8 : 0) - Math.max(0, unsupported - 2) * 4);
    const developmentPenalty = wordCount < 90 ? 14 : wordCount < 150 ? 8 : 0;
    const overall = clampScore(logic * 0.28 + support * 0.25 + clarity * 0.22 + originality * 0.15 + rebuttal * 0.1 - developmentPenalty);
    return { overall, logic, evidence: support, clarity, originality, rebuttal };
  }

  const evidence = clampScore(42 + (evidenceCount / claimCount) * 30 - unsupported * 7);
  const logic = clampScore(50 + transitions * 6 - unsupported * 8);
  const rebuttal = clampScore(35 + rebuttalSignals * 18 - Math.max(0, unsupported - 1) * 5);
  const rawOverall = clampScore(logic * 0.27 + evidence * 0.25 + clarity * 0.18 + originality * 0.12 + rebuttal * 0.18);
  const overall = wordCount < 30 ? Math.min(rawOverall, 42) : rawOverall;
  return { overall, logic, evidence, clarity, originality, rebuttal };
}

function buildBurdenOfProof(thesis: string, claims: ClaimFinding[]): string {
  const causal = /cause|lead|result|improve|harm|reduce|increase/i.test(thesis);
  const policy = /should|must|require|ban|mandate|policy|law/i.test(thesis);
  if (policy && causal) {
    return 'You must prove the harm exists, that your policy changes the cause of the harm, and that side effects do not outweigh the benefit.';
  }
  if (policy) {
    return 'You must prove need, feasibility, enforcement, and why the proposed rule beats the status quo.';
  }
  if (causal) {
    return 'You must prove causation, not just sequence or correlation. Address alternate explanations directly.';
  }
  if (claims.length === 0) {
    return 'You must first state a defensible thesis before the burden can be measured.';
  }
  return 'You must prove each major claim with specific evidence and explain why that evidence matters.';
}

function buildImpactChain(thesis: string): string[] {
  const subject = trimSentence(thesis, 72);
  return [
    `Action or claim: ${subject}`,
    'Short-term effect: name the immediate change your evidence actually supports.',
    'Long-term effect: show why that change compounds or matters beyond one example.',
    'Audience impact: explain who is affected, how much, how soon, and whether the harm is reversible.',
  ];
}

function buildQuestions(thesis: string, unsupported: ClaimFinding[], mode: JudgeMode): { crossfire: string[]; judge: string[] } {
  const firstWeak = unsupported[0]?.text || thesis;
  const base = [
    `What evidence proves "${trimSentence(firstWeak, 90)}" instead of only making it sound plausible?`,
    'What would change your mind, and does the draft admit that standard?',
    'Which part of the argument is causal, and what alternate cause have you ruled out?',
    'What is the best counterexample, and why does it not defeat your thesis?',
    'Which source supports the most important factual claim sentence by sentence?',
  ];
  const judge =
    mode === 'debate'
      ? [
          'Where is the impact weighed by magnitude, probability, timeframe, and reversibility?',
          'What is the clearest voting issue if both sides win some offense?',
          'Which warrant should I write on the flow as the deciding reason?',
        ]
      : mode === 'teacher'
        ? [
            'Does each paragraph begin with a claim the paragraph actually proves?',
            'Where does the draft integrate evidence instead of dropping it?',
            'Is the thesis specific, arguable, and narrow enough for the assignment?',
          ]
        : mode === 'historian'
          ? [
              'What primary or contemporary source anchors the historical claim?',
              'Does the timeline prove causation or only sequence?',
              'Which context would change how the event should be interpreted?',
            ]
          : mode === 'professor'
            ? [
                'Which concept is being defined, challenged, or extended?',
                'What assumption would a specialist reject first?',
                'Does the draft distinguish evidence from interpretation?',
              ]
            : [
                'Where might a normal reader get lost?',
                'Which sentence most needs an example?',
                'What is the one thing I should remember after reading?',
              ];
  return { crossfire: base, judge };
}

function buildModelPasses(analysis: {
  thesis: string;
  claims: ClaimFinding[];
  unsupported: ClaimFinding[];
  scores: ReturnType<typeof buildScores>;
}): SpeakingModelPass[] {
  return modelBlueprints.map((blueprint) => {
    const weakClaim = analysis.unsupported[0]?.text || analysis.claims[0]?.text || analysis.thesis;
    const diagnosis =
      blueprint.model === 'Toulmin Model'
        ? analysis.unsupported.length > 0
          ? `Claim needs grounds and warrant: "${trimSentence(weakClaim, 90)}"`
          : 'Claim, evidence, and warrant are visible enough to refine.'
        : blueprint.model === 'Rogerian Model'
          ? analysis.scores.rebuttal < 55
            ? 'Opposing view is not granted enough strength before rebuttal.'
            : 'The draft makes room for opposition before answering it.'
          : blueprint.model === 'Stock Issues Model'
            ? analysis.scores.evidence < 60
              ? 'Need and solvency are not proven with enough concrete evidence.'
              : 'Need and proof are present; now sharpen comparative weighing.'
            : blueprint.model === 'Pragma-Dialectics'
              ? analysis.unsupported.length > 0
                ? 'Burden of proof is being shifted onto the reader.'
                : 'The draft mostly accepts its burden and gives reasons.'
              : blueprint.model === 'Dependency Model'
                ? `Collapse risk centers on: "${trimSentence(weakClaim, 80)}"`
                : analysis.scores.overall >= 70
                  ? 'Passable, but the model can make the reasoning more deliberate.'
                  : 'Useful model for repairing a weak step in the chain.';

    return {
      model: blueprint.model,
      purpose: blueprint.purpose,
      diagnosis,
      nextMove: blueprint.nextMove,
    };
  });
}

function buildFlow(): string[] {
  return [
    '1. Thesis precision: write the arguable claim in one testable sentence.',
    '2. Claim map: split the case into claims, evidence, warrants, backing, and impacts.',
    '3. Burden check: name what the writer must actually prove.',
    '4. Evidence audit: rate source quality, freshness, relevance, and claim fit.',
    '5. Assumption pass: surface hidden premises and audience beliefs.',
    '6. Opposition pass: steelman the other side before rebutting it.',
    '7. Crossfire pass: turn vulnerabilities into questions and prepared answers.',
    '8. Speech pass: arrange the case with attention, need, satisfaction, visualization, and action.',
    '9. Collapse pass: identify the one sentence that can break the case.',
    '10. Revision mission: ship three changes instead of drowning in comments.',
  ];
}

function buildMissions(analysis: Pick<FractureAnalysis, 'unsupportedClaims' | 'collapsePoint' | 'scores'>): string[] {
  const missions = [
    analysis.unsupportedClaims[0]
      ? `Prove claim ${analysis.unsupportedClaims[0].id}: add one source and one warrant sentence.`
      : 'Strengthen the best claim by adding one precise qualifier.',
    `Protect the collapse point: "${trimSentence(analysis.collapsePoint, 100)}"`,
    analysis.scores.rebuttal < 60
      ? 'Add a counterargument paragraph that fairly states the strongest objection before answering it.'
      : 'Tighten the final impact comparison so the reader knows why your side matters more.',
  ];
  return missions;
}

function isNonsenseDraft(clean: string, wordCount: number, sentences: string[]): boolean {
  if (!clean) {
    return true;
  }

  const alphaWords = words(clean).filter((word) => /[A-Za-z]/.test(word));
  const uniqueAlpha = new Set(alphaWords.map((word) => word.toLowerCase()));
  const hasArgumentSignal = includesAny(clean, claimSignals) || includesAny(clean, evidenceSignals) || includesAny(clean, transitionSignals);
  const hasSentenceShape = sentences.some((sentence) => words(sentence).length >= 7);
  const repeatedToken = alphaWords.length >= 4 && uniqueAlpha.size <= 2;
  const symbolNoise = clean.length > 0 && clean.replace(/[A-Za-z0-9\s.,;:'"?!()-]/g, '').length / clean.length > 0.35;

  return wordCount < 8 || repeatedToken || symbolNoise || (!hasArgumentSignal && !hasSentenceShape);
}

function buildNonsenseAnalysis(clean: string, wordCount: number): FractureAnalysis {
  const snippet = trimSentence(clean || 'No argumentative text provided.', 120);
  const scores = {
    overall: clean ? 4 : 0,
    logic: clean ? 5 : 0,
    evidence: 0,
    clarity: clean ? 10 : 0,
    originality: clean ? 5 : 0,
    rebuttal: 0,
  };
  const thesisText = clean
    ? 'No defensible thesis found. Fracture needs a claim, reasoning, evidence, and impact before it can grade an argument.'
    : 'No draft entered yet.';
  const heatmap: HeatmapFinding[] = clean
    ? [
        {
          sentence: snippet,
          severity: 5,
          kind: 'unsupported claim',
          fix: 'Replace this with a complete argumentative claim: assertion, reasoning, evidence, and impact.',
        },
      ]
    : [];

  return {
    wordCount,
    scores,
    thesis: {
      text: thesisText,
      score: clean ? 3 : 0,
      precision: [
        'No clear assertion to test',
        'No reasoning bridge',
        'No evidence supplied',
        'No impact or significance',
        'Input is too thin for a real Fracture score',
      ],
    },
    claims: [],
    unsupportedClaims: [],
    assumptions: ['Fracture cannot infer an argument from a greeting, fragment, repeated words, or symbol noise.'],
    contradictions: [],
    fallacies: [],
    burdenOfProof: 'Start by stating one claim, one reason it is true, one piece of evidence, and why it matters.',
    impactChain: [
      'Assertion: not provided',
      'Reasoning: not provided',
      'Evidence: not provided',
      'Impact: not provided',
    ],
    collapsePoint: clean ? snippet : 'No argument exists yet.',
    paragraphRankings: clean ? [{ paragraph: 1, score: 0, reason: 'not enough argumentative substance to evaluate' }] : [],
    heatmap,
    graph: {
      nodes: [{ id: 'missing-thesis', label: 'No argument entered', type: 'thesis', strength: 0 }],
      edges: [],
    },
    crossfireQuestions: [
      'What exact claim are you trying to prove?',
      'What reason connects that claim to real-world cause and effect?',
      'What evidence would let a skeptical reader verify it?',
      'Why does the claim matter in the debate, essay, or speech?',
    ],
    judgeQuestions: ['There is not enough argumentative material to judge yet. Add an assertion, reasoning, evidence, and impact.'],
    readerConfusion: clean ? [`Reader cannot locate an argument in "${snippet}".`] : ['No draft text has been entered.'],
    quoteIntegration: [],
    evidenceUpgrades: ['Add a statistic, expert source, historical example, primary source, or concrete case that supports the first real claim.'],
    modelPasses: modelBlueprints.map((blueprint) => ({
      model: blueprint.model,
      purpose: blueprint.purpose,
      diagnosis: 'No complete argument exists yet, so this model cannot run responsibly.',
      nextMove: blueprint.nextMove,
    })),
    flow: buildFlow(),
    verdict: {
      label: 'Collapsed',
      reason: clean
        ? 'The input is not a complete argument yet. Fracture found no testable claim with reasoning, evidence, and impact.'
        : 'No draft has been entered yet.',
    },
    missions: [
      'Write one direct assertion the audience can agree or disagree with.',
      'Add one reasoning sentence that explains why the assertion is true.',
      'Add one piece of evidence and one impact sentence that shows why the claim matters.',
    ],
  };
}

export function analyzeArgument(text: string, options: FractureAnalysisOptions = {}): FractureAnalysis {
  const clean = text.trim();
  const paragraphs = splitParagraphs(clean);
  const sentences = splitSentences(clean);
  const wordCount = words(clean).length;

  if (isNonsenseDraft(clean, wordCount, sentences)) {
    return buildNonsenseAnalysis(clean, wordCount);
  }

  const thesisText = getThesis(paragraphs, sentences);
  const claims = extractClaims(paragraphs);
  const unsupportedClaims = claims.filter((claim) => claim.certainty === 'unsupported' || claim.certainty === 'exaggerated' || claim.evidence.length === 0);
  const scores = buildScores(sentences, claims, paragraphs);
  const heatmap = heatmapFor(sentences);
  const paragraphRankings = paragraphs
    .map((paragraph, index) => ({ paragraph: index + 1, ...scoreParagraph(paragraph) }))
    .sort((a, b) => a.score - b.score);
  const contradictions = detectContradictions(sentences);
  const fallacies = detectFallacies(claims);
  const questions = buildQuestions(thesisText, unsupportedClaims, options.judgeMode ?? 'debate');
  const collapsePoint = unsupportedClaims[0]?.text || claims.find((claim) => claim.vulnerability.includes('causation'))?.text || thesisText;
  const modelPasses = buildModelPasses({ thesis: thesisText, claims, unsupported: unsupportedClaims, scores });
  const readerConfusion = heatmap
    .filter((item) => item.kind === 'unclear reasoning' || item.kind === 'off-topic')
    .slice(0, 4)
    .map((item) => `Reader may lose the thread at "${trimSentence(item.sentence, 100)}"`);
  const quoteIntegration = sentences
    .filter((sentence) => /"[^"]{8,}"/.test(sentence) && !includesAny(sentence, transitionSignals))
    .slice(0, 4)
    .map((sentence) => `Dropped quote risk: explain what "${trimSentence(sentence, 90)}" proves.`);
  const evidenceUpgrades = unsupportedClaims.slice(0, 5).map((claim) => {
    if (/policy|law|ban|require/i.test(claim.text)) {
      return `For ${claim.id}, add a law, implementation study, or cost comparison.`;
    }
    if (/cause|improve|reduce|increase|harm/i.test(claim.text)) {
      return `For ${claim.id}, add comparative data that rules out alternate causes.`;
    }
    return `For ${claim.id}, add a statistic, expert source, primary source, or concrete example.`;
  });

  if (options.rubric?.trim()) {
    evidenceUpgrades.unshift('Rubric alignment: map one sentence to each rubric criterion before final revision.');
  }

  const verdict =
    scores.overall >= 78
      ? { label: 'Survives' as const, reason: 'The argument has enough structure to withstand pressure, though it still benefits from tighter weighing.' }
      : scores.overall >= 62
        ? { label: 'Shaky' as const, reason: 'The main idea is usable, but weak warrants or missing evidence still give opponents room.' }
        : scores.overall >= 45
          ? { label: 'Cracked' as const, reason: 'Important claims are asserted faster than they are proven.' }
          : { label: 'Collapsed' as const, reason: 'The draft needs a clearer thesis and evidence before rebuttal work will matter.' };

  const partial: Omit<FractureAnalysis, 'missions'> = {
    wordCount,
    scores,
    thesis: {
      text: thesisText,
      score: clampScore(scores.clarity * 0.45 + scores.logic * 0.35 + (thesisPrecision(thesisText).filter((item) => !/Too short|Needs|Overconfident|broad/i.test(item)).length / 5) * 20),
      precision: thesisPrecision(thesisText),
    },
    claims,
    unsupportedClaims,
    assumptions: detectAssumptions(claims),
    contradictions,
    fallacies,
    burdenOfProof: buildBurdenOfProof(thesisText, claims),
    impactChain: buildImpactChain(thesisText),
    collapsePoint,
    paragraphRankings,
    heatmap,
    graph: buildGraph(thesisText, claims),
    crossfireQuestions: questions.crossfire,
    judgeQuestions: questions.judge,
    readerConfusion,
    quoteIntegration,
    evidenceUpgrades,
    modelPasses,
    flow: buildFlow(),
    verdict,
  };

  return {
    ...partial,
    missions: buildMissions({
      unsupportedClaims: partial.unsupportedClaims,
      collapsePoint: partial.collapsePoint,
      scores: partial.scores,
    }),
  };
}

function renderList(items: string[], empty: string): string {
  if (items.length === 0) {
    return `- ${empty}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function supportRead(label: CertaintyLabel): string {
  switch (label) {
    case 'proven':
      return 'well supported in this draft';
    case 'likely':
      return 'supported, but still worth checking';
    case 'possible':
      return 'plausible with limited support';
    case 'exaggerated':
      return 'overstated for the support shown';
    case 'false-looking':
      return 'needs verification before a reader should trust it';
    case 'unsupported':
    default:
      return 'not supported yet';
  }
}

export function renderFractureAnalysis(analysis: FractureAnalysis): string {
  const score = analysis.scores;
  const claims = analysis.claims
    .slice(0, 6)
    .map(
      (claim) =>
        `- ${claim.id}, paragraph ${claim.paragraph}: ${claim.text}\n  Support read: ${supportRead(claim.certainty)}.\n  Reasoning note: ${claim.warrant}\n  Pressure point: ${claim.vulnerability}`,
    )
    .join('\n');
  const modelPasses = analysis.modelPasses
    .map((pass) => `- ${pass.model}: ${pass.diagnosis} Next revision move: ${pass.nextMove}`)
    .join('\n');

  return `FRACTURE VERDICT
${analysis.verdict.label} - ${analysis.verdict.reason}

ARGUMENT STRENGTH SCORE
Overall ${score.overall}/100
- Logic: ${score.logic}
- Evidence: ${score.evidence}
- Clarity: ${score.clarity}
- Originality: ${score.originality}
- Rebuttal strength: ${score.rebuttal}

THESIS STRESS TEST
Thesis: ${analysis.thesis.text}
${renderList(analysis.thesis.precision, 'Add a thesis before running the stress test.')}

CLAIM MAP
${claims || '- Add at least one claim sentence so the engine can map the argument.'}

HIDDEN ASSUMPTIONS
${renderList(analysis.assumptions, 'This pass did not flag an obvious hidden assumption.')}

UNSUPPORTED CLAIMS AND WARRANT GAPS
${renderList(
  analysis.unsupportedClaims.map((claim) => `${claim.id}: ${claim.text}. ${claim.warrant}`),
  'This pass did not flag an unsupported major claim.',
)}

REBUTTAL VULNERABILITY SCANNER
- Claim to pressure-test first: ${analysis.unsupportedClaims[0]?.text || analysis.collapsePoint}
- Counterexample to prepare for: an absolute, causal, or policy claim that lacks source support.
- Judge objection to prepare for: ${analysis.judgeQuestions[0] || 'A judge may ask whether the draft proves the thesis.'}
- Opponent response to prepare for: ${analysis.unsupportedClaims[0]?.vulnerability || 'Challenge the warrant and ask for source-to-claim proof.'}

CROSSFIRE QUESTIONS
${renderList(analysis.crossfireQuestions, 'No crossfire questions generated.')}

TEN-MODEL SPEAKING PASS
${modelPasses}

REVISION MISSIONS
${renderList(analysis.missions, 'No missions generated.')}

ARGUMENT FLOW
${renderList(analysis.flow, 'No flow generated.')}`;
}
