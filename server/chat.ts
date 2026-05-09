export type ChatMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

export const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

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

export async function requestOpenRouter(messages: ChatMessage[], referer?: string) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: 500,
      body: { error: 'OPENROUTER_API_KEY is not configured.' },
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
        upstream: data,
      },
    };
  }

  return {
    status: 200,
    body: data,
  };
}
