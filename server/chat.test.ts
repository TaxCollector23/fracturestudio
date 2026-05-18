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

  it('returns local fracture completion without key', async () => {
    const r = await processChatPost({ messages: [{ role: 'user', content: 'a' }] }, undefined, undefined);
    expect(r.status).toBe(200);
    expect(extractAssistantText(r.body)).toContain('Local Fracture engine used');
  });

  it('returns upstream chat text in the frontend-compatible choices shape', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '  Here is a useful answer.  ' } }] })),
        }),
      ),
    );

    const r = await processChatPost(
      { messages: [{ role: 'user', content: 'How should I repair this warrant?' }] },
      'http://localhost',
    );

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ choices: [{ message: { content: 'Here is a useful answer.' } }] });
    expect(extractAssistantText(r.body)).toBe('Here is a useful answer.');
  });

  it('falls back to local fracture completion when upstream returns blank assistant', async () => {
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
    expect(r.status).toBe(200);
    expect(extractAssistantText(r.body)).toContain('remote model returned no assistant text');
  });

  it('returns a useful local fallback when upstream errors', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve(JSON.stringify({ error: { message: 'rate limited' } })),
        }),
      ),
    );

    const r = await processChatPost(
      { messages: [{ role: 'user', content: 'Give me one warrant upgrade for my essay.' }] },
      'http://localhost',
    );

    const text = extractAssistantText(r.body);
    expect(r.status).toBe(200);
    expect(text).toContain('Local Fracture engine used because rate limited');
    expect(text).toContain('Fracture Chat answer: focus on the exact claim');
  });

  it('validates citations sourcesText', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    const r = await processChatPost({ action: 'citations', citationStyle: 'APA', sourcesText: '' }, undefined, 'sk-test');
    expect(r.status).toBe(400);
    expect((r.body as { code?: string }).code).toBe('VALIDATION');
  });

  it('has a speed-mode local fallback with timed debate sections', async () => {
    const r = await processChatPost(
      {
        action: 'speed-rebuttal',
        text: 'School should start later because students need sleep.',
        opponentText: 'Later starts break bus schedules.',
        speedMode: true,
      },
      undefined,
      undefined,
    );

    const text = extractAssistantText(r.body);
    expect(r.status).toBe(200);
    expect(text).toContain('10-second answer');
    expect(text).toContain('2-minute rebuttal');
    expect(text).toContain('Risk warning');
  });
});
