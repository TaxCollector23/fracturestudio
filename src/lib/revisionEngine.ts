import type { ClaimFinding, FractureAnalysis } from './fractureEngine';

export type ParagraphDiffKind = 'unchanged' | 'added' | 'removed' | 'modified';

export type ParagraphDiff = {
  id: string;
  kind: ParagraphDiffKind;
  beforeParagraph?: number;
  afterParagraph?: number;
  beforeText?: string;
  afterText?: string;
  wordDelta: number;
  similarity: number;
  summary: string;
};

export type RevisionMissionStatus = 'pending' | 'accepted' | 'rejected';

export type RevisionMissionSource = 'analysis' | 'claim' | 'collapse-point' | 'rebuttal' | 'impact';

export type RevisionMission = {
  id: string;
  text: string;
  status: RevisionMissionStatus;
  source: RevisionMissionSource;
  relatedClaimId?: string;
  paragraph?: number;
  reason: string;
  decisionNote?: string;
  decidedAt?: string;
  revisionText?: string;
};

export type MissionDecisionOptions = {
  note?: string;
  decidedAt?: string;
  revisionText?: string;
};

export type MissionStatusSummary = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  completionRate: number;
};

export type SuggestedRewriteKind = 'claim-evidence-warrant' | 'collapse-point' | 'counterargument' | 'impact' | 'thesis';

export type SuggestedRewrite = {
  id: string;
  missionId?: string;
  kind: SuggestedRewriteKind;
  title: string;
  target: string;
  before: string;
  after: string;
  rationale: string;
  claimId?: string;
  paragraph?: number;
  confidence: number;
};

export type RevisionScores = FractureAnalysis['scores'];
export type RevisionScoreKey = keyof RevisionScores;

export type RevisionScoreDelta = {
  before: RevisionScores;
  after: RevisionScores;
  delta: RevisionScores;
  direction: 'improved' | 'regressed' | 'unchanged';
  improved: RevisionScoreKey[];
  regressed: RevisionScoreKey[];
  summary: string;
};

export type RevisionHistoryEntry = {
  id: string;
  label?: string;
  text: string;
  analysis?: FractureAnalysis;
  missions?: RevisionMission[];
  suggestedRewrites?: SuggestedRewrite[];
  createdAt?: string;
  notes?: string[];
};

export type RevisionHistory = {
  title?: string;
  entries: RevisionHistoryEntry[];
};

type ParagraphUnit = {
  index: number;
  text: string;
  matchKey: string;
  words: string[];
};

const scoreKeys: RevisionScoreKey[] = ['overall', 'logic', 'evidence', 'clarity', 'originality', 'rebuttal'];

const absoluteReplacements: Record<string, string> = {
  always: 'often',
  never: 'rarely',
  everyone: 'many readers',
  'no one': 'few readers',
  guarantee: 'make more likely',
  guarantees: 'make more likely',
  inevitably: 'can',
  impossible: 'difficult',
  all: 'many',
};

function compactWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
}

function normalizeForCompare(value: string): string {
  return compactWhitespace(value).toLowerCase();
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function splitParagraphUnits(text: string): ParagraphUnit[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) {
    return [];
  }

  return clean
    .split(/\n\s*\n+/)
    .map((paragraph) => compactWhitespace(paragraph).replace(/\n+/g, ' '))
    .filter(Boolean)
    .map((paragraph, index) => ({
      index: index + 1,
      text: paragraph,
      matchKey: compactWhitespace(paragraph),
      words: words(paragraph),
    }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 2): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function overlapSimilarity(beforeWords: string[], afterWords: string[]): number {
  if (beforeWords.length === 0 && afterWords.length === 0) {
    return 1;
  }
  if (beforeWords.length === 0 || afterWords.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  beforeWords.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));

  let overlap = 0;
  afterWords.forEach((word) => {
    const count = counts.get(word) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(word, count - 1);
    }
  });

  return round((2 * overlap) / (beforeWords.length + afterWords.length));
}

