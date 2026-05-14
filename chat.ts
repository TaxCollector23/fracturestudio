import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonCorsHeaders, processChatPost } from '../server/chat';

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

function applyCors(res: VercelResponse) {
  const headers = jsonCorsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

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

    const origin = getHeaderValue(req.headers.origin) || getHeaderValue(req.headers.referer);
    const result = await processChatPost(payload, origin);
    return res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenRouter.';
    return res.status(500).json({ error: message });
  }
}
