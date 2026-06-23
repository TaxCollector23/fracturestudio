import { OPENROUTER_ENDPOINT, collectOpenRouterContent } from "./audit-utils.js";

export const DEFAULT_SPEED_MODEL = "meta-llama/llama-3.2-3b-instruct:free";

export async function openRouterStream(options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  return fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL || options.referer || "http://localhost:3000",
      "X-Title": "Fracture Studio",
      Accept: "text/event-stream"
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: { type: "json_object" }
    })
  });
}

export async function collectTextFromOpenRouter(upstream, onChunk) {
  if (!upstream.ok) {
    const text = await upstream.text();
    throw new Error(`OpenRouter returned ${upstream.status}: ${text.slice(0, 240)}`);
  }
  return collectOpenRouterContent(upstream, onChunk);
}
