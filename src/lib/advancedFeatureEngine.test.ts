import { describe, expect, it, vi } from 'vitest';
import {
  buildAdvancedFeaturePack,
  buildInteractiveArgumentGraph,
  buildSpeedDebateBrief,
  loadVersionHistory,
  renderMethodReportV2,
  saveVersionHistoryEntry,
  verifySourcesToClaims,
} from './advancedFeatureEngine';
import { analyzeArgument } from './fractureEngine';

const draft = `Schools should require later start times because tired students learn less. A 2022 sleep medicine report says teenagers need more sleep for memory and attention. Therefore, moving the first bell later would improve attendance and classroom performance.

However, opponents may argue buses become harder to schedule. That objection matters, but districts can stagger routes and pilot the change before full adoption.`;

describe('advanced feature engine', () => {
  it('builds an argument graph with thesis, claims, warrants, assumptions, impacts, and rebuttals', () => {
    const analysis = analyzeArgument(draft, { judgeMode: 'debate' });
    const graph = buildInteractiveArgumentGraph(analysis);

    expect(graph.nodes.some((node) => node.type === 'thesis')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'claim')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'warrant')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'assumption')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'impact')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'rebuttal')).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('creates a collapse report and method report with the required sections', () => {
    const pack = buildAdvancedFeaturePack({ draft, supplementalText: 'Teacher rubric: evidence, reasoning, counterargument.' });

    expect(pack.collapse.sentence.length).toBeGreaterThan(10);
    expect(pack.collapse.saferReplacement).toContain('because');
    expect(pack.methodReport).toContain('Fracture Method Report v2');
    expect(pack.methodReport).toContain('Opponent attacks');
    expect(renderMethodReportV2(pack)).toContain('Revision missions');
  });

  it('verifies sources against claims instead of giving bibliography credit automatically', () => {
    const analysis = analyzeArgument(draft, { judgeMode: 'debate' });
    const report = verifySourcesToClaims({
      draft,
      supplementalText: 'Sleep Foundation | Teens and Sleep | 2022 | https://www.sleepfoundation.org/teens-and-sleep',
      analysis,
    });

    expect(report.items.length).toBeGreaterThan(0);
    expect(report.items[0].sourceLabel).toContain('source-');
    expect(report.items.some((item) => item.problems.length > 0)).toBe(true);
  });

  it('builds a speed debate brief with timed answers', () => {
    const analysis = analyzeArgument(draft, { judgeMode: 'debate' });
    const brief = buildSpeedDebateBrief({
      draft,
      opponentText: 'Later starts are impossible because bus schedules will collapse.',
      analysis,
      persona: 'debate-champion',
    });

    expect(brief.tenSecondAnswer).toBeTruthy();
    expect(brief.thirtySecondAnswer).toBeTruthy();
    expect(brief.twoMinuteRebuttal).toContain('Judge');
    expect(brief.crossfireQuestion).toContain('?');
  });

  it('checks rubric alignment and saves version history locally', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });

    const pack = buildAdvancedFeaturePack({
      draft,
      supplementalText: 'Evidence must be specific.\nReasoning must connect claim and evidence.\nCounterargument must be answered.',
    });
    const history = saveVersionHistoryEntry({ draft, pack, title: 'Test version' });

    expect(pack.rubric.criteria).toHaveLength(3);
    expect(history[0].title).toBe('Test version');
    expect(loadVersionHistory()[0].score).toBe(pack.analysis.scores.overall);

    vi.unstubAllGlobals();
  });
});
