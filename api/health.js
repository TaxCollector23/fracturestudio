import { getHealthPayload } from "../src/health.js";

export const config = { maxDuration: 10 };

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(getHealthPayload());
}
