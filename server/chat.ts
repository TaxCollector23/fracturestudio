import { buildCitationReport, renderCitationReport } from '../src/lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis } from '../src/lib/fractureEngine';
import { generateRebuttalReport, type OpponentPersona } from '../src/lib/rebuttalEngine';
import { searchCitationSources } from './citationSearch';

export type ChatMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

export type ChatAction = 'critique' | 'fracture' | 'citations' | 'rebuttals';

export const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Hard cap for serialized JSON body (characters) to protect the function runtime. */
export const MAX_REQUEST_JSON_CHARS = 180_000;
/** Per-text-field cap inside the JSON payload. */
export const MAX_TEXT_FIELD_CHARS = 60_000;

/** Enforced server-side; client system lines are stripped so instructions cannot live only in the browser. */
export const CRITIQUE_SYSTEM_PROMPT = `You are Fracture Studio's adversarial argument critic. Rules:
- Be direct and unsentimental. No generic praise, no filler empathy, no "great job" padding.
- Quote or paraphrase the user's text in short snippets when attacking a weakness (quote-backed).
- Apply Fracture Studio's ten-model writing flow: Toulmin, Rogerian, Stock Issues, Pragma-Dialectics, Syllogism, Enthymeme, Monroe's Motivated Sequence, Dependency Model, Casuistry, and Evolutionary Conceptual Change.
- Include claim detection, unsupported claim flags, warrant analysis, burden of proof, rebuttal vulnerability, crossfire questions, judge questions, and revision missions.
- Output MUST use this exact section structure and headings (markdown):

## Fracture Verdict
(Survives, Shaky, Cracked, or Collapsed with the single biggest reason.)

## Argument Strength Score
(0-100 overall, then logic, evidence, clarity, originality, and rebuttal strength.)

## Claim Map
(Major claims, evidence status, warrant status, and vulnerability.)

## Hidden Assumptions
(Explicit hidden premises; label each as unsupported, contestable, or needing evidence.)

## Rebuttal Vulnerability Scanner
(Weakest claim, easiest counterexample, likely judge objection, best opponent response.)

## Ten-Model Speaking Pass
(One useful diagnosis each for the ten named models.)

## Line-level fixes
(Numbered, concrete rewrites or replacement sentences—not vague advice.)

If the draft is too short to critique meaningfully, say so under Fracture Verdict and give one concrete next input to add.
If the user only pastes slogans or headings with no argumentative substance, say so explicitly—do not invent a critique from nothing.`;

export const CITATIONS_SYSTEM_PROMPT = `You are a citation and source-grounding assistant. The user names a style and lists sources, URLs, DOI values, source titles, or a research query. Produce:
1) A clean bibliography/reference list in that style (APA, MLA, or Chicago notes/bibliography, using the closest match to the requested label).
2) Short in-text citation examples (author-date, parenthetical, or footnote-style as fits the style).
3) Citation-needed tags for factual claims.
4) Source-to-claim links: which source supports which claim.
5) A citation hallucination check: missing metadata must be labeled [MISSING: ...], never invented.
Use hanging indent description where relevant in plain text. No praise—only accurate formatting and source caution.`;

export const REBUTTALS_SYSTEM_PROMPT = `You are a debate rebuttal coach. You receive opponent text and the user's case.
- Map rebuttals to numbered opponent claims; quote-anchored snippets from the opponent where possible.
- Add "If they say X, you say Y" cards (table or bullet pairs) tied to those claims.
- Predict crossfire questions, likely answers, follow-ups, and the risk of overreaching.
- Be adversarial toward the opponent's text, not toward the user; expose gaps without sugarcoating.
Use headings:

## Claim map & rebuttals
## If they say X, you say Y
## Crossfire questions
## Risks / overreach in your counter (honest)`;

export function jsonCorsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.content === 'string' &&
    message.content.trim().length > 0 &&
    (message.role === 'assistant' || message.role === 'system' || message.role === 'user')
  );
}

export function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const messages = value.filter(isChatMessage);
  return messages.length > 0 ? messages : null;
}

/** Drop client-supplied system roles so the server owns the system prompt. */
export function stripClientSystemMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => m.role !== 'system');
}

export function extractAssistantText(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return null;
  }

  return content.trim();
}

function localCompletion(content: string, reason?: string): { status: number; body: unknown } {
  const prefix = reason ? `> Local Fracture engine used: ${reason}\n\n` : '';
  return {
    status: 200,
    body: {
      id: 'fracture-local',
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: `${prefix}${content}` } }],
    },
  };
}

