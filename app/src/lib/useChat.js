import { useState, useRef, useEffect, useCallback } from "react";
import { streamText } from "./api.js";

/**
 * Owns the Fracture Chat panel: open/close, message history, streaming
 * replies, and the "ask about this quote" flow. The audit is read-only
 * context passed in by the page.
 */
export function useChat({ draft, audit }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const askAbout = useCallback((quote) => {
    setSelectedPoint(quote);
    setOpen(true);
    setInput((q) => q || "Fix this pressure point and give me a paste-ready rewrite.");
  }, []);

  const clear = useCallback(() => {
    setMsgs([]);
    setSelectedPoint(null);
  }, []);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy) return;
    const point = selectedPoint;
    setInput("");
    setSelectedPoint(null);
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      await streamText("chat", { message: q, draft, report: audit, selectedPoint: point, history: msgs.slice(-8) }, {
        onDelta: (d) => setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + d };
          return copy;
        })
      });
    } catch (e) {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Chat error: " + (e?.message || "") };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }, [input, busy, selectedPoint, draft, audit, msgs]);

  return {
    open, setOpen,
    msgs, input, setInput,
    busy, selectedPoint, setSelectedPoint,
    endRef, askAbout, send, clear
  };
}
