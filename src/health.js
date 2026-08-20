import { loadEnv } from "./env.js";
import { getOpenRouterRuntimeConfig } from "./openrouter.js";
import { LIMITS } from "./request-utils.js";

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
      ...LIMITS,
      openrouterRequestTimeoutMs: openrouter.requestTimeoutMs,
      openrouterStreamStallMs: openrouter.streamStallMs
    }
  };
}
