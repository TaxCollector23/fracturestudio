export type ChatMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

export type ChatAction = 'critique' | 'citations' | 'rebuttals';

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
- Output MUST use this exact section structure and headings (markdown):

## Quote-backed weaknesses
(Bullet list; each bullet starts with a short quoted fragment or clear paraphrase in italics, then the flaw.)

## Assumption audit
(Explicit hidden premises; label each as unsupported, contestable, or needing evidence.)

## Steelmanned counter
(State the strongest version of the opposing view that still fits the facts the user gave.)

## Line-level fixes
(Numbered, concrete rewrites or replacement sentences—not vague advice.)

If the draft is too short to critique meaningfully, say so in one sentence under Quote-backed weaknesses and stop other sections with "N/A—expand the draft first."
If the user only pastes slogans or headings with no argumentative substance, say so explicitly—do not invent a critique from nothing.`;

export const CITATIONS_SYSTEM_PROMPT = `You are a citation assistant. The user names a style and lists sources (structured or pasted). Produce:
1) A clean bibliography/reference list in that style (APA, MLA, or Chicago-style notes/bibliography "lite"—pick closest match to the requested label).
2) Short in-text citation examples (author-date, parenthetical, or footnote-style as fits the style).
Use hanging indent description where relevant in plain text. If information is missing (year, publisher, URL), note [MISSING: ...] rather than inventing facts. No praise—only accurate formatting.`;

export const REBUTTALS_SYSTEM_PROMPT = `You are a debate rebuttal coach. You receive opponent text and the user's case.
- Map rebuttals to numbered opponent claims; quote-anchored snippets from the opponent where possible.
- Add "If they say X, you say Y" cards (table or bullet pairs) tied to those claims.
- Be adversarial toward the opponent's text, not toward the user; expose gaps without sugarcoating.
Use headings:

## Claim map & rebuttals
## If they say X, you say Y
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
  const key = (override ?? process.env.OPENROUTER_API_KEY)?.trim();
  return key || null;
}

export async function requestOpenRouter(
  messages: ChatMessage[],
  referer: string | undefined,
  apiKeyOverride?: string,
): Promise<{ status: number; body: unknown }> {
  const apiKey = resolveApiKey(apiKeyOverride);
  if (!apiKey) {
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

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
    }),
  });

  const rawText = await response.text();
  let data: unknown = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
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
  if (value === 'citations' || value === 'rebuttals' || value === 'critique') {
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

    const messages = buildCitationMessages(style, sourcesText);
    return requestOpenRouter(messages, referer, apiKeyOverride);
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

    const messages = buildRebuttalMessages(opponentText, userCase);
    return requestOpenRouter(messages, referer, apiKeyOverride);
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

  const secured = buildCritiqueMessages(messages);
  return requestOpenRouter(secured, referer, apiKeyOverride);
}
