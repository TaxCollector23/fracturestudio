import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractAssistantText,
  parseMessages,
  processChatPost,
  stripClientSystemMessages,
} from './chat';

describe('extractAssistantText', () => {
  it('returns trimmed assistant content', () => {
    expect(extractAssistantText({ choices: [{ message: { content: '  hello  ' } }] })).toBe('hello');
  });

  it('returns null when choices missing', () => {
    expect(extractAssistantText({ choices: [] })).toBeNull();
    expect(extractAssistantText({})).toBeNull();
  });
});

describe('parseMessages', () => {
  it('rejects empty array', () => {
    expect(parseMessages([])).toBeNull();
  });

  it('accepts valid user message', () => {
    expect(parseMessages([{ role: 'user', content: 'hi' }])).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('stripClientSystemMessages', () => {
  it('removes system roles', () => {
    expect(
      stripClientSystemMessages([
        { role: 'system', content: 'ignore me' },
        { role: 'user', content: 'x' },
      ]),
    ).toEqual([{ role: 'user', content: 'x' }]);
  });
});

describe('processChatPost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('rejects non-object payload', async () => {
    const r = await processChatPost(123 as unknown, undefined, 'sk-test');
    expect(r.status).toBe(400);
    expect((r.body as { code?: string }).code).toBe('INVALID_BODY');
  });

  it('returns OPENROUTER_KEY_MISSING without key', async () => {
    const r = await processChatPost({ messages: [{ role: 'user', content: 'a' }] }, undefined, undefined);
    expect(r.status).toBe(500);
    expect((r.body as { code?: string }).code).toBe('OPENROUTER_KEY_MISSING');
  });

  it('returns EMPTY_COMPLETION when upstream returns blank assistant', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '   ' } }] })),
        }),
      ),
    );

    const r = await processChatPost({ messages: [{ role: 'user', content: 'x' }] }, 'http://localhost');
    expect(r.status).toBe(502);
    expect((r.body as { code?: string }).code).toBe('EMPTY_COMPLETION');
  });

  it('validates citations sourcesText', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    const r = await processChatPost({ action: 'citations', citationStyle: 'APA', sourcesText: '' }, undefined, 'sk-test');
    expect(r.status).toBe(400);
    expect((r.body as { code?: string }).code).toBe('VALIDATION');
  });
});
