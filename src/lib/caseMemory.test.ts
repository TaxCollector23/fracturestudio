import { describe, expect, it } from 'vitest';
import { createCaseMemoryStore, createMemoryCaseMemoryStorage } from './caseMemory';

function tickingClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 4, 14, 20, 0, tick++));
}

function tickingIds() {
  let tick = 0;
  return (prefix: string) => `${prefix}-${++tick}`;
}

function createTestStore() {
  return createCaseMemoryStore({
    storage: createMemoryCaseMemoryStorage(),
    now: tickingClock(),
    idFactory: tickingIds(),
  });
}

describe('caseMemory', () => {
  it('creates, updates, lists, and deletes saved cases', () => {
    const store = createTestStore();
    const saved = store.createCase({
      title: 'Uniform policy',
      content: 'Schools should require uniforms because they reduce daily distraction.',
      sources: [{ id: 'source-1', title: 'Uniform study' }],
      tags: ['Debate', 'debate', ' Policy '],
      lastRun: { state: 'success', score: 82, summary: 'Ready' },
    });

    expect(saved.metadata.title).toBe('Uniform policy');
    expect(saved.metadata.tags).toEqual(['Debate', 'Policy']);
    expect(store.listCases()).toMatchObject([
      {
        id: saved.metadata.id,
        title: 'Uniform policy',
        sourceCount: 1,
        wordCount: 9,
        versionCount: 0,
      },
    ]);

    const updated = store.updateCase(saved.metadata.id, {
      opponent: 'Uniforms limit expression.',
      rubric: 'Use evidence and answer counterclaims.',
      tags: ['Final'],
    });

    expect(updated?.opponent).toBe('Uniforms limit expression.');
    expect(updated?.metadata.tags).toEqual(['Final']);
    expect(store.listCases()[0]).toMatchObject({
      hasOpponent: true,
      hasRubric: true,
    });

    expect(store.deleteCase(saved.metadata.id)).toBe(true);
    expect(store.listCases()).toHaveLength(0);
  });

  it('creates snapshots, looks them up, and restores fields safely', () => {
    const store = createTestStore();
    const saved = store.createCase({
      title: 'AI tutors',
      content: 'AI tutors improve practice time.',
      opponent: 'They may hallucinate.',
      tags: ['draft'],
    });
    const snapshot = store.createSnapshot(saved.metadata.id, { id: 'snapshot-original', label: 'Original' });

    store.updateCase(saved.metadata.id, {
      content: 'AI tutors are risky without citation guardrails.',
      opponent: 'They still hallucinate.',
      tags: ['revised'],
    });

    const lookup = store.lookupSnapshot(saved.metadata.id, 'snapshot-original');
    expect(lookup?.fields.content).toBe('AI tutors improve practice time.');
    expect(lookup?.tags).toEqual(['draft']);

    const restored = store.restoreSnapshot(saved.metadata.id, 'snapshot-original');
    expect(restored?.content).toBe('AI tutors improve practice time.');
    expect(restored?.metadata.tags).toEqual(['draft']);
    expect(restored?.versions).toHaveLength(2);
  });

  it('exports and imports JSON bundles with conflict-safe defaults', () => {
    const sourceStore = createTestStore();
    const saved = sourceStore.createCase({
      title: 'Research brief',
      draft: 'Working notes',
      content: 'The claim needs a stronger source.',
    });
    const exported = sourceStore.exportJson({ pretty: false });

    const targetStore = createTestStore();
    targetStore.createCase({ id: saved.metadata.id, title: 'Existing local case' });

    const result = targetStore.importJson(exported);
    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);
    expect(result.renamed).toBe(1);
    expect(targetStore.listCases()).toHaveLength(2);

    const replacedStore = createTestStore();
    const replaceResult = replacedStore.importJson(exported, { mode: 'replace' });
    expect(replaceResult.imported).toBe(1);
    expect(replacedStore.listCases()).toMatchObject([{ title: 'Research brief' }]);
  });
});
