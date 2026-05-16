import type { CitationSource } from './citationEngine';

export type EvidenceFreshnessSensitivity = 'fast-moving' | 'standard' | 'historical';

export type EvidenceFreshnessStatus = 'current' | 'aging' | 'stale' | 'undated' | 'future-dated' | 'archival';

export type CredibilityLabel = 'strong' | 'usable' | 'weak' | 'risky';

export type SourceClaimMatchLabel = 'strong' | 'partial' | 'weak' | 'none';

export type CitationHallucinationRiskLevel = 'low' | 'medium' | 'high';

export type EvidenceUpgradeKind =
  | 'authority'
  | 'freshness'
  | 'bias'
  | 'relevance'
  | 'metadata'
  | 'corroboration'
  | 'conflict';

export type SourceConflictKind = 'metadata' | 'stance' | 'numeric' | 'date';

export type EvidenceScoringOptions = {
  claimText?: string;
  asOfYear?: number;
  staleAfterYears?: number;
  freshnessSensitivity?: EvidenceFreshnessSensitivity;
};

export type EvidenceFreshness = {
  sourceId: string;
  year?: number;
  asOfYear: number;
  ageYears?: number;
  status: EvidenceFreshnessStatus;
  score: number;
  needsUpdate: boolean;
  reason: string;
  recommendation: string;
};

export type SourceClaimMatchScore = {
  sourceId: string;
  claim: string;
  score: number;
  label: SourceClaimMatchLabel;
  overlapTerms: string[];
  missingClaimTerms: string[];
  matchedNumbers: string[];
  missingClaimNumbers: string[];
  reasons: string[];
};

export type SourceCredibilityScore = {
  sourceId: string;
  overall: number;
  label: CredibilityLabel;
  authority: number;
  recency: number;
  bias: number;
  relevance: number;
  metadataCompleteness: number;
  reasons: string[];
  recommendations: string[];
};

export type CitationHallucinationRiskAssessment = {
  sourceId: string;
  riskScore: number;
  level: CitationHallucinationRiskLevel;
  missingFields: string[];
  suspiciousFields: string[];
  reasons: string[];
  recommendations: string[];
};

export type EvidenceUpgradeRecommendation = {
  sourceId?: string;
  claim?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  kind: EvidenceUpgradeKind;
  recommendation: string;
  reason: string;
};

export type SourceConflict = {
  sourceIds: [string, string];
  kind: SourceConflictKind;
  severity: 1 | 2 | 3 | 4 | 5;
  summary: string;
  evidence: string[];
  recommendation: string;
};

export type EvidenceEngineInput = EvidenceScoringOptions & {
  sources: CitationSource[];
  claims?: string[] | string;
};

export type EvidenceEngineReport = {
  asOfYear: number;
  credibilityScores: SourceCredibilityScore[];
  freshness: EvidenceFreshness[];
  sourceClaimMatches: SourceClaimMatchScore[];
  hallucinationRisks: CitationHallucinationRiskAssessment[];
  upgradeRecommendations: EvidenceUpgradeRecommendation[];
  conflicts: SourceConflict[];
};

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'also',
  'among',
  'because',
  'before',
  'being',
  'between',
  'could',
  'does',
  'from',
  'have',
  'into',
  'itself',
  'more',
  'most',
  'only',
  'other',
  'over',
  'same',
  'should',
  'some',
  'such',
  'than',
  'that',
  'their',
  'there',
  'these',
  'this',
  'those',
  'through',
  'under',
  'using',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
]);

const HIGH_AUTHORITY_DOMAINS = [
  '.gov',
  '.edu',
  '.mil',
  'bls.gov',
  'cdc.gov',
  'census.gov',
  'ec.europa.eu',
  'fda.gov',
  'federalreserve.gov',
  'nih.gov',
  'noaa.gov',
  'oecd.org',
  'un.org',
  'who.int',
  'worldbank.org',
];

const SCHOLARLY_SIGNALS = [
  'academic press',
  'conference proceedings',
  'doi',
  'journal',
  'jstor',
  'lancet',
  'meta-analysis',
  'nature',
  'nejm',
  'peer review',
  'peer-reviewed',
  'proceedings',
  'pubmed',
  'randomized',
  'science',
  'systematic review',
  'university press',
];

const LOW_AUTHORITY_SIGNALS = [
  'anonymous',
  'blog',
  'editorial',
  'forum',
  'medium.com',
  'opinion',
  'personal website',
  'quora',
  'reddit',
  'substack',
  'wordpress',
];

