// Thin client for the Fracture backend (/api/*). Same-origin in production.

// Generic SSE reader: POSTs JSON, streams `data: {json}` events to onEvent().
async function streamSSE(url, body, onEvent, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { onEvent(JSON.parse(payload)); } catch (_) {}
    }
  }
}

// Run a full audit. Calls handlers as the report streams in.
export function analyze({ essay, preferences }, handlers = {}, signal) {
  return streamSSE("/api/analyze", { essay, preferences }, (ev) => {
    if (ev.fracture_progress) handlers.onProgress?.(ev.fracture_progress);
    if (ev.fracture_model_delta) handlers.onModelDelta?.(ev.fracture_model_delta);
    if (ev.fracture_report_start) handlers.onReportStart?.();
    if (ev.fracture_report_delta) handlers.onReportSection?.(ev.fracture_report_delta);
    if (ev.fracture_report_done) handlers.onReportDone?.();
    if (ev.fracture_audit) handlers.onAudit?.(ev.fracture_audit);
  }, signal);
}

// Chat / rebuttal share the plain-text stream shape.
export function streamText(kind, body, handlers = {}, signal) {
  const url = kind === "rebuttal" ? "/api/rebuttal" : "/api/chat";
  return streamSSE(url, body, (ev) => {
    if (ev.fracture_text_progress) handlers.onProgress?.(ev.fracture_text_progress);
    if (ev.fracture_text_delta) handlers.onDelta?.(ev.fracture_text_delta);
  }, signal);
}

// Ask the engine for a short, plain title summarizing a draft (for Past Work cards).
export async function summarizeTitle(draft) {
  let text = "";
  try {
    await streamText("chat", {
      message: "Write a clear, specific title of at most 8 words that says what this draft is about. Output ONLY the title — no quotes, no label, no trailing period, nothing else.",
      draft
    }, { onDelta: (d) => { text += d; } });
  } catch (_) { return ""; }
  // Clean up: first line only, strip any auto-appended evidence note / quotes / trailing punctuation.
  text = (text.split("\n").find((l) => l.trim()) || "")
    .replace(/evidence note[:.].*/i, "")
    .replace(/^["'“”]+|["'“”.]+$/g, "")
    .trim();
  return text.slice(0, 70);
}

export async function verifySources({ essay, audit, citation_style }) {
  const res = await fetch("/api/verify-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ essay, audit, citation_style })
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Source check failed");
  return res.json();
}

export async function exportPdf({ audit, sources, draft, citation_style }) {
  const res = await fetch("/api/report-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/pdf" },
    body: JSON.stringify({ audit, sources, draft, citation_style })
  });
  if (!res.ok) throw new Error("PDF export failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fracture-studio-report.pdf";
  a.click();
  URL.revokeObjectURL(a.href);
}