function buildLcsAnchors(before: ParagraphUnit[], after: ParagraphUnit[]): Array<[number, number]> {
  const dp = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0) as number[]);

  for (let i = 1; i <= before.length; i += 1) {
    for (let j = 1; j <= after.length; j += 1) {
      if (before[i - 1].matchKey === after[j - 1].matchKey) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const anchors: Array<[number, number]> = [];
  let i = before.length;
  let j = after.length;
  while (i > 0 && j > 0) {
    if (before[i - 1].matchKey === after[j - 1].matchKey) {
      anchors.unshift([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return anchors;
}

function diffId(index: number): string {
  return `diff-${index + 1}`;
}

function addedDiff(index: number, paragraph: ParagraphUnit): ParagraphDiff {
  const wordDelta = paragraph.words.length;
  return {
    id: diffId(index),
    kind: 'added',
    afterParagraph: paragraph.index,
    afterText: paragraph.text,
    wordDelta,
    similarity: 0,
    summary: `Added paragraph ${paragraph.index} (${formatSigned(wordDelta)} words)`,
  };
}

function removedDiff(index: number, paragraph: ParagraphUnit): ParagraphDiff {
  const wordDelta = -paragraph.words.length;
  return {
    id: diffId(index),
    kind: 'removed',
    beforeParagraph: paragraph.index,
    beforeText: paragraph.text,
    wordDelta,
    similarity: 0,
    summary: `Removed paragraph ${paragraph.index} (${formatSigned(wordDelta)} words)`,
  };
}

function unchangedDiff(index: number, before: ParagraphUnit, after: ParagraphUnit): ParagraphDiff {
  return {
    id: diffId(index),
    kind: 'unchanged',
    beforeParagraph: before.index,
    afterParagraph: after.index,
    beforeText: before.text,
    afterText: after.text,
    wordDelta: after.words.length - before.words.length,
    similarity: 1,
    summary: `Kept paragraph ${before.index}`,
  };
}

function modifiedDiff(index: number, before: ParagraphUnit, after: ParagraphUnit): ParagraphDiff {
  const wordDelta = after.words.length - before.words.length;
  const similarity = overlapSimilarity(before.words, after.words);
  return {
    id: diffId(index),
    kind: 'modified',
    beforeParagraph: before.index,
    afterParagraph: after.index,
    beforeText: before.text,
    afterText: after.text,
    wordDelta,
    similarity,
    summary: `Revised paragraph ${before.index} -> ${after.index} (${formatSigned(wordDelta)} words, ${Math.round(similarity * 100)}% overlap)`,
  };
}

export function diffParagraphs(beforeText: string, afterText: string): ParagraphDiff[] {
  const before = splitParagraphUnits(beforeText);
  const after = splitParagraphUnits(afterText);
  const anchors = [...buildLcsAnchors(before, after), [before.length, after.length] as [number, number]];
  const diffs: ParagraphDiff[] = [];
  let beforeCursor = 0;
  let afterCursor = 0;

  anchors.forEach(([beforeAnchor, afterAnchor]) => {
    const beforeSpan = before.slice(beforeCursor, beforeAnchor);
    const afterSpan = after.slice(afterCursor, afterAnchor);
    const paired = Math.min(beforeSpan.length, afterSpan.length);

    for (let index = 0; index < paired; index += 1) {
      diffs.push(modifiedDiff(diffs.length, beforeSpan[index], afterSpan[index]));
    }

    beforeSpan.slice(paired).forEach((paragraph) => {
      diffs.push(removedDiff(diffs.length, paragraph));
    });

    afterSpan.slice(paired).forEach((paragraph) => {
      diffs.push(addedDiff(diffs.length, paragraph));
    });

    if (beforeAnchor < before.length && afterAnchor < after.length) {
      diffs.push(unchangedDiff(diffs.length, before[beforeAnchor], after[afterAnchor]));
    }

    beforeCursor = beforeAnchor + 1;
    afterCursor = afterAnchor + 1;
  });

  return diffs;
}

function hashText(value: string): string {
  let hash = 2166136261;
  const normalized = normalizeForCompare(value);
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0');
}

function missionId(text: string): string {
  return `mission-${hashText(text).slice(0, 8)}`;
}

function rewriteId(value: string): string {
  return `rewrite-${hashText(value).slice(0, 8)}`;
}

function inferMissionSource(text: string): RevisionMissionSource {
  const lower = text.toLowerCase();
  if (/claim-\d+/.test(lower) || lower.includes('prove claim')) {
    return 'claim';
  }
  if (lower.includes('collapse point') || lower.includes('protect the collapse')) {
    return 'collapse-point';
  }
  if (lower.includes('counterargument') || lower.includes('objection') || lower.includes('rebuttal')) {
    return 'rebuttal';
  }
  if (lower.includes('impact')) {
    return 'impact';
  }
  return 'analysis';
}

function relatedClaimId(text: string): string | undefined {
  return text.match(/\bclaim-\d+\b/i)?.[0].toLowerCase();
}

function missionReason(text: string, source: RevisionMissionSource, analysis: FractureAnalysis): string {
  const claimId = relatedClaimId(text);
  if (claimId) {
    const claim = analysis.claims.find((item) => item.id === claimId);
    return claim?.vulnerability ?? 'This mission targets a claim that needs clearer proof and warrant support.';
  }
  if (source === 'collapse-point') {
    return `The case is most vulnerable at: ${analysis.collapsePoint}`;
  }
  if (source === 'rebuttal') {
    return analysis.scores.rebuttal < 60
      ? 'Rebuttal is the lowest-pressure defense; add a fair objection before answering it.'
      : 'The case has rebuttal material, but it still needs sharper comparison and weighing.';
  }
  if (source === 'impact') {
    return 'The reader needs a clearer reason this argument matters more than alternatives.';
  }
  return 'Generated from the current Fracture analysis mission list.';
}

function missionParagraph(text: string, analysis: FractureAnalysis): number | undefined {
  const claimId = relatedClaimId(text);
  return claimId ? analysis.claims.find((claim) => claim.id === claimId)?.paragraph : undefined;
}

export function createRevisionMissions(analysis: FractureAnalysis, previous: RevisionMission[] = []): RevisionMission[] {
  const previousById = new Map(previous.map((mission) => [mission.id, mission]));
  const previousByText = new Map(previous.map((mission) => [normalizeForCompare(mission.text), mission]));

  return analysis.missions.map((text) => {
    const id = missionId(text);
    const existing = previousById.get(id) ?? previousByText.get(normalizeForCompare(text));
    const source = inferMissionSource(text);
    const claimId = relatedClaimId(text);

    return {
      id,
      text,
      status: existing?.status ?? 'pending',
      source,
      relatedClaimId: claimId,
      paragraph: missionParagraph(text, analysis),
      reason: existing?.reason ?? missionReason(text, source, analysis),
      decisionNote: existing?.decisionNote,
      decidedAt: existing?.decidedAt,
      revisionText: existing?.revisionText,
    };
  });
}

function decideMission(
  missions: RevisionMission[],
  missionIdToUpdate: string,
  status: Exclude<RevisionMissionStatus, 'pending'>,
  options: MissionDecisionOptions = {},
): RevisionMission[] {
  return missions.map((mission) => {
    if (mission.id !== missionIdToUpdate) {
      return mission;
    }

    return {
      ...mission,
      status,
      decisionNote: options.note,
      decidedAt: options.decidedAt,
      revisionText: options.revisionText,
    };
  });
}

export function acceptMission(
  missions: RevisionMission[],
  missionIdToAccept: string,
  options: MissionDecisionOptions = {},
): RevisionMission[] {
  return decideMission(missions, missionIdToAccept, 'accepted', options);
}

export function rejectMission(
  missions: RevisionMission[],
  missionIdToReject: string,
  options: MissionDecisionOptions = {},
): RevisionMission[] {
  return decideMission(missions, missionIdToReject, 'rejected', options);
}

export function summarizeMissionStatus(missions: RevisionMission[]): MissionStatusSummary {
  const summary = missions.reduce(
    (acc, mission) => {
      acc[mission.status] += 1;
      return acc;
    },
    { total: missions.length, pending: 0, accepted: 0, rejected: 0 },
  );
  const completed = summary.accepted + summary.rejected;
  return {
    ...summary,
    completionRate: summary.total === 0 ? 0 : round(completed / summary.total, 2),
  };
}

function ensurePeriod(value: string): string {
  const clean = compactWhitespace(value);
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function stripPrefix(value: string): string {
  return value.replace(/^(missing|thin|usable)\s+warrant:\s*/i, '').replace(/^hidden assumption:\s*/i, '').trim();
}

function lowerFirst(value: string): string {
  const clean = compactWhitespace(value);
  return clean ? `${clean[0].toLowerCase()}${clean.slice(1)}` : clean;
}

function qualifyOverreach(text: string): string {
  let result = compactWhitespace(text);
  Object.entries(absoluteReplacements).forEach(([absolute, replacement]) => {
    result = result.replace(new RegExp(`\\b${absolute}\\b`, 'gi'), (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return `${replacement[0].toUpperCase()}${replacement.slice(1)}`;
      }
      return replacement;
    });
  });
  return result;
}

function evidenceUpgradeFor(claim: ClaimFinding | undefined, analysis: FractureAnalysis): string {
  if (!claim) {
    return analysis.evidenceUpgrades[0] ?? 'Add one concrete source, example, or comparison that proves the key claim.';
  }

  return (
    analysis.evidenceUpgrades.find((upgrade) => upgrade.toLowerCase().includes(claim.id.toLowerCase())) ??
    claim.evidence[0] ??
    'Add one concrete source, example, or comparison that proves this exact claim.'
  );
}

function claimRewrite(claim: ClaimFinding, analysis: FractureAnalysis, mission?: RevisionMission): SuggestedRewrite {
  const qualified = ensurePeriod(qualifyOverreach(claim.text));
  const evidence = evidenceUpgradeFor(claim, analysis);
  const warrant = stripPrefix(claim.warrant);
  const after =
    claim.evidence.length > 0
      ? `${qualified} The evidence matters because ${lowerFirst(warrant)}`
      : `${qualified} ${ensurePeriod(evidence)} The paragraph should then explain why that proof answers the claim rather than merely sitting near it.`;

  return {
    id: rewriteId(`${mission?.id ?? claim.id}:claim`),
    missionId: mission?.id,
    kind: 'claim-evidence-warrant',
    title: `Rebuild ${claim.id}`,
    target: claim.text,
    before: claim.text,
    after,
    rationale: claim.vulnerability,
    claimId: claim.id,
    paragraph: claim.paragraph,
    confidence: round(clamp((analysis.scores.evidence + analysis.scores.logic) / 200, 0.35, 0.9)),
  };
}

function collapseRewrite(analysis: FractureAnalysis, mission?: RevisionMission): SuggestedRewrite {
  const target = analysis.collapsePoint;
  const after = `${ensurePeriod(qualifyOverreach(target))} The revision should define the key term, attach the strongest available evidence, and spell out how this point supports the thesis: ${ensurePeriod(analysis.thesis.text)}`;

  return {
    id: rewriteId(`${mission?.id ?? target}:collapse`),
    missionId: mission?.id,
    kind: 'collapse-point',
    title: 'Protect the collapse point',
    target,
    before: target,
    after,
    rationale: 'If this sentence falls, the rest of the case loses its load-bearing support.',
    confidence: round(clamp(analysis.scores.logic / 100, 0.35, 0.85)),
  };
}

function counterargumentRewrite(analysis: FractureAnalysis, mission?: RevisionMission): SuggestedRewrite {
  const target = analysis.unsupportedClaims[0]?.text ?? analysis.thesis.text;
  const after = `A fair objection is that the draft may overstate "${qualifyOverreach(target)}" or ignore a competing explanation. That objection matters because ${lowerFirst(analysis.burdenOfProof)} The answer should concede any overreach, add the best source, and weigh why the revised claim still matters more.`;

  return {
    id: rewriteId(`${mission?.id ?? target}:counterargument`),
    missionId: mission?.id,
    kind: 'counterargument',
    title: 'Add the strongest objection',
    target,
    before: target,
    after,
    rationale: analysis.judgeQuestions[0] ?? 'A judge or reader will ask whether the draft has answered its strongest objection.',
    confidence: round(clamp(analysis.scores.rebuttal / 100, 0.3, 0.8)),
  };
}

function impactRewrite(analysis: FractureAnalysis, mission?: RevisionMission): SuggestedRewrite {
  const target = analysis.impactChain.at(-1) ?? analysis.thesis.text;
  const after = `${ensurePeriod(target)} The final version should compare magnitude, probability, timeframe, and reversibility so the reader knows why this impact outweighs the alternative.`;

  return {
    id: rewriteId(`${mission?.id ?? target}:impact`),
    missionId: mission?.id,
    kind: 'impact',
    title: 'Sharpen impact weighing',
    target,
    before: target,
    after,
    rationale: 'Impact language turns a correct claim into a reason to care and act.',
    confidence: round(clamp(analysis.scores.overall / 100, 0.35, 0.85)),
  };
}

function thesisRewrite(analysis: FractureAnalysis, mission?: RevisionMission): SuggestedRewrite {
  const target = analysis.thesis.text;
  const after = `${ensurePeriod(qualifyOverreach(target))} This thesis should be followed by a sentence naming the main reason, the best evidence type, and the audience impact.`;

  return {
    id: rewriteId(`${mission?.id ?? target}:thesis`),
    missionId: mission?.id,
    kind: 'thesis',
    title: 'Tighten the thesis',
    target,
    before: target,
    after,
    rationale: analysis.thesis.precision.find((item) => /too short|needs|overconfident|broad/i.test(item)) ?? 'A sharper thesis makes the rest of the revision easier to aim.',
    confidence: round(clamp(analysis.thesis.score / 100, 0.35, 0.85)),
  };
}

function rewriteForMission(analysis: FractureAnalysis, mission: RevisionMission): SuggestedRewrite {
  if (mission.relatedClaimId) {
    const claim = analysis.claims.find((item) => item.id === mission.relatedClaimId);
    if (claim) {
      return claimRewrite(claim, analysis, mission);
    }
  }

  if (mission.source === 'collapse-point') {
    return collapseRewrite(analysis, mission);
  }

  if (mission.source === 'rebuttal') {
    return counterargumentRewrite(analysis, mission);
  }

  if (mission.source === 'impact') {
    return impactRewrite(analysis, mission);
  }

  const firstClaim = analysis.unsupportedClaims[0] ?? analysis.claims[0];
  return firstClaim ? claimRewrite(firstClaim, analysis, mission) : thesisRewrite(analysis, mission);
}

export function generateSuggestedRewrites(
  analysis: FractureAnalysis,
  missions: RevisionMission[] = createRevisionMissions(analysis),
): SuggestedRewrite[] {
  const rewrites = missions.map((mission) => rewriteForMission(analysis, mission));
  if (rewrites.length > 0) {
    return rewrites;
  }
  return [thesisRewrite(analysis)];
}

function scoresFrom(input: FractureAnalysis | RevisionScores): RevisionScores {
  return 'scores' in input ? input.scores : input;
}

function cloneScores(scores: RevisionScores): RevisionScores {
  return {
    overall: scores.overall,
    logic: scores.logic,
    evidence: scores.evidence,
    clarity: scores.clarity,
    originality: scores.originality,
    rebuttal: scores.rebuttal,
  };
}

export function calculateRevisionScoreDelta(
  beforeInput: FractureAnalysis | RevisionScores,
  afterInput: FractureAnalysis | RevisionScores,
): RevisionScoreDelta {
  const before = cloneScores(scoresFrom(beforeInput));
  const after = cloneScores(scoresFrom(afterInput));
  const delta = scoreKeys.reduce((acc, key) => {
    acc[key] = after[key] - before[key];
    return acc;
  }, {} as RevisionScores);
  const improved = scoreKeys.filter((key) => delta[key] > 0);
  const regressed = scoreKeys.filter((key) => delta[key] < 0);
  const direction = delta.overall > 0 ? 'improved' : delta.overall < 0 ? 'regressed' : 'unchanged';
  const summary =
    direction === 'unchanged'
      ? 'Overall score stayed flat.'
      : `Overall score ${direction} by ${formatSigned(delta.overall)} points.`;

  return { before, after, delta, direction, improved, regressed, summary };
}

function countWords(text: string): number {
  return words(text).length;
}

function truncate(value: string | undefined, max = 120): string {
  const clean = compactWhitespace(value ?? '').replace(/\n+/g, ' ');
  if (clean.length <= max) {
    return clean;
  }
  return `${clean.slice(0, max - 3).trim()}...`;
}

function escapeMarkdownCell(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function bulletList(items: string[] | undefined, empty: string): string {
  if (!items || items.length === 0) {
    return `- ${empty}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function missionTable(missions: RevisionMission[]): string {
  if (missions.length === 0) {
    return '- No missions tracked.';
  }

  const rows = missions.map(
    (mission) =>
      `| ${escapeMarkdownCell(mission.status)} | ${escapeMarkdownCell(mission.text)} | ${escapeMarkdownCell(mission.decisionNote ?? '')} |`,
  );
  return ['| Status | Mission | Note |', '| --- | --- | --- |', ...rows].join('\n');
}

function diffTable(diffs: ParagraphDiff[]): string {
  if (diffs.length === 0) {
    return '- No paragraph changes.';
  }

  const rows = diffs.map(
    (diff) =>
      `| ${escapeMarkdownCell(diff.kind)} | ${escapeMarkdownCell(diff.summary)} | ${escapeMarkdownCell(truncate(diff.beforeText))} | ${escapeMarkdownCell(truncate(diff.afterText))} |`,
  );
  return ['| Change | Summary | Before | After |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

function scoreBlock(entry: RevisionHistoryEntry): string {
  if (!entry.analysis) {
    return '- Score: not analyzed';
  }

  const scores = entry.analysis.scores;
  return `- Score: ${scores.overall}/100 overall (logic ${scores.logic}, evidence ${scores.evidence}, clarity ${scores.clarity}, rebuttal ${scores.rebuttal})`;
}

function scoreDeltaBlock(before: RevisionHistoryEntry, after: RevisionHistoryEntry): string {
  if (!before.analysis || !after.analysis) {
    return '- Score delta: not available';
  }

  const delta = calculateRevisionScoreDelta(before.analysis, after.analysis);
  return `- Score delta: ${delta.summary} Logic ${formatSigned(delta.delta.logic)}, evidence ${formatSigned(delta.delta.evidence)}, clarity ${formatSigned(delta.delta.clarity)}, rebuttal ${formatSigned(delta.delta.rebuttal)}.`;
}

function suggestionList(suggestions: SuggestedRewrite[] | undefined): string {
  if (!suggestions || suggestions.length === 0) {
    return '- No suggested rewrites recorded.';
  }

  return suggestions
    .map((suggestion) => `- ${suggestion.title}: ${truncate(suggestion.after, 180)}`)
    .join('\n');
}

export function exportRevisionHistoryMarkdown(historyInput: RevisionHistory | RevisionHistoryEntry[]): string {
  const history = Array.isArray(historyInput) ? { title: 'Revision History', entries: historyInput } : historyInput;
  const title = history.title || 'Revision History';

  if (history.entries.length === 0) {
    return `# ${title}\n\nNo revisions recorded.`;
  }

  const sections = history.entries.map((entry, index) => {
    const previous = history.entries[index - 1];
    const missionSummary = summarizeMissionStatus(entry.missions ?? []);
    const heading = `## ${index + 1}. ${entry.label || entry.id}`;
    const meta = [
      entry.createdAt ? `- Created: ${entry.createdAt}` : undefined,
      `- Words: ${entry.analysis?.wordCount ?? countWords(entry.text)}`,
      scoreBlock(entry),
      entry.missions
        ? `- Missions: ${missionSummary.accepted} accepted, ${missionSummary.rejected} rejected, ${missionSummary.pending} pending`
        : undefined,
      previous ? scoreDeltaBlock(previous, entry) : undefined,
    ]
      .filter(Boolean)
      .join('\n');
    const diff = previous ? `\n\n### Paragraph Diff\n${diffTable(diffParagraphs(previous.text, entry.text))}` : '';
    const missions = entry.missions ? `\n\n### Mission Status\n${missionTable(entry.missions)}` : '';
    const suggestions = entry.suggestedRewrites ? `\n\n### Suggested Rewrites\n${suggestionList(entry.suggestedRewrites)}` : '';
    const notes = entry.notes ? `\n\n### Notes\n${bulletList(entry.notes, 'No notes recorded.')}` : '';

    return `${heading}\n${meta}${diff}${missions}${suggestions}${notes}`;
  });

  return [`# ${title}`, ...sections].join('\n\n');
}