const LOADED_LANGUAGE_SIGNALS = [
  'agenda',
  'catastrophe',
  'corrupt',
  'destroy',
  'disaster',
  'evil',
  'exposed',
  'hoax',
  'miracle',
  'propaganda',
  'radical',
  'secret',
  'shocking',
  'traitor',
];

const ADVOCACY_SIGNALS = ['action fund', 'campaign', 'foundation', 'institute', 'lobby', 'pac', 'petition', 'think tank'];

const METHOD_TRANSPARENCY_SIGNALS = [
  'census',
  'dataset',
  'methodology',
  'random sample',
  'randomized',
  'sample size',
  'survey',
  'trial',
];

const POSITIVE_STANCE_SIGNALS = ['benefit', 'beneficial', 'effective', 'improve', 'improves', 'improved', 'support', 'supports'];
const NEGATIVE_STANCE_SIGNALS = ['fails', 'harm', 'harms', 'ineffective', 'no effect', 'oppose', 'opposes', 'worse', 'worsens'];
const INCREASE_SIGNALS = ['higher', 'increase', 'increased', 'increases', 'more', 'rise', 'rising'];
const DECREASE_SIGNALS = ['decline', 'decrease', 'decreased', 'decreases', 'less', 'lower', 'reduced', 'reduces'];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asPriority(value: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
}

