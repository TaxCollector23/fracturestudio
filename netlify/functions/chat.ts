import type { Handler } from '@netlify/functions';
import { chatHandlerErrorBody, jsonCorsHeaders, methodNotAllowedErrorBody, parseJsonBodyText, processChatPost } from '../../server/chat';

const headers = jsonCorsHeaders();

function headerValue(headers: Record<string, string | undefined>, key: string): string | undefined {
  return headers[key] || headers[key.toLowerCase()];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify(methodNotAllowedErrorBody()) };

  try {
    const parsed = parseJsonBodyText(event.body || '');
    if (parsed.ok === false) return { statusCode: parsed.status, headers, body: JSON.stringify(parsed.body) };
    const origin = headerValue(event.headers, 'origin') || headerValue(event.headers, 'referer');
    const result = await processChatPost(parsed.payload, origin);
    return { statusCode: result.status, headers, body: JSON.stringify(result.body) };
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify(chatHandlerErrorBody()) };
  }
};
