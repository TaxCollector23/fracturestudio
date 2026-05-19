import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatHandlerErrorBody, jsonCorsHeaders, methodNotAllowedErrorBody, parseJsonBodyText, processChatPost } from '../server/chat';

function headerValue(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = jsonCorsHeaders();
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json(methodNotAllowedErrorBody());

  try {
    const parsed = typeof req.body === 'string' ? parseJsonBodyText(req.body) : { ok: true as const, payload: req.body || {} };
    if (parsed.ok === false) return res.status(parsed.status).json(parsed.body);
    const origin = headerValue(req.headers.origin) || headerValue(req.headers.referer);
    const result = await processChatPost(parsed.payload, origin);
    return res.status(result.status).json(result.body);
  } catch {
    return res.status(500).json(chatHandlerErrorBody());
  }
}
