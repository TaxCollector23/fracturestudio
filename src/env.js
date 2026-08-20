import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let loaded = false;

export function loadEnv() {
  if (loaded) return;
  dotenv.config({ path: join(__dirname, "../.env.local") });
  dotenv.config({ path: join(__dirname, "../.env") });
  loaded = true;
}

export function numberFromEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
