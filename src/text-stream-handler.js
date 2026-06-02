import { DEFAULT_MODEL } from "./audit-utils.js";
import { buildChatMessages, buildRebuttalMessages } from "./prompts.js";
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
    getText: (body) => String(body?.draft || "").trim(),
    tooLong: 40000,
    messages: buildRebuttalMessages,
    model: () => process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    maxTokens: 2600,
    temperature: 0.42
  }
};

export async function handleTextStream(req, res, mode) {
  const config = MODES[mode];
  if (!config) return res.status(404).json({ error: "Unknown Fracture mode." });
  if (req.method && req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const text = config.getText(req.body);
  if (!text) return res.status(400).json({ error: mode === "rebuttal" ? "Choose a saved argument or return to Studio first." : "Ask Fracture Chat a question first." });
  if (text.length > config.tooLong) return res.status(400).json({ error: mode === "rebuttal" ? "This argument is too long for rebuttal preparation." : "This Fracture Chat request is too long." });
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: "Fracture AI is not configured on this server." });

  startSse(res);
  writeSse(res, { fracture_text_progress: { progress: 8, message: mode === "rebuttal" ? "Reading the saved argument" : "Reading your question" } });

  let upstream;
  const preferredModel = config.model();
  const fallbackModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const recoveryModel = process.env.OPENROUTER_SPEED_MODEL || DEFAULT_SPEED_MODEL;
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
    return finishWithStableFallback(res, req.body, mode);
  }

  let length = 0;
  let visibleText = "";
  const allowedNumbers = groundingNumbers(req.body);
  const sanitizer = createStreamingSanitizer(allowedNumbers);
  try {
    const appendDelta = (delta, totalLength) => {
      length = totalLength;
      const nextDelta = sanitizer.push(delta);
      visibleText += nextDelta;
      if (nextDelta) writeSse(res, { fracture_text_delta: nextDelta });
      writeSse(res, {
        fracture_text_progress: {
          progress: Math.min(94, 16 + Math.floor(length / 18)),
          message: mode === "rebuttal" ? "Building opponent preparation" : "Writing a practical answer"
        }
      });
    };
    const flushVisibleText = () => {
      const tail = sanitizer.flush();
      visibleText += tail;
      if (tail) writeSse(res, { fracture_text_delta: tail });
    };

    try {
      await collectTextFromOpenRouter(upstream, appendDelta);
      flushVisibleText();
    } catch (err) {
      flushVisibleText();
      if (visibleText.trim() || recoveryModel === preferredModel) throw err;
      writeSse(res, { fracture_text_progress: { progress: 14, message: "Switching to the available AI model" } });
      upstream = await openRouterStream({
        model: recoveryModel,
        messages: config.messages(req.body),
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        referer: "https://fracturestudio.vercel.app"
      });
      await collectTextFromOpenRouter(upstream, appendDelta);
      flushVisibleText();
    }

    if (!visibleText.trim()) {
      writeSse(res, { fracture_text_progress: { progress: 18, message: "Retrying a clear answer" } });
      upstream = await openRouterStream({
        model: recoveryModel,
        messages: config.messages(req.body),
        maxTokens: config.maxTokens,
        temperature: Math.min(0.7, config.temperature + 0.08),
        referer: "https://fracturestudio.vercel.app"
      });
      await collectTextFromOpenRouter(upstream, appendDelta);
      flushVisibleText();
    }

    if (!visibleText.trim()) throw new Error("Fracture AI returned an empty answer. Please send the request again.");
    if (/\b(study|studies|research|survey|report|district|source|evidence|case stud)/i.test(visibleText)) {
      writeSse(res, { fracture_text_delta: "\n\nEvidence note: Treat any fact, source, or example not present in your draft as a research target. Check it before using this response." });
    }
    writeSse(res, { fracture_text_progress: { progress: 100, message: "Ready" } });
  } catch (err) {
    if (!visibleText.trim()) {
      return finishWithStableFallback(res, req.body, mode);
    }
    writeSse(res, { fracture_text_delta: "\n\nThe live provider paused before finishing. Keep the usable draft above, then send the request again for a fresh pass." });
    writeSse(res, { fracture_text_progress: { progress: 100, message: "Ready to retry" } });
  }

  return writeDone(res);
}

function finishWithStableFallback(res, body, mode) {
  const draft = String(body?.draft || body?.selectedPoint || "").trim();
  const anchor = draft.split(/(?<=[.!?])\s+/)[0] || "the argument";
  const response = mode === "rebuttal" ? [
    "Round overview:",
    `Start with the argument's central claim: ${anchor}`,
    "The most important preparation job is to identify the reasoning bridge that turns this claim into the conclusion.",
    "",
    "What the opponent may say:",
    "The conclusion is broader than the reasoning supplied. A skilled opponent will ask what exact warrant proves the jump and whether a narrower explanation fits the same facts.",
    "",
    "How to respond:",
    "State the warrant directly, narrow any overclaim, and explain why your impact still matters even under the opponent's strongest reasonable interpretation.",
    "",
    "What to challenge in the opponent's speech:",
    "Listen for a missing warrant, an undefined key term, an alternate cause they have not ruled out, or an impact they describe without weighing against yours.",
    "",
    "Crossfire questions:",
    "What exact reasoning step turns your evidence into your conclusion?",
    "What would have to be true for your impact to outweigh ours?",
    "",
    "Weighing lines:",
    "Prefer the side with the clearer proven link and the more defensible burden of proof.",
    "",
    "Next prep moves:",
    "Write one warrant sentence, one narrow answer to the strongest objection, and one crossfire question tied to the opponent's burden."
  ].join("\n") : [
    "The live coaching model is busy, so Fracture Chat is giving you a stable first move.",
    `Start with this exact point: ${anchor}`,
    "Write one sentence that states the reasoning bridge directly: This supports the claim because [explain the exact connection].",
    "Then check whether the conclusion is narrower than the evidence can prove. Send the question again when you want a full live coaching pass."
  ].join("\n\n");
  writeSse(res, { fracture_text_delta: response });
  writeSse(res, { fracture_text_progress: { progress: 100, message: "Ready with a stable response" } });
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

function groundingNumbers(body) {
  const values = String(JSON.stringify(body || {})).match(/\d+(?:[.,]\d+)?/g) || [];
  const allowed = new Set(values.map((value) => value.replace(",", ".")));
  return allowed;
}
