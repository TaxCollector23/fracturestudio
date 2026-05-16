import { describe, expect, it } from 'vitest';
import { analyzeArgument } from './fractureEngine';
import {
  acceptMission,
  calculateRevisionScoreDelta,
  createRevisionMissions,
  diffParagraphs,
  exportRevisionHistoryMarkdown,
  generateSuggestedRewrites,
  rejectMission,
  summarizeMissionStatus,
} from './revisionEngine';

describe('diffParagraphs', () => {
  it('returns paragraph-level added, unchanged, and modified changes', () => {
    const before = `School uniforms always improve discipline.

Students learn better when classrooms are calm.`;
    const after = `School uniforms often improve discipline when schools pair them with clear expectations.

Students learn better when classrooms are calm.

A district report should compare attendance before and after the policy.`;

    expect(diffParagraphs(before, after).map((diff) => diff.kind)).toEqual(['modified', 'unchanged', 'added']);
  });
});

describe('revision missions', () => {
  it('tracks mission status and preserves deterministic IDs', () => {
    const analysis = analyzeArgument('Schools should require uniforms because they improve focus. Everyone benefits.');
    const missions = createRevisionMissions(analysis);
    const accepted = acceptMission(missions, missions[0].id, { note: 'Source added.', decidedAt: '2026-05-14' });
    const rejected = rejectMission(accepted, missions[1].id, { note: 'Not relevant to this draft.' });
    const nextMissions = createRevisionMissions(analysis, rejected);

    expect(nextMissions[0].id).toBe(missions[0].id);
    expect(nextMissions[0].status).toBe('accepted');
    expect(nextMissions[1].status).toBe('rejected');
    expect(summarizeMissionStatus(nextMissions)).toEqual({
      total: 3,
      pending: 1,
      accepted: 1,
      rejected: 1,
      completionRate: 0.67,
    });
  });
});

describe('generateSuggestedRewrites', () => {
  it('creates mission-aligned rewrites from FractureAnalysis', () => {
    const analysis = analyzeArgument('Technology always improves learning because students can find facts faster.');
    const missions = createRevisionMissions(analysis);
    const rewrites = generateSuggestedRewrites(analysis, missions);

    expect(rewrites).toHaveLength(missions.length);
    expect(rewrites[0].missionId).toBe(missions[0].id);
    expect(rewrites[0].after.length).toBeGreaterThan(rewrites[0].before.length);
  });
});

describe('calculateRevisionScoreDelta', () => {
  it('summarizes score movement', () => {
    const delta = calculateRevisionScoreDelta(
      { overall: 50, logic: 45, evidence: 40, clarity: 60, originality: 55, rebuttal: 30 },
      { overall: 63, logic: 58, evidence: 61, clarity: 59, originality: 55, rebuttal: 45 },
    );

    expect(delta.direction).toBe('improved');
    expect(delta.delta).toMatchObject({ overall: 13, evidence: 21, clarity: -1 });
    expect(delta.regressed).toEqual(['clarity']);
  });
});

describe('exportRevisionHistoryMarkdown', () => {
  it('exports revision history with score and mission sections', () => {
    const first = 'Uniforms always fix school discipline.';
    const second = 'Uniform policies can improve school discipline when evidence shows fewer disruptions.';
    const analysis = analyzeArgument(second);
    const missions = createRevisionMissions(analysis);
    const markdown = exportRevisionHistoryMarkdown({
      title: 'Uniform Case',
      entries: [
        { id: 'draft-1', label: 'First Draft', text: first, analysis: analyzeArgument(first) },
        {
          id: 'draft-2',
          label: 'Second Draft',
          text: second,
          analysis,
          missions,
          suggestedRewrites: generateSuggestedRewrites(analysis, missions),
        },
      ],
    });

    expect(markdown).toContain('# Uniform Case');
    expect(markdown).toContain('### Paragraph Diff');
    expect(markdown).toContain('### Mission Status');
    expect(markdown).toContain('### Suggested Rewrites');
  });
});