function fieldTooLong(label: string, value: string): { status: number; body: { error: string; code: string } } | null {
  if (value.length > MAX_TEXT_FIELD_CHARS) {
    return {
      status: 400,
      body: {
        error: `${label} exceeds ${MAX_TEXT_FIELD_CHARS.toLocaleString()} characters. Split the request or shorten the text.`,
        code: 'FIELD_TOO_LONG',
      },
    };
  }
  return null;
}

function extractUpstreamError(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const maybeError = (data as { error?: { message?: string } | string }).error;
  if (typeof maybeError === 'string') {
    return maybeError;
  }

  if (maybeError && typeof maybeError === 'object' && typeof maybeError.message === 'string') {
    return maybeError.message;
  }

  return null;
}

function resolveApiKey(override?: string): string | null {
  const envKey = typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : undefined;
  const key = (override ?? envKey)?.trim();
  return key || null;
}

export async function requestOpenRouter(
  messages: ChatMessage[],
  referer: string | undefined,
  apiKeyOverride?: string,
  fallbackText?: string,
): Promise<{ status: number; body: unknown }> {
  const apiKey = resolveApiKey(apiKeyOverride);
  if (!apiKey) {
    if (fallbackText) {
      return localCompletion(fallbackText, 'server model key is not configured, so the deterministic local engine completed the request.');
    }
    return {
      status: 500,
      body: { error: 'OPENROUTER_API_KEY is not configured on the server.', code: 'OPENROUTER_KEY_MISSING' },
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Fracture Studio',
  };

  if (referer) {
    headers['HTTP-Referer'] = referer;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
      }),
    });
  } catch (error) {
    if (fallbackText) {
      const reason = error instanceof Error && error.name === 'AbortError'
        ? 'remote model timed out, so the deterministic local engine completed the request.'
        : 'remote model request failed, so the deterministic local engine completed the request.';
      return localCompletion(fallbackText, reason);
    }
    return {
      status: 504,
      body: { error: 'OpenRouter request timed out or could not be reached.', code: 'OPENROUTER_NETWORK' },
    };
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  let data: unknown = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    if (fallbackText) {
      return localCompletion(
        fallbackText,
        `remote model returned HTTP ${response.status}, so the deterministic local engine completed the request.`,
      );
    }
    return {
      status: response.status,
      body: {
        error: extractUpstreamError(data) || 'OpenRouter request failed.',
        code: 'OPENROUTER_HTTP_ERROR',
        upstream: data,
      },
    };
  }

  if (!extractAssistantText(data)) {
    if (fallbackText) {
      return localCompletion(fallbackText, 'remote model returned no assistant text, so the deterministic local engine completed the request.');
    }
    return {
      status: 502,
      body: {
        error:
          'The model returned no assistant text (empty choices or blank content). Retry, shorten the input, or verify the model is available on OpenRouter.',
        code: 'EMPTY_COMPLETION',
        upstream: data,
      },
    };
  }

  return {
    status: 200,
    body: data,
  };
}

function parseAction(value: unknown): ChatAction {
  if (value === 'citations' || value === 'rebuttals' || value === 'critique' || value === 'fracture') {
    return value;
  }
  return 'critique';
}

