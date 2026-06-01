import { DEFAULT_MODEL } from "./audit-utils.js";
import { buildChatMessages, buildSpeedRebuttalMessages } from "./prompts.js";
import { collectTextFromOpenRouter, DEFAULT_SPEED_MODEL, openRouterStream } from "./openrouter.js";
import { startSse, writeDone, writeSse } from "./sse-utils.js";

const MODES = {
  chat: {
    getText: (body) => String(body?.message || "").trim(),
    tooLong: 6000,
    messages: buildChatMessages,
    model: () => process.env.OPENROUTER_CHAT_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    maxTokens: 1800,
    temperature: 0.45
  },
  rebuttal: {
    getText: (body) => String(body?.argument || "").trim(),
    tooLong: 12000,
    messages: buildSpeedRebuttalMessages,
    model: () => process.env.OPENROUTER_SPEED_MODEL || DEFAULT_SPEED_MODEL,
    maxTokens: 950,
    temperature: 0.35
  }
};

export async function handleTextStream(req, res, mode) {
  const config = MODES[mode];
  if (!config) return res.status(404).json({ error: "Unknown Fracture mode." });
  if (req.method && req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const text = config.getText(req.body);
  if (!text) return res.status(400).json({ error: mode === "chat" ? "Ask Fracture Chat a question first." : "Paste the opponent's argument first." });
  if (text.length > config.tooLong) return res.status(400).json({ error: "This request is too long for rapid response mode." });
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: "Fracture AI is not configured on this server." });

  startSse(res);
  writeSse(res, { fracture_text_progress: { progress: 8, message: mode === "chat" ? "Reading your question" : "Finding the decisive response" } });

  let upstream;
  const preferredModel = config.model();
  const fallbackModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  try {
    upstream = await openRouterStream({
      model: preferredModel,
      messages: config.messages(req.body),
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      referer: "https://fracturestudio.vercel.app"
    });
    if (!upstream.ok && preferredModel !== fallbackModel) {
      await upstream.text();
      writeSse(res, { fracture_text_progress: { progress: 12, message: "Switching to the available rapid model" } });
      upstream = await openRouterStream({
        model: fallbackModel,
        messages: config.messages(req.body),
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        referer: "https://fracturestudio.vercel.app"
      });
    }
  } catch (err) {
    writeSse(res, { fracture_text_error: err?.message || String(err) });
    return writeDone(res);
  }

  let length = 0;
  let visibleText = "";
  const allowedNumbers = groundingNumbers(req.body, mode);
  const sanitizer = createStreamingSanitizer(allowedNumbers);
  try {
    await collectTextFromOpenRouter(upstream, (delta, totalLength) => {
      length = totalLength;
      const nextDelta = sanitizer.push(delta);
      visibleText += nextDelta;
      if (nextDelta) writeSse(res, { fracture_text_delta: nextDelta });
      writeSse(res, {
        fracture_text_progress: {
          progress: Math.min(94, 16 + Math.floor(length / 18)),
          message: mode === "chat" ? "Writing a practical answer" : "Building speakable rebuttal lines"
        }
      });
    });
    const tail = sanitizer.flush();
    visibleText += tail;
    if (tail) writeSse(res, { fracture_text_delta: tail });
    if (/\b(study|studies|research|survey|report|district|source|evidence|case stud)/i.test(visibleText)) {
      writeSse(res, { fracture_text_delta: "\n\nEvidence note: Treat any fact, source, or example not present in your draft as a research target. Check it before using this response." });
    }
    writeSse(res, { fracture_text_progress: { progress: 100, message: "Ready" } });
  } catch (err) {
    writeSse(res, { fracture_text_error: err?.message || String(err) });
  }

  return writeDone(res);
}

function sanitizePlainText(text, allowedNumbers) {
  const safeValues = [];
  const safeKeys = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const protect = (value) => {
    if (safeValues.length >= safeKeys.length) return value;
    const key = `@@SAFE${safeKeys[safeValues.length]}@@`;
    safeValues.push(value);
    return key;
  };

  return String(text || "")
    .replace(/10-second answer:/gi, () => protect("10-second answer:"))
    .replace(/30-second answer:/gi, () => protect("30-second answer:"))
    .replace(/2-minute rebuttal:/gi, () => protect("2-minute rebuttal:"))
    .replace(/^(\s*)(\d+)\.\s/gm, (_match, spacing, number) => protect(`${spacing}${number}. `))
    .replace(/\((\d{1,2})\)(?=\s+[A-Za-z])/g, (match) => protect(match))
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .replace(/[*_`]/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*\|?[\s:-]+\|[\s|:-]*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?/gi, (match) => {
      const values = match.match(/\d+(?:[.,]\d+)?/g) || [];
      return values.every((value) => allowedNumbers.has(value.replace(",", "."))) ? match : "[verify time]";
    })
    .replace(/\b\d{1,2}\s*(?:[ap]\.?m\.?)/gi, (match) => {
      const values = match.match(/\d+(?:[.,]\d+)?/g) || [];
      return values.every((value) => allowedNumbers.has(value.replace(",", "."))) ? match : "[verify time]";
    })
    .replace(/\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*%?\b/g, (match) => {
      const values = match.match(/\d+(?:[.,]\d+)?/g) || [];
      return values.every((value) => allowedNumbers.has(value.replace(",", "."))) ? match : "[verify statistic]";
    })
    .replace(/@@SAFE([A-Za-z])@@/g, (_match, key) => safeValues[safeKeys.indexOf(key)] || "")
    .replace(/[ \t]+\n/g, "\n");
}

function createStreamingSanitizer(allowedNumbers) {
  let pending = "";
  return {
    push(delta) {
      pending += delta;
      let cut = pending.lastIndexOf("\n");
      if (cut < 0 && pending.length > 180) {
        cut = pending.lastIndexOf(" ", pending.length - 64);
      }
      if (cut < 0) return "";
      const ready = pending.slice(0, cut + 1);
      pending = pending.slice(cut + 1);
      return sanitizePlainText(ready, allowedNumbers);
    },
    flush() {
      const ready = sanitizePlainText(pending, allowedNumbers);
      pending = "";
      return ready;
    }
  };
}

function groundingNumbers(body, mode) {
  const values = String(JSON.stringify(body || {})).match(/\d+(?:[.,]\d+)?/g) || [];
  const allowed = new Set(values.map((value) => value.replace(",", ".")));
  return allowed;
}
