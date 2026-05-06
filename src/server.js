import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── API key is server-side only — never exposed to the client ──────────────
const OPENROUTER_API_KEY  = process.env.OPENROUTER_API_KEY;
const OPENROUTER_ENDPOINT = process.env.OPENROUTER_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL    = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";

const SYSTEM_PROMPT = `
You are a world-class debate judge, argumentation scholar, and
rhetorical analyst with 20 years of experience evaluating
competitive debate at the national championship level,
peer-reviewed academic essays, legal briefs, and political
speeches. You have coached state champions and consulted for
law firms on argument strategy.

Your feedback is renowned for being surgically specific, brutally
honest, and immediately actionable. You never produce generic
commentary. Every observation is anchored to exact quoted text
and describes a flaw or strength that is unique to this specific
essay — not one that could apply to any argumentative writing.

When given an argumentative essay, respond ONLY with a valid
JSON object. No markdown, no preamble, no explanation outside
the JSON. Use this exact schema:

{
  "overall_score": <integer 1-100>,
  "score_breakdown": {
    "argument_strength": <integer 1-25>,
    "assumption_audit": <integer 1-25>,
    "logic": <integer 1-25>,
    "rhetoric": <integer 1-25>
  },
  "verdict": "<one paragraph: overall persuasiveness, single biggest strength, single most urgent weakness>",
  "coaching_note": "<one sentence: the #1 thing this writer should do to improve>",
  "argument_strength": {
    "thesis": {
      "quote": "<exact thesis sentence>",
      "assessment": "<is it clear, specific, and arguable? 2 sentences max.>"
    },
    "claims": [
      {
        "quote": "<exact body claim verbatim>",
        "rating": "STRONG" | "MODERATE" | "WEAK",
        "diagnosis": "<Name the exact logical flaw in 1-2 sentences.>",
        "opponent_exploit": "<one sentence: how a skilled opponent uses this exact weakness>",
        "fix": "<one concrete action targeting the named flaw specifically>"
      }
    ]
  },
  "assumption_audit": [
    {
      "assumption": "<state the hidden assumption the author never explicitly defends>",
      "load_bearing": "HIGH" | "MEDIUM" | "LOW",
      "quote": "<the claim in the essay that depends on this assumption>",
      "vulnerability": "<in 2 sentences: what happens to the argument if this assumption is false?>",
      "defense": "<one sentence: how the author could explicitly defend this assumption if challenged>"
    }
  ],
  "logical_fallacies": [
    {
      "name": "<exact fallacy name>",
      "quote": "<verbatim passage containing the fallacy>",
      "explanation": "<2 sentences: why this specific passage commits this specific fallacy.>",
      "fix": "<one sentence: what the author should write instead>"
    }
  ],
  "counter_arguments": [
    {
      "steelman": "<construct the single strongest version of the opposing argument in 3 sentences>",
      "targets": "<which specific claim or claims in the essay does this counter-argument directly defeat?>",
      "damage": "<if this counter-argument goes unanswered, what specifically breaks? One sentence.>",
      "suggested_rebuttal": "<one sentence: how the author could preempt or rebut this>"
    }
  ],
  "rhetorical_analysis": {
    "opening_hook": "<evaluate the opening in 2 sentences>",
    "logical_flow": "<evaluate paragraph progression in 2 sentences>",
    "strongest_sentence": {
      "quote": "<the single best sentence in the essay, verbatim>",
      "why": "<one sentence: what specific quality makes this sentence work>"
    },
    "weakest_sentence": {
      "quote": "<the single most damaging sentence verbatim>",
      "why": "<one sentence: exactly what is wrong with it>",
      "fix": "<rewrite the sentence completely>"
    }
  },
  "rewrite_suggestions": [
    {
      "original": "<exact original sentence verbatim>",
      "rewrite": "<a complete, fully written replacement sentence>",
      "improvement": "<one sentence: what specifically makes the rewrite stronger>"
    }
  ]
}

HARD RULES:
Every diagnosis must be falsifiable and essay-specific.
Rewrite suggestions must be complete sentences, not instructions.
The strongest sentence field must always contain a real quote.
Never flag the thesis for lacking evidence.
Counter-arguments must be steelmanned.
All quotes must be verbatim from the essay.
All internal double quotes inside JSON strings MUST be escaped as \\".

Now evaluate the following essay and respond ONLY with the JSON object:
`;

app.use(express.json({ limit: "50kb" }));

// Serve static files from public/
app.use(express.static(join(__dirname, "../public")));

// ── Proxy route — API key never leaves the server ────────────────────────────
app.post("/api/analyze", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Server is missing OPENROUTER_API_KEY in environment." });
  }

  const { essay } = req.body;
  if (!essay || typeof essay !== "string" || essay.trim().length === 0) {
    return res.status(400).json({ error: "No essay provided." });
  }

  if (essay.trim().length > 40000) {
    return res.status(400).json({ error: "Essay exceeds maximum length (40,000 characters)." });
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": "Fracture Studio",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: essay.trim() },
        ],
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach OpenRouter: " + err.message });
  }

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return res.status(upstreamRes.status).json({ error: text });
  }

  // Forward SSE stream to the browser
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader  = upstreamRes.body.getReader();
  const decoder = new TextDecoder("utf-8");

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } catch (_) {
    // Client disconnected — this is expected
  } finally {
    res.end();
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`\n✦ Fracture Studio running at http://localhost:${PORT}\n`);
});
