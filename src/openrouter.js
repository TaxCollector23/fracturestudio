import { OPENROUTER_ENDPOINT, collectOpenRouterContent } from "./audit-utils.js";

export const DEFAULT_SPEED_MODEL = "meta-llama/llama-3.2-3b-instruct:free";

// Prioritized chain of the strongest free models on OpenRouter. The handler tries
// them in order: a model that is throttled, overloaded, or returns a bad ID is
// skipped fast (via timeout / non-OK status) and the next one takes over. This is
// what keeps the engine working even when any single free model is down.
export const FREE_MODEL_CHAIN = [
  "deepseek/deepseek-chat-v3-0324:free", // strongest free model, excellent at structured JSON
  "meta-llama/llama-3.3-70b-instruct:free", // reliable, strong reasoning
  "openai/gpt-oss-120b:free", // known-good, original default
  "google/gemini-2.0-flash-exp:free", // fast, follows schemas well
  "qwen/qwen-2.5-72b-instruct:free" // strong fallback
];

// Build the ordered model list. An OPENROUTER_MODEL env var, if set, is tried first.
export function buildModelChain() {
  const chain = [...FREE_MODEL_CHAIN];
  const envModel = process.env.OPENROUTER_MODEL;
  if (envModel && !chain.includes(envModel)) chain.unshift(envModel);
  return chain;
}

// Short, human-readable model name for progress messages ("deepseek v3").
export function shortModelName(model) {
  const tail = String(model || "").split("/").pop() || model;
  return tail.replace(":free", "").replace(/-instruct.*/, "").replace(/-/g, " ");
}

// Open a streaming completion. An AbortController guards the time-to-first-response
// so a model that never replies is abandoned instead of hanging the whole request.
export async function openRouterStream(options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 35000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(OPENROUTER_ENDPOINT, {
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
        max_tokens: options.maxTokens
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Model ${options.model} did not respond in time.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectTextFromOpenRouter(upstream, onChunk, options = {}) {
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    throw new Error(`OpenRouter returned ${upstream.status}: ${text.slice(0, 240)}`);
  }
  return collectOpenRouterContent(upstream, onChunk, options);
}
