import { handleTextStream } from "../src/text-stream-handler.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  return handleTextStream(req, res, "rebuttal");
}
