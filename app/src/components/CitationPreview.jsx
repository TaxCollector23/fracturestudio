// CitationPreview.jsx — the one place citations are displayed while editing.
// Every citation string comes from lib/citations.js; nothing is hardcoded
// here. Switching styles, copying, and reviewing missing metadata all happen
// in this widget so the source library, evidence cards, and bibliography stay
// consistent by construction.

import { useState } from "react";
import { Link2, AlertTriangle, Check } from "lucide-react";
import { CITATION_STYLES, citationPreview, citationIssues, formatCitation, styleLabel } from "../lib/citations.js";
import { cx } from "../lib/ui.js";
import { CopyButton } from "./ResearchKit.jsx";

export default function CitationPreview({ source, compact = false }) {
  const [style, setStyle] = useState("mla");
  const [copied, setCopied] = useState("");

  const previews = citationPreview(source || {});
  const issues = citationIssues(source || {});
  const severity = { high: "text-red-500", medium: "text-amber-600 dark:text-amber-400", low: "faint" };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1400);
    } catch (_) {}
  };

  return (
    <div className="rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
        <span className="label-mono !text-[10px]">Citation</span>
        <div className="flex items-center gap-1">
          {CITATION_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={cx("px-2 py-0.5 rounded-sm text-[11px] font-mono transition-colors",
                style === s.id ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-sm leading-relaxed">
          {previews[style] || <span className="faint italic">Complete the source details to generate a citation.</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <CopyButton text={previews[style]} label="Copy citation" />
          <CopyButton text={formatCitation(source || {}, "debate")} label="Copy debate attribution" />
        </div>
      </div>

      {!compact && issues.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium muted">
            <AlertTriangle size={11} /> Missing information affects citation quality
          </div>
          {issues.map((i, idx) => (
            <p key={idx} className={cx("text-[11px] leading-snug", severity[i.severity])}>
              {i.message}
            </p>
          ))}
        </div>
      )}

      {copied && (
        <div className="sr-only" role="status">Copied {styleLabel(style)} citation</div>
      )}
    </div>
  );
}

/** Bare copy link used in list rows — keeps attribution consistent everywhere. */
export function AttributionLine({ source, className = "" }) {
  const text = formatCitation(source || {}, "debate");
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-mono faint", className)}>
      <Link2 size={10} className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}
