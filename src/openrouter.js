import { DEFAULT_MODEL, OPENROUTER_ENDPOINT, collectOpenRouterContent } from "./audit-utils.js";
import { loadEnv, numberFromEnv } from "./env.js";

loadEnv();

export const DEFAULT_SPEED_MODEL = DEFAULT_MODEL;

export function resolveOpenRouterModel(value, fallback = DEFAULT_MODEL) {
  const model = typeof value === "string" ? value.trim() : "";
  return model || fallback;
}

export function getOpenRouterRuntimeConfig() {
  loadEnv();
  const model = resolveOpenRouterModel(process.env.OPENROUTER_MODEL);
  return {
    configured: Boolean(process.env.OPENROUTER_API_KEY),
    model,
    chatModel: resolveOpenRouterModel(process.env.OPENROUTER_CHAT_MODEL, model),
    speedModel: resolveOpenRouterModel(process.env.OPENROUTER_SPEED_MODEL, DEFAULT_SPEED_MODEL),
    requestTimeoutMs: numberFromEnv("OPENROUTER_REQUEST_TIMEOUT_MS", 45000),
    streamStallMs: numberFromEnv("OPENROUTER_STREAM_STALL_MS", 45000)
  };
}

export function safeOpenRouterError(err) {
  loadEnv();
  const secret = process.env.OPENROUTER_API_KEY || "";
  let message = err?.message || String(err || "Unknown OpenRouter error");
  if (secret) message = message.split(secret).join("[redacted]");
  return message.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function logOpenRouterError(context, err) {
  console.warn(`[openrouter:${context}] ${safeOpenRouterError(err)}`);
}

export async function openRouterStream(options = {}) {
  loadEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : numberFromEnv("OPENROUTER_REQUEST_TIMEOUT_MS", 45000);
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
        model: resolveOpenRouterModel(options.model, process.env.OPENROUTER_MODEL || DEFAULT_MODEL),
        messages: options.messages,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectTextFromOpenRouter(upstream, onChunk, options = {}) {
  if (!upstream.ok) {
    const text = await upstream.text();
    throw new Error(`OpenRouter returned ${upstream.status}: ${text.slice(0, 240)}`);
  }
  const inactivityMs = Number(options.inactivityMs) > 0
    ? Number(options.inactivityMs)
    : numberFromEnv("OPENROUTER_STREAM_STALL_MS", 45000);
  return collectOpenRouterContent(upstream, onChunk, { inactivityMs });
}
