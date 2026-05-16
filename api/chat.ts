import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processChatPost } from '../server/chat';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const result = await processChatPost(req.body, origin);
  return res.status(result.status).json(result.body);
}
