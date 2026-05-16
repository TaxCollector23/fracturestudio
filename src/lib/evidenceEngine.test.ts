import { describe, expect, it } from 'vitest';
import type { CitationSource } from './citationEngine';
import {
  assessCitationHallucinationRisk,
  buildEvidenceReport,
  detectEvidenceFreshness,
  detectSourceConflicts,
  recommendEvidenceUpgrades,
  scoreSourceClaimMatch,
  scoreSourceCredibility,
} from './evidenceEngine';

const strongSource: CitationSource = {
  id: 'source-1',
  raw: 'National Institutes of Health. Randomized trial shows school breakfast improves attendance by 12%. 2024. https://nih.gov/breakfast-study',
  title: 'Randomized trial shows school breakfast improves attendance by 12%',
  authors: ['National Institutes of Health'],
  year: '2024',
  publisher: 'National Institutes of Health',
  url: 'https://nih.gov/breakfast-study',
  doi: '10.1000/test.2024.15',
};

const weakSource: CitationSource = {
  id: 'source-2',
  raw: 'Anonymous blog says breakfast programs are a shocking disaster.',
  title: 'shocking disaster',
  url: 'https://example.com/blog',
  missingFields: ['author', 'year', 'publisher/container'],
};

describe('evidenceEngine', () => {
  it('scores complete authoritative sources above thin biased sources', () => {
    const claim = 'School breakfast programs improve attendance by 12%.';
    const strong = scoreSourceCredibility(strongSource, { claimText: claim, asOfYear: 2026 });
    const weak = scoreSourceCredibility(weakSource, { claimText: claim, asOfYear: 2026 });

    expect(strong.overall).toBeGreaterThan(weak.overall);
    expect(strong.authority).toBeGreaterThan(weak.authority);
    expect(strong.metadataCompleteness).toBeGreaterThan(weak.metadataCompleteness);
    expect(strong.label).toMatch(/strong|usable/);
  });

  it('detects stale and future-dated evidence', () => {
    const stale = detectEvidenceFreshness({ ...strongSource, id: 'old', year: '2014' }, { asOfYear: 2026 });
    const future = detectEvidenceFreshness({ ...strongSource, id: 'future', year: '2030' }, { asOfYear: 2026 });

    expect(stale.status).toBe('stale');
    expect(stale.needsUpdate).toBe(true);
    expect(future.status).toBe('future-dated');
    expect(future.needsUpdate).toBe(true);
  });

  it('scores source-to-claim matches using shared terms and numbers', () => {
    const matching = scoreSourceClaimMatch(strongSource, 'School breakfast programs improve attendance by 12%.');
    const unrelated = scoreSourceClaimMatch(strongSource, 'Ocean temperatures change coral bleaching patterns.');

    expect(matching.score).toBeGreaterThan(unrelated.score);
    expect(matching.overlapTerms).toContain('attendance');
    expect(matching.matchedNumbers).toContain('12%');
  });

  it('flags high citation hallucination risk when metadata is missing or impossible', () => {
    const risky = assessCitationHallucinationRisk(
      {
        id: 'source-3',
        raw: 'Unknown title. 2031.',
        title: 'example.com',
        year: '2031',
        url: 'not a url',
      },
      { asOfYear: 2026 },
    );

    expect(risky.level).toBe('high');
    expect(risky.suspiciousFields).toContain('url');
    expect(risky.suspiciousFields).toContain('year');
  });

  it('recommends upgrades for weak matches and stale evidence', () => {
    const upgrades = recommendEvidenceUpgrades({
      sources: [{ ...weakSource, year: '2015' }],
      claims: ['Ocean temperatures change coral bleaching patterns.'],
      asOfYear: 2026,
    });

    expect(upgrades.some((upgrade) => upgrade.kind === 'freshness')).toBe(true);
    expect(upgrades.some((upgrade) => upgrade.kind === 'relevance')).toBe(true);
  });

  it('detects source conflicts from metadata and stance differences', () => {
    const conflicts = detectSourceConflicts([
      {
        id: 'source-a',
        raw: 'School breakfast programs improve attendance by 12%.',
        title: 'School breakfast improves attendance',
        year: '2024',
        publisher: 'Journal of Education',
        doi: '10.1000/conflict',
      },
      {
        id: 'source-b',
        raw: 'School breakfast programs worsen attendance by 7%.',
        title: 'School breakfast worsens attendance',
        year: '2023',
        publisher: 'Journal of Education',
        doi: '10.1000/conflict',
      },
    ]);

    expect(conflicts.some((conflict) => conflict.kind === 'metadata')).toBe(true);
    expect(conflicts.some((conflict) => conflict.kind === 'stance')).toBe(true);
  });

  it('builds an aggregate evidence report', () => {
    const report = buildEvidenceReport({
      sources: [strongSource, weakSource],
      claims: ['School breakfast programs improve attendance by 12%.'],
      asOfYear: 2026,
    });

    expect(report.credibilityScores).toHaveLength(2);
    expect(report.sourceClaimMatches).toHaveLength(2);
    expect(report.upgradeRecommendations.length).toBeGreaterThan(0);
  });
});
