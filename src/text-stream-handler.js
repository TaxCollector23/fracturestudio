// text-stream-handler.js — Fracture Studio v6.0

import { startSse, writeSse, writeDone } from './sse-utils.js';
import { buildRebuttalMessages, buildChatMessages } from './prompts.js';
import { collectTextFromOpenRouter, openRouterStream, DEFAULT_MODEL } from './openrouter.js';

export async function handleTextStream(req, res, type) {
  if (req.method && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  startSse(res);

  let messages;
  if (type === 'rebuttal') {
    const { draft, report, focus } = req.body || {};
    if (!draft) return writeSse(res, { fracture_text_error: 'No draft provided.' });
    messages = buildRebuttalMessages(draft, report, focus);
  } else {
    const { message, draft, report, selectedPoint, history } = req.body || {};
    if (!message) return writeSse(res, { fracture_text_error: 'No message provided.' });
    messages = buildChatMessages(message, draft, report, selectedPoint, history || []);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    writeSse(res, { fracture_text_delta: 'Service not configured. Please add OPENROUTER_API_KEY.' });
    return writeDone(res);
  }

  try {
    writeSse(res, { fracture_text_progress: { progress: 10, message: 'Connecting...' } });
    const upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      referer: 'https://fracturestudio.vercel.app'
    });
    writeSse(res, { fracture_text_progress: { progress: 20, message: 'Streaming response...' } });

    await collectTextFromOpenRouter(upstream, (delta, length) => {
      writeSse(res, { fracture_text_delta: delta });
      if (length % 500 === 0) writeSse(res, { fracture_text_progress: { progress: Math.min(90, 20 + length / 100), message: 'Writing...' } });
    });

    writeSse(res, { fracture_text_progress: { progress: 100, message: 'Done' } });
    writeDone(res);
  } catch (err) {
    writeSse(res, { fracture_text_error: err.message || String(err) });
    writeDone(res);
  }
}