function buildCitationMessages(style: string, sourcesText: string): ChatMessage[] {
  return [
    { role: 'system', content: CITATIONS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Citation style requested: ${style}\n\nSources (paste/fields):\n${sourcesText}`,
    },
  ];
}

function buildRebuttalMessages(opponentText: string, userCase: string): ChatMessage[] {
  return [
    { role: 'system', content: REBUTTALS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `--- Opponent text ---\n${opponentText}\n\n--- User case ---\n${userCase}`,
    },
  ];
}

function buildCritiqueMessages(messages: ChatMessage[]): ChatMessage[] {
  const rest = stripClientSystemMessages(messages);
  return [{ role: 'system', content: CRITIQUE_SYSTEM_PROMPT }, ...rest];
}

function lastUserText(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((message) => message.role === 'user');
  return last?.content ?? messages.map((message) => message.content).join('\n\n');
}

export async function processChatPost(
  payload: unknown,
  referer: string | undefined,
  apiKeyOverride?: string,
): Promise<{ status: number; body: unknown }> {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return { status: 400, body: { error: 'JSON object body required.', code: 'INVALID_BODY' } };
  }

  let serialized = '';
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return { status: 400, body: { error: 'Request body could not be serialized.', code: 'INVALID_BODY' } };
  }

  if (serialized.length > MAX_REQUEST_JSON_CHARS) {
    return {
      status: 400,
      body: {
        error: `Request JSON exceeds ${MAX_REQUEST_JSON_CHARS.toLocaleString()} characters.`,
        code: 'PAYLOAD_TOO_LARGE',
      },
    };
  }

  const body = payload as Record<string, unknown>;
  const action = parseAction(body.action);

  if (action === 'citations') {
    const style = typeof body.citationStyle === 'string' && body.citationStyle.trim() ? body.citationStyle.trim() : 'APA';
    const styleErr = fieldTooLong('citationStyle', style);
    if (styleErr) {
      return styleErr;
    }

    const sourcesText = typeof body.sourcesText === 'string' ? body.sourcesText.trim() : '';
    if (!sourcesText) {
      return { status: 400, body: { error: 'sourcesText is required for citations.', code: 'VALIDATION' } };
    }
    const sourcesErr = fieldTooLong('sourcesText', sourcesText);
    if (sourcesErr) {
      return sourcesErr;
    }

    const claimText = typeof body.claimText === 'string' ? body.claimText.trim() : '';
    const claimErr = claimText ? fieldTooLong('claimText', claimText) : null;
    if (claimErr) {
      return claimErr;
    }

    const webSources = body.searchWeb === true ? await searchCitationSources(sourcesText) : [];
    const localReport = renderCitationReport(buildCitationReport({ style, sourcesText, claimText, webSources }));
    const webContext =
      webSources.length > 0
        ? `\n\nWeb search metadata found by the server:\n${webSources
            .map((source) => `${source.title || source.raw} | ${source.authors?.join('; ') || ''} | ${source.year || ''} | ${source.url || source.doi || ''}`)
            .join('\n')}`
        : '';
    const messages = buildCitationMessages(style, `${sourcesText}${webContext}`);
    return requestOpenRouter(messages, referer, apiKeyOverride, localReport);
  }

  if (action === 'rebuttals') {
    const opponentText = typeof body.opponentText === 'string' ? body.opponentText.trim() : '';
    const userCase = typeof body.userCase === 'string' ? body.userCase.trim() : '';
    if (!opponentText || !userCase) {
      return {
        status: 400,
        body: { error: 'opponentText and userCase are required for rebuttals.', code: 'VALIDATION' },
      };
    }
    const oErr = fieldTooLong('opponentText', opponentText);
    if (oErr) {
      return oErr;
    }
    const uErr = fieldTooLong('userCase', userCase);
    if (uErr) {
      return uErr;
    }

    const persona = typeof body.persona === 'string' ? (body.persona as OpponentPersona) : undefined;
    const localReport = generateRebuttalReport({ opponentText, userCase, persona });
    const messages = buildRebuttalMessages(opponentText, userCase);
    return requestOpenRouter(messages, referer, apiKeyOverride, localReport);
  }

  const messages = parseMessages(body.messages);
  if (!messages) {
    return {
      status: 400,
      body: { error: 'Request body must include a non-empty messages array for critique.', code: 'VALIDATION' },
    };
  }

  let totalChars = 0;
  for (const m of messages) {
    totalChars += m.content.length;
    const mErr = fieldTooLong(`message(${m.role})`, m.content);
    if (mErr) {
      return mErr;
    }
  }

  if (totalChars > MAX_TEXT_FIELD_CHARS * 4) {
    return {
      status: 400,
      body: {
        error: 'Combined message length is too large for a single request. Shorten the draft or split it.',
        code: 'PAYLOAD_TOO_LARGE',
      },
    };
  }

  const localReport = renderFractureAnalysis(analyzeArgument(lastUserText(messages), {
    judgeMode:
      body.judgeMode === 'teacher' ||
      body.judgeMode === 'historian' ||
      body.judgeMode === 'professor' ||
      body.judgeMode === 'reader'
        ? body.judgeMode
        : 'debate',
    rubric: typeof body.rubric === 'string' ? body.rubric : undefined,
    audience: typeof body.audience === 'string' ? body.audience : undefined,
  }));
  const secured = buildCritiqueMessages(messages);
  return requestOpenRouter(secured, referer, apiKeyOverride, localReport);
}