function getAsOfYear(asOfYear?: number): number {
  if (Number.isFinite(asOfYear) && asOfYear && asOfYear >= 1900 && asOfYear <= 2200) {
    return Math.round(asOfYear);
  }
  return new Date().getFullYear();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%.\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeToken(token: string): string {
  let clean = token.toLowerCase().replace(/^'+|'+$/g, '');
  if (clean.length > 5 && clean.endsWith('ing')) {
    clean = clean.slice(0, -3);
  } else if (clean.length > 4 && clean.endsWith('ed')) {
    clean = clean.slice(0, -2);
  } else if (clean.length > 4 && clean.endsWith('es')) {
    clean = clean.slice(0, -2);
  } else if (clean.length > 3 && clean.endsWith('s')) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

function significantTerms(text: string): string[] {
  const seen = new Set<string>();
  const tokens = normalizeText(text).match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
  tokens.forEach((token) => {
    const clean = normalizeToken(token);
    if (clean.length < 3 || STOP_WORDS.has(clean)) {
      return;
    }
    seen.add(clean);
  });
  return [...seen].sort();
}

function includesAny(text: string, signals: string[]): boolean {
  const normalized = normalizeText(text);
  return signals.some((signal) => normalized.includes(signal));
}

function countSignals(text: string, signals: string[]): number {
  const normalized = normalizeText(text);
  return signals.reduce((count, signal) => count + (normalized.includes(signal) ? 1 : 0), 0);
}

function sourceText(source: CitationSource): string {
  return [
    source.title,
    source.raw,
    source.publisher,
    source.container,
    source.url,
    source.doi,
    source.credibility,
    source.authors?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

function sourceDomain(source: CitationSource): string | undefined {
  if (!source.url) {
    return undefined;
  }

  try {
    return new URL(source.url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function parseSourceYear(source: CitationSource): number | undefined {
  const direct = source.year?.match(/\b(18|19|20|21)\d{2}\b/)?.[0];
  const fromRaw = source.raw.match(/\b(18|19|20|21)\d{2}\b/)?.[0];
  const year = Number(direct ?? fromRaw);
  return Number.isFinite(year) ? year : undefined;
}

function extractNumbers(text: string): string[] {
  const seen = new Set<string>();
  const matches = normalizeText(text).match(/\b\d+(?:\.\d+)?%?/g) ?? [];
  matches.forEach((match) => {
    const numeric = Number(match.replace('%', ''));
    if (Number.isFinite(numeric) && numeric >= 1800 && numeric <= 2200 && !match.includes('%')) {
      return;
    }
    seen.add(match);
  });
  return [...seen].sort((a, b) => Number(a.replace('%', '')) - Number(b.replace('%', '')));
}

function metadataStatus(source: CitationSource): { score: number; missingFields: string[] } {
  const missing = new Set<string>();
  const year = parseSourceYear(source);

  if (!source.authors?.length) {
    missing.add('author');
  }
  if (!source.title?.trim()) {
    missing.add('title');
  }
  if (!year) {
    missing.add('year');
  }
  if (!source.publisher?.trim() && !source.container?.trim()) {
    missing.add('publisher/container');
  }
  if (!source.url?.trim() && !source.doi?.trim()) {
    missing.add('url/doi');
  }

  (source.missingFields ?? []).forEach((field) => missing.add(field));

  return {
    score: clampScore(100 - missing.size * 20 + (source.doi ? 5 : 0)),
    missingFields: [...missing],
  };
}

function scoreAuthority(source: CitationSource): { score: number; reasons: string[] } {
  const text = sourceText(source);
  const domain = sourceDomain(source);
  const reasons: string[] = [];
  let score = 42;

  if (source.doi) {
    score += 22;
    reasons.push('DOI present, which improves source traceability.');
  }

  if (source.authors?.length) {
    score += source.authors.length > 1 ? 12 : 8;
    reasons.push('Named author metadata is present.');
  }

  if (source.publisher || source.container) {
    score += 10;
    reasons.push('Publisher or container metadata is present.');
  }

  if (domain && HIGH_AUTHORITY_DOMAINS.some((trusted) => domain.endsWith(trusted) || domain === trusted.replace(/^\./, ''))) {
    score += 20;
    reasons.push(`Authority signal from ${domain}.`);
  }

  if (includesAny(text, SCHOLARLY_SIGNALS)) {
    score += 16;
    reasons.push('Scholarly or peer-review signal detected.');
  }

  if (includesAny(text, LOW_AUTHORITY_SIGNALS)) {
    score -= 24;
    reasons.push('Lower-authority publication signal detected.');
  }

  if (!source.authors?.length && !source.publisher && !source.container && !source.doi) {
    score -= 15;
    reasons.push('Core authorship and publication authority metadata is thin.');
  }

  return { score: clampScore(score), reasons };
}

function scoreBias(source: CitationSource): { score: number; reasons: string[] } {
  const text = sourceText(source);
  const reasons: string[] = [];
  let score = 78;

  const loadedCount = countSignals(text, LOADED_LANGUAGE_SIGNALS);
  if (loadedCount > 0) {
    score -= loadedCount * 9;
    reasons.push('Loaded language signal detected.');
  }

  if (includesAny(text, ADVOCACY_SIGNALS)) {
    score -= 10;
    reasons.push('Advocacy or institutional-persuasion signal detected.');
  }

  if (includesAny(text, ['opinion', 'editorial', 'commentary'])) {
    score -= 18;
    reasons.push('Opinion format should be balanced with factual reporting or primary data.');
  }

  if (includesAny(text, METHOD_TRANSPARENCY_SIGNALS)) {
    score += 10;
    reasons.push('Method transparency signal detected.');
  }

  if (includesAny(text, ['systematic review', 'meta-analysis', 'census'])) {
    score += 8;
    reasons.push('Broad evidence method reduces single-source bias risk.');
  }

  return { score: clampScore(score), reasons };
}

function credibilityLabel(score: number): CredibilityLabel {
  if (score >= 80) {
    return 'strong';
  }
  if (score >= 65) {
    return 'usable';
  }
  if (score >= 45) {
    return 'weak';
  }
  return 'risky';
}

function matchLabel(score: number): SourceClaimMatchLabel {
  if (score >= 75) {
    return 'strong';
  }
  if (score >= 50) {
    return 'partial';
  }
  if (score >= 25) {
    return 'weak';
  }
  return 'none';
}

function riskLevel(score: number): CitationHallucinationRiskLevel {
  if (score >= 67) {
    return 'high';
  }
  if (score >= 34) {
    return 'medium';
  }
  return 'low';
}

function sourceIdentityKey(source: CitationSource): string | undefined {
  if (source.doi) {
    return `doi:${source.doi.toLowerCase().replace(/^https?:\/\/doi\.org\//, '')}`;
  }
  if (source.url) {
    try {
      const url = new URL(source.url);
      return `url:${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/$/, '')}`;
    } catch {
      return `url:${source.url.toLowerCase()}`;
    }
  }
  if (source.title) {
    const terms = significantTerms(source.title);
    if (terms.length >= 3) {
      return `title:${terms.join('-')}`;
    }
  }
  return undefined;
}

function hasHistoricalSignal(source: CitationSource): boolean {
  return includesAny(sourceText(source), ['archive', 'archival', 'diary', 'historical', 'letter', 'memoir', 'primary source']);
}

function freshnessThreshold(options: EvidenceScoringOptions, source: CitationSource): number {
  if (options.staleAfterYears && options.staleAfterYears > 0) {
    return options.staleAfterYears;
  }
  if (options.freshnessSensitivity === 'fast-moving') {
    return 3;
  }
  if (options.freshnessSensitivity === 'historical' || hasHistoricalSignal(source)) {
    return 50;
  }
  return 6;
}

export function detectEvidenceFreshness(source: CitationSource, options: EvidenceScoringOptions = {}): EvidenceFreshness {
  const asOfYear = getAsOfYear(options.asOfYear);
  const year = parseSourceYear(source);

  if (!year) {
    return {
      sourceId: source.id,
      asOfYear,
      status: 'undated',
      score: 30,
      needsUpdate: true,
      reason: 'No publication year was found in source metadata.',
      recommendation: 'Verify the publication date before relying on this evidence.',
    };
  }

  const ageYears = asOfYear - year;
  if (ageYears < 0) {
    return {
      sourceId: source.id,
      year,
      asOfYear,
      ageYears,
      status: 'future-dated',
      score: 5,
      needsUpdate: true,
      reason: `Source year ${year} is after the analysis year ${asOfYear}.`,
      recommendation: 'Check the date field for citation hallucination or metadata parsing error.',
    };
  }

  const threshold = freshnessThreshold(options, source);
  if (threshold >= 25 && ageYears > 10) {
    return {
      sourceId: source.id,
      year,
      asOfYear,
      ageYears,
      status: 'archival',
      score: clampScore(92 - Math.min(22, ageYears / 4)),
      needsUpdate: false,
      reason: 'Older evidence appears acceptable for a historical or primary-source context.',
      recommendation: 'Use it as historical grounding and add a modern source only if the claim is about current conditions.',
    };
  }

  const status: EvidenceFreshnessStatus =
    ageYears <= Math.max(1, Math.floor(threshold / 2)) ? 'current' : ageYears <= threshold ? 'aging' : 'stale';
  const score =
    status === 'current'
      ? 95
      : status === 'aging'
        ? clampScore(82 - ageYears)
        : clampScore(Math.max(18, 68 - (ageYears - threshold) * 5));

  return {
    sourceId: source.id,
    year,
    asOfYear,
    ageYears,
    status,
    score,
    needsUpdate: status === 'stale',
    reason:
      status === 'current'
        ? `Source is ${ageYears} years old against a ${threshold}-year freshness threshold.`
        : status === 'aging'
          ? `Source is approaching the ${threshold}-year freshness threshold.`
          : `Source is older than the ${threshold}-year freshness threshold.`,
    recommendation:
      status === 'stale'
        ? 'Add a newer source or explain why this older evidence is still authoritative.'
        : 'Freshness is acceptable for the selected topic sensitivity.',
  };
}

export function scoreSourceClaimMatch(source: CitationSource, claim: string): SourceClaimMatchScore {
  const claimTerms = significantTerms(claim);
  const sourceTerms = significantTerms(sourceText(source));
  const titleTerms = significantTerms(source.title ?? '');
  const sourceTermSet = new Set(sourceTerms);
  const titleTermSet = new Set(titleTerms);
  const overlapTerms = claimTerms.filter((term) => sourceTermSet.has(term));
  const titleOverlapTerms = claimTerms.filter((term) => titleTermSet.has(term));
  const missingClaimTerms = claimTerms.filter((term) => !sourceTermSet.has(term));
  const claimNumbers = extractNumbers(claim);
  const sourceNumbers = extractNumbers(sourceText(source));
  const sourceNumberSet = new Set(sourceNumbers);
  const matchedNumbers = claimNumbers.filter((number) => sourceNumberSet.has(number));
  const missingClaimNumbers = claimNumbers.filter((number) => !sourceNumberSet.has(number));
  const reasons: string[] = [];

  if (claimTerms.length === 0) {
    return {
      sourceId: source.id,
      claim,
      score: 50,
      label: 'partial',
      overlapTerms: [],
      missingClaimTerms: [],
      matchedNumbers,
      missingClaimNumbers,
      reasons: ['Claim text has too few content terms for a precise match score.'],
    };
  }

  const coverage = overlapTerms.length / claimTerms.length;
  const titleCoverage = titleOverlapTerms.length / claimTerms.length;
  const normalizedSource = normalizeText(sourceText(source));
  const normalizedClaim = normalizeText(claim);
  const phraseBonus = normalizedClaim.length > 20 && normalizedSource.includes(normalizedClaim) ? 10 : 0;
  const numberAdjustment = matchedNumbers.length * 6 - missingClaimNumbers.length * 8;
  const score = clampScore(15 + coverage * 64 + titleCoverage * 14 + phraseBonus + numberAdjustment);

  if (overlapTerms.length > 0) {
    reasons.push(`Shared claim terms: ${overlapTerms.slice(0, 8).join(', ')}.`);
  }
  if (missingClaimTerms.length > 0) {
    reasons.push(`Missing claim terms: ${missingClaimTerms.slice(0, 8).join(', ')}.`);
  }
  if (missingClaimNumbers.length > 0) {
    reasons.push(`Claim numbers not found in source metadata: ${missingClaimNumbers.join(', ')}.`);
  }
  if (phraseBonus > 0) {
    reasons.push('The full claim phrase appears in the source text.');
  }

  return {
    sourceId: source.id,
    claim,
    score,
    label: matchLabel(score),
    overlapTerms,
    missingClaimTerms,
    matchedNumbers,
    missingClaimNumbers,
    reasons,
  };
}

export function scoreSourceCredibility(source: CitationSource, options: EvidenceScoringOptions = {}): SourceCredibilityScore {
  const authority = scoreAuthority(source);
  const bias = scoreBias(source);
  const metadata = metadataStatus(source);
  const freshness = detectEvidenceFreshness(source, options);
  const relevance = options.claimText ? scoreSourceClaimMatch(source, options.claimText) : undefined;
  const relevanceScore = relevance?.score ?? 50;
  const reasons = [
    ...authority.reasons,
    ...bias.reasons,
    freshness.reason,
    ...(relevance?.reasons ?? ['No claim text supplied, so relevance is held neutral.']),
  ];
  const overall = clampScore(
    authority.score * 0.27 + freshness.score * 0.18 + bias.score * 0.18 + relevanceScore * 0.22 + metadata.score * 0.15,
  );
  const recommendations: string[] = [];

  if (authority.score < 60) {
    recommendations.push('Pair this source with a more authoritative source such as a government, academic, or peer-reviewed publication.');
  }
  if (freshness.needsUpdate) {
    recommendations.push(freshness.recommendation);
  }
  if (bias.score < 65) {
    recommendations.push('Balance this source with a less advocacy-driven or more method-transparent source.');
  }
  if (relevanceScore < 60) {
    recommendations.push('Use a source that names the claim topic more directly.');
  }
  if (metadata.score < 80) {
    recommendations.push(`Fill missing citation metadata: ${metadata.missingFields.join(', ')}.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Source is credible enough for draft use; still verify it supports the exact claim before citing.');
  }

  return {
    sourceId: source.id,
    overall,
    label: credibilityLabel(overall),
    authority: authority.score,
    recency: freshness.score,
    bias: bias.score,
    relevance: relevanceScore,
    metadataCompleteness: metadata.score,
    reasons,
    recommendations,
  };
}

export function assessCitationHallucinationRisk(source: CitationSource, options: EvidenceScoringOptions = {}): CitationHallucinationRiskAssessment {
  const metadata = metadataStatus(source);
  const year = parseSourceYear(source);
  const asOfYear = getAsOfYear(options.asOfYear);
  const suspiciousFields: string[] = [];
  const reasons: string[] = [];
  let riskScore = metadata.missingFields.length * 14;

  if (!source.url && !source.doi) {
    riskScore += 15;
    reasons.push('No URL or DOI is present for verification.');
  }

  if (source.url) {
    try {
      new URL(source.url);
    } catch {
      riskScore += 20;
      suspiciousFields.push('url');
      reasons.push('URL is not parseable.');
    }
  }

  if (source.doi && !/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i.test(source.doi)) {
    riskScore += 18;
    suspiciousFields.push('doi');
    reasons.push('DOI format looks invalid.');
  }

  if (year && year > asOfYear) {
    riskScore += 25;
    suspiciousFields.push('year');
    reasons.push(`Year ${year} is after the analysis year ${asOfYear}.`);
  }

  const domain = sourceDomain(source);
  if (domain && source.title && normalizeText(source.title) === normalizeText(domain) && !source.authors?.length) {
    riskScore += 10;
    suspiciousFields.push('title');
    reasons.push('Title appears to be only a hostname, which suggests incomplete scraped metadata.');
  }

  if (includesAny(source.credibility ?? '', ['needs source review', 'parsed from pasted text'])) {
    riskScore += 10;
    reasons.push('Existing citation metadata says the source still needs review.');
  }

  if (metadata.missingFields.length > 0) {
    reasons.push(`Missing fields increase hallucination risk: ${metadata.missingFields.join(', ')}.`);
  }

  const risk = clampScore(riskScore);
  const recommendations =
    risk >= 67
      ? ['Do not format this as final citation metadata until the missing or suspicious fields are verified.']
      : risk >= 34
        ? ['Verify the missing fields before final submission; mark unknown fields instead of inventing them.']
        : ['Citation metadata is low risk, but source-to-claim support still needs manual verification.'];

  return {
    sourceId: source.id,
    riskScore: risk,
    level: riskLevel(risk),
    missingFields: metadata.missingFields,
    suspiciousFields,
    reasons,
    recommendations,
  };
}

function sourcePairTerms(source: CitationSource): string[] {
  return significantTerms([source.title, source.raw, source.publisher, source.container].filter(Boolean).join(' '));
}

function numericValuesForConflict(source: CitationSource): string[] {
  return extractNumbers([source.title, source.raw].filter(Boolean).join(' ')).slice(0, 6);
}

function stanceFor(text: string): { positive: boolean; negative: boolean; increase: boolean; decrease: boolean } {
  return {
    positive: includesAny(text, POSITIVE_STANCE_SIGNALS),
    negative: includesAny(text, NEGATIVE_STANCE_SIGNALS),
    increase: includesAny(text, INCREASE_SIGNALS),
    decrease: includesAny(text, DECREASE_SIGNALS),
  };
}

function addConflict(conflicts: SourceConflict[], conflict: SourceConflict): void {
  const duplicate = conflicts.some(
    (existing) =>
      existing.kind === conflict.kind &&
      existing.sourceIds[0] === conflict.sourceIds[0] &&
      existing.sourceIds[1] === conflict.sourceIds[1],
  );
  if (!duplicate) {
    conflicts.push(conflict);
  }
}

export function detectSourceConflicts(sources: CitationSource[]): SourceConflict[] {
  const conflicts: SourceConflict[] = [];
  const byIdentity = new Map<string, CitationSource[]>();

  sources.forEach((source) => {
    const key = sourceIdentityKey(source);
    if (!key) {
      return;
    }
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), source]);
  });

  byIdentity.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i];
        const right = group[j];
        const leftYear = parseSourceYear(left);
        const rightYear = parseSourceYear(right);
        const differences: string[] = [];
        if (leftYear && rightYear && leftYear !== rightYear) {
          differences.push(`year ${leftYear} vs ${rightYear}`);
        }
        if ((left.publisher || left.container) && (right.publisher || right.container)) {
          const leftPublisher = normalizeText(left.publisher || left.container || '');
          const rightPublisher = normalizeText(right.publisher || right.container || '');
          if (leftPublisher && rightPublisher && leftPublisher !== rightPublisher) {
            differences.push(`publisher/container ${left.publisher || left.container} vs ${right.publisher || right.container}`);
          }
        }
        if (differences.length > 0) {
          addConflict(conflicts, {
            sourceIds: [left.id, right.id],
            kind: 'metadata',
            severity: 4,
            summary: 'Sources appear to describe the same citation but disagree on metadata.',
            evidence: differences,
            recommendation: 'Verify the original source record and keep one canonical citation entry.',
          });
        }
      }
    }
  });

  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const left = sources[i];
      const right = sources[j];
      const leftTerms = sourcePairTerms(left);
      const rightTerms = sourcePairTerms(right);
      const rightSet = new Set(rightTerms);
      const sharedTerms = leftTerms.filter((term) => rightSet.has(term));
      if (sharedTerms.length < 2) {
        continue;
      }

      const leftStance = stanceFor(sourceText(left));
      const rightStance = stanceFor(sourceText(right));
      const stanceConflict =
        (leftStance.positive && rightStance.negative) ||
        (leftStance.negative && rightStance.positive) ||
        (leftStance.increase && rightStance.decrease) ||
        (leftStance.decrease && rightStance.increase);

      if (stanceConflict) {
        addConflict(conflicts, {
          sourceIds: [left.id, right.id],
          kind: 'stance',
          severity: 4,
          summary: `Sources share topic terms but point in opposite directions: ${sharedTerms.slice(0, 5).join(', ')}.`,
          evidence: [left.title || left.raw, right.title || right.raw],
          recommendation: 'Resolve the disagreement in the draft or add a higher-authority source that explains the split.',
        });
      }

      const leftNumbers = numericValuesForConflict(left);
      const rightNumbers = numericValuesForConflict(right);
      const sharedNumberSet = new Set(leftNumbers);
      const hasDifferentNumbers = leftNumbers.length > 0 && rightNumbers.length > 0 && rightNumbers.some((number) => !sharedNumberSet.has(number));
      if (hasDifferentNumbers) {
        addConflict(conflicts, {
          sourceIds: [left.id, right.id],
          kind: 'numeric',
          severity: 3,
          summary: `Sources discuss overlapping terms with different numeric values: ${sharedTerms.slice(0, 5).join(', ')}.`,
          evidence: [`${left.id}: ${leftNumbers.join(', ')}`, `${right.id}: ${rightNumbers.join(', ')}`],
          recommendation: 'Check whether the figures measure the same population, year, geography, or denominator.',
        });
      }

      const leftYear = parseSourceYear(left);
      const rightYear = parseSourceYear(right);
      if (leftYear && rightYear && Math.abs(leftYear - rightYear) >= 10 && sharedTerms.length >= 3) {
        addConflict(conflicts, {
          sourceIds: [left.id, right.id],
          kind: 'date',
          severity: 2,
          summary: 'Sources cover the same topic with a large publication-year gap.',
          evidence: [`${left.id}: ${leftYear}`, `${right.id}: ${rightYear}`],
          recommendation: 'Use the older source for background only unless the claim is historical.',
        });
      }
    }
  }

  return conflicts.sort((a, b) => b.severity - a.severity).slice(0, 12);
}

function normalizeClaims(input?: string[] | string): string[] {
  if (Array.isArray(input)) {
    return input.map((claim) => claim.trim()).filter(Boolean);
  }
  if (!input?.trim()) {
    return [];
  }
  return input
    .split(/(?<=[.!?])\s+|\n+/)
    .map((claim) => claim.trim())
    .filter(Boolean);
}

function pushUniqueRecommendation(items: EvidenceUpgradeRecommendation[], item: EvidenceUpgradeRecommendation): void {
  const key = `${item.kind}|${item.sourceId ?? ''}|${item.claim ?? ''}|${item.recommendation}`;
  const exists = items.some((existing) => `${existing.kind}|${existing.sourceId ?? ''}|${existing.claim ?? ''}|${existing.recommendation}` === key);
  if (!exists) {
    items.push(item);
  }
}

export function recommendEvidenceUpgrades(input: EvidenceEngineInput): EvidenceUpgradeRecommendation[] {
  const claims = normalizeClaims(input.claims ?? input.claimText);
  const recommendations: EvidenceUpgradeRecommendation[] = [];
  const minCredibilityScore = input.claimText ? 65 : 60;
  const minMatchScore = 58;

  if (input.sources.length === 0) {
    return [
      {
        priority: 5,
        kind: 'corroboration',
        recommendation: 'Add at least two independently published sources before relying on the claim set.',
        reason: 'No evidence sources were supplied.',
      },
    ];
  }

  input.sources.forEach((source) => {
    const credibility = scoreSourceCredibility(source, input);
    const freshness = detectEvidenceFreshness(source, input);
    const hallucination = assessCitationHallucinationRisk(source, input);

    if (credibility.authority < 60) {
      pushUniqueRecommendation(recommendations, {
        sourceId: source.id,
        priority: asPriority(4),
        kind: 'authority',
        recommendation: 'Upgrade or corroborate with a higher-authority source.',
        reason: `Authority score is ${credibility.authority}/100.`,
      });
    }

    if (freshness.needsUpdate) {
      pushUniqueRecommendation(recommendations, {
        sourceId: source.id,
        priority: asPriority(freshness.status === 'future-dated' ? 5 : 4),
        kind: 'freshness',
        recommendation: freshness.recommendation,
        reason: freshness.reason,
      });
    }

    if (credibility.bias < 65) {
      pushUniqueRecommendation(recommendations, {
        sourceId: source.id,
        priority: 3,
        kind: 'bias',
        recommendation: 'Balance this source with a neutral data source or a source from the opposing perspective.',
        reason: `Bias score is ${credibility.bias}/100.`,
      });
    }

    if (credibility.metadataCompleteness < 80 || hallucination.level === 'high') {
      pushUniqueRecommendation(recommendations, {
        sourceId: source.id,
        priority: asPriority(hallucination.level === 'high' ? 5 : 3),
        kind: 'metadata',
        recommendation: `Verify missing or suspicious citation fields: ${[...hallucination.missingFields, ...hallucination.suspiciousFields].join(', ')}.`,
        reason: `Citation hallucination risk is ${hallucination.level}.`,
      });
    }

    if (credibility.overall < minCredibilityScore) {
      pushUniqueRecommendation(recommendations, {
        sourceId: source.id,
        priority: 3,
        kind: 'corroboration',
        recommendation: 'Use this source only with corroboration from a stronger source.',
        reason: `Overall credibility score is ${credibility.overall}/100.`,
      });
    }
  });

  claims.forEach((claim) => {
    const matches = input.sources
      .map((source) => scoreSourceClaimMatch(source, claim))
      .sort((a, b) => b.score - a.score);
    const best = matches[0];
    if (!best || best.score < minMatchScore) {
      pushUniqueRecommendation(recommendations, {
        claim,
        sourceId: best?.sourceId,
        priority: 5,
        kind: 'relevance',
        recommendation: 'Add a source whose title, abstract, or metadata directly names the claim terms.',
        reason: best ? `Best source-to-claim match is ${best.score}/100 from ${best.sourceId}.` : 'No source is available for this claim.',
      });
    }
  });

  detectSourceConflicts(input.sources).forEach((conflict) => {
    pushUniqueRecommendation(recommendations, {
      sourceId: conflict.sourceIds.join(', '),
      priority: asPriority(conflict.severity),
      kind: 'conflict',
      recommendation: conflict.recommendation,
      reason: conflict.summary,
    });
  });

  return recommendations.sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind)).slice(0, 18);
}

export function buildEvidenceReport(input: EvidenceEngineInput): EvidenceEngineReport {
  const claims = normalizeClaims(input.claims ?? input.claimText);
  const firstClaim = claims[0] ?? input.claimText;
  const options = { ...input, claimText: firstClaim };

  return {
    asOfYear: getAsOfYear(input.asOfYear),
    credibilityScores: input.sources.map((source) => scoreSourceCredibility(source, options)),
    freshness: input.sources.map((source) => detectEvidenceFreshness(source, input)),
    sourceClaimMatches: claims.flatMap((claim) => input.sources.map((source) => scoreSourceClaimMatch(source, claim))),
    hallucinationRisks: input.sources.map((source) => assessCitationHallucinationRisk(source, input)),
    upgradeRecommendations: recommendEvidenceUpgrades({ ...input, claims }),
    conflicts: detectSourceConflicts(input.sources),
  };
}

function renderBullets(items: string[], empty: string): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
}

export function renderEvidenceReport(report: EvidenceEngineReport): string {
  const credibility = report.credibilityScores.map(
    (score) =>
      `${score.sourceId}: ${score.overall}/100 (${score.label}) - authority ${score.authority}, recency ${score.recency}, bias ${score.bias}, relevance ${score.relevance}, metadata ${score.metadataCompleteness}`,
  );
  const freshness = report.freshness.map((item) => `${item.sourceId}: ${item.status} (${item.score}/100). ${item.reason}`);
  const matches = report.sourceClaimMatches
    .slice(0, 12)
    .map((match) => `${match.sourceId}: ${match.score}/100 ${match.label} match for "${match.claim}"`);
  const risks = report.hallucinationRisks.map((risk) => `${risk.sourceId}: ${risk.level} risk (${risk.riskScore}/100). ${risk.reasons.join(' ')}`);
  const upgrades = report.upgradeRecommendations.map((item) => {
    const target = item.claim ? `Claim "${item.claim}"` : item.sourceId ? `Source ${item.sourceId}` : 'Evidence set';
    return `P${item.priority} ${item.kind}: ${target}. ${item.recommendation}`;
  });
  const conflicts = report.conflicts.map((conflict) => `${conflict.kind} conflict ${conflict.sourceIds.join(' vs ')}: ${conflict.summary}`);

  return `## Evidence Credibility
${renderBullets(credibility, 'No sources supplied.')}

## Evidence Freshness
${renderBullets(freshness, 'No freshness checks generated.')}

## Source-to-Claim Match
${renderBullets(matches, 'No claim text supplied.')}

## Citation Hallucination Risk
${renderBullets(risks, 'No citation risk checks generated.')}

## Evidence Upgrades
${renderBullets(upgrades, 'No upgrades recommended.')}

## Source Conflicts
${renderBullets(conflicts, 'No source conflicts detected.')}`;
}
