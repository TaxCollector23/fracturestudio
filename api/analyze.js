import { handleAnalyze } from "../src/analyze-handler.js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  return handleAnalyze(req, res);
}
