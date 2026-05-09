import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseMessages, requestOpenRouter } from '../server/chat';

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body && typeof req.body === 'object'
          ? req.body
          : {};

    const messages = parseMessages((payload as { messages?: unknown }).messages);
    if (!messages) {
      return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
    }

    const result = await requestOpenRouter(messages, getHeaderValue(req.headers.origin) || getHeaderValue(req.headers.referer));
    return res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenRouter.';
    return res.status(500).json({ error: message });
  }
}
