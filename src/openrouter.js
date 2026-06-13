// openrouter.js — Fracture Studio v6.0

export const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

export async function openRouterStream({ model, messages, referer }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer || 'https://fracturestudio.vercel.app',
      'X-Title': 'Fracture Studio'
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      stream: true,
      max_tokens: 8000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  return response;
}

export async function collectTextFromOpenRouter(upstream, onDelta) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let rawText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        const delta = (event.choices && event.choices[0] && event.choices[0].delta && event.choices[0].delta.content) || '';
        if (delta) {
          rawText += delta;
          if (typeof onDelta === 'function') onDelta(delta, rawText.length);
        }
      } catch (_) {}
    }
  }

  return rawText;
}
