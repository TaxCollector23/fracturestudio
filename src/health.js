import { loadEnv } from "./env.js";
import { getOpenRouterRuntimeConfig } from "./openrouter.js";

export function getHealthPayload() {
  loadEnv();
  const openrouter = getOpenRouterRuntimeConfig();

  return {
    ok: true,
    service: "fracture-studio",
    openrouter: {
      configured: openrouter.configured,
      model: openrouter.model,
      chatModel: openrouter.chatModel,
      speedModel: openrouter.speedModel
    },
    limits: {
      analyzeCharacters: 40000,
      chatCharacters: 6000,
      openrouterRequestTimeoutMs: openrouter.requestTimeoutMs,
      openrouterStreamStallMs: openrouter.streamStallMs
    }
  };
}
