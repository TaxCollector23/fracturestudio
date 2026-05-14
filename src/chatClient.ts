import { getChatApiUrl } from './chatApi';

export type ChatApiErrorBody = {
  error?: string;
  code?: string;
};

type OpenRouterShape = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string } | string;
  upstream?: { error?: { message?: string } };
};

export class ChatRequestError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'http' | 'parse' | 'empty',
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ChatRequestError';
  }
}

function extractErrorMessage(data: OpenRouterShape | null, status: number): string {
  const upstreamMessage =
    typeof data?.error === 'string'
      ? data.error
      : data?.error && typeof data.error === 'object'
        ? data.error.message
        : data?.upstream?.error?.message;

  if (upstreamMessage) {
    return upstreamMessage;
  }

  return `Request failed with status ${status}.`;
}

export function formatChatRequestError(e: ChatRequestError): string {
  const parts = [e.message];
  if (e.status != null) {
    parts.push(`HTTP ${e.status}`);
  }
  if (e.code) {
    parts.push(e.code);
  }
  if (e.kind === 'network') {
    parts.push('If the UI is on a static host, confirm VITE_CHAT_API_BASE points to a deployment that serves POST /api/chat.');
  }
  return parts.join(' · ');
}

export async function postChat(body: Record<string, unknown>): Promise<string> {
  let res: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    res = await fetch(getChatApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ChatRequestError(
      aborted ? 'Request timed out before the chat API answered.' : 'Network error: could not reach the chat API.',
      'network',
      undefined,
      aborted ? 'CLIENT_TIMEOUT' : 'NETWORK',
    );
  } finally {
    window.clearTimeout(timeout);
  }

  let data: OpenRouterShape | ChatApiErrorBody | null = null;
  try {
    data = (await res.json()) as OpenRouterShape | ChatApiErrorBody;
  } catch {
    throw new ChatRequestError(
      res.ok ? 'Server returned invalid JSON.' : `Server returned non-JSON (HTTP ${res.status}).`,
      'parse',
      res.status,
      'INVALID_JSON',
    );
  }

  if (!res.ok) {
    const msg = extractErrorMessage(data as OpenRouterShape, res.status);
    const code = typeof data === 'object' && data && 'code' in data ? String((data as ChatApiErrorBody).code) : undefined;
    throw new ChatRequestError(msg, 'http', res.status, code);
  }

  const text = (data as OpenRouterShape)?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new ChatRequestError(
      'The model returned an empty assistant message.',
      'empty',
      res.status,
      'EMPTY_CLIENT',
    );
  }

  return text;
}
