// citations.js — the centralized citation engine.
//
// A source has ONE canonical structured metadata shape (see research.js).
// Every citation style is generated from that shape here — no citation
// strings are ever hardcoded in UI components. Styles are a registry so new
// styles (Turabian, IEEE, …) are one entry + one formatter.
//
// Canonical source fields used by the engine:
//   title, url, doi, pages,
//   authors: [{ name, organization? }]   — [] or [{name: "Organization"}] for org authors
//   publication (container, e.g. "The New York Times" or journal name),
//   publisher,
//   publishDate ("2026-08-20" | "2026-08" | "2026" | ""),
//   accessDate (ISO date for web sources)

export const CITATION_STYLES = [
  { id: "mla", label: "MLA" },
  { id: "apa", label: "APA" },
  { id: "chicago", label: "Chicago" },
  { id: "debate", label: "Debate card" }
];

// ─── Author helpers ──────────────────────────────────────────────────────────

/** "John Quincy Smith" → { first: "John", middle: "Quincy", last: "Smith" } */
export function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: "", middle: "", last: parts[0] };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] };
}

function isOrg(a) {
  return !!a?.organization || (a?.name && !String(a.name).includes(" "));
}

/** "Smith, John" (MLA / Chicago) — orgs pass through as-is. */
export function authorInverted(a) {
  if (isOrg(a)) return a.name;
  const { first, middle, last } = splitName(a.name);
  if (!last) return a.name || "";
  return middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
}

/** "Smith, J. Q." (APA) — orgs pass through as-is. */
export function authorApa(a) {
  if (isOrg(a)) return a.name;
  const { first, middle, last } = splitName(a.name);
  const initials = [first, ...(middle ? middle.split(" ") : [])]
    .filter(Boolean).map((w) => w[0] + ".").join(" ");
  return `${last}, ${initials}`.trim();
}

/**
 * MLA / Chicago bibliography author convention: first author inverted,
 * later authors natural — "Smith, John, and Jane Doe" (2), "… Jane Doe, and
 * Bob Jones" (3), "Smith, John, et al." (4+). Orgs pass through as-is.
 */
export function authorMlaChicago(authors) {
  const list = (authors || []).filter((a) => a?.name);
  if (list.length === 0) return "";
  if (list.length === 1) return authorInverted(list[0]);
  if (list.length <= 3) {
    const first = authorInverted(list[0]);
    const rest = list.slice(1).map((a) => (isOrg(a) ? a.name : String(a.name).trim()));
    if (rest.length === 1) return `${first}, and ${rest[0]}`;
    return `${first}, ${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}`;
  }
  return `${authorInverted(list[0])}, et al.`;
}

/**
 * APA 7 author list: "A, & B" (2), "A, B, & C" (3–20), "A, … , Z" (21+).
 */
function authorApaList(authors) {
  const list = (authors || []).filter((a) => a?.name).map(authorApa);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  if (list.length <= 20) return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(", ")}, … ${list[list.length - 1]}`;
}

/** Debate-card author shorthand: "Smith, J., Chen, M." / "Smith, J., et al." */
export function authorDebate(authors) {
  const list = (authors || []).filter((a) => a?.name).map(authorShort);
  if (list.length === 0) return "";
  if (list.length === 2) return `${list[0]}, ${list[1]}`;
  if (list.length > 2) return `${list[0]}, et al.`;
  return list[0];
}

function authorShort(a) {
  if (isOrg(a)) return a.name;
  const { last, first } = splitName(a.name);
  return last && first ? `${last}, ${first[0]}.` : a.name || "";
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS = ["", "Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const MONTHS_FULL = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Parse "2026-08-20", "2026-08", "2026" into {year, month, day} (1-based; 0 = unknown). */
export function parseSourceDate(value) {
  const s = String(value || "").trim();
  if (!s) return { year: 0, month: 0, day: 0, raw: "" };
  const m = s.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (!m) return { year: 0, month: 0, day: 0, raw: s };
  return {
    year: Number(m[1]),
    month: m[2] ? Number(m[2]) : 0,
    day: m[3] ? Number(m[3]) : 0,
    raw: s
  };
}

function mlaDate(d) {
  if (!d.year) return "n.d.";
  const base = d.month ? `${MONTHS[d.month] || d.month} ${d.year}` : String(d.year);
  return d.day ? `${d.day} ${base}` : base;
}

function apaDate(d) {
  if (!d.year) return "n.d.";
  if (!d.month) return String(d.year);
  if (!d.day) return `${d.year}, ${MONTHS_FULL[d.month] || d.month}`;
  return `${d.year}, ${MONTHS_FULL[d.month] || d.month} ${d.day}`;
}

function chicagoDate(d) {
  if (!d.year) return "n.d.";
  if (!d.month) return String(d.year);
  if (!d.day) return `${MONTHS_FULL[d.month] || d.month} ${d.year}`;
  return `${MONTHS_FULL[d.month] || d.month} ${d.day}, ${d.year}`;
}

// ─── Title helpers ───────────────────────────────────────────────────────────

/**
 * APA uses sentence case for article titles. Known single-letter acronyms
 * (U.S., U.K., E.U., …) are protected so they survive lowercasing, and a
 * period inside an acronym never reads as a sentence break.
 */
export function sentenceCase(title) {
  const masked = [];
  const protectedPattern = /(^|[^A-Za-z])([A-Z](?:\.[A-Z])+\.?)(?=$|[^A-Za-z])/g;
  const s = String(title || "").replace(protectedPattern, (_m, pre, acro) => {
    masked.push(acro.toUpperCase());
    return pre + `\u0000${masked.length - 1}\u0000`;
  });
  const lower = s.toLowerCase();
  const capped = lower.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, c) => p + c.toUpperCase());
  return capped.replace(/\u0000(\d+)\u0000/g, (_m, i) => masked[Number(i)]);
}

function cleanUrl(url) {
  const u = String(url || "").trim();
  return u && /^https?:\/\//i.test(u) ? u : "";
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/**
 * MLA (9th ed). Trailing commas are used between elements (Container,
 * Publisher, Date, URL) and cleaned to a period at the end.
 */
function mlaFormat(s) {
  const date = parseSourceDate(s.publishDate);
  const author = authorMlaChicago(s.authors);
  const title = String(s.title || "").trim();
  const container = String(s.publication || "").trim();
  const publisher = String(s.publisher || "").trim();
  const url = cleanUrl(s.url);
  const hasUrl = !!url;
  const useND = !date.year && (hasUrl || container); // "n.d." only where something follows

  const seg = [];
  if (author) seg.push(`${author}.`);
  if (title) seg.push(`“${title}.”`);
  if (container) seg.push(`*${container}*,`);
  if (publisher) seg.push(`${publisher},`);
  if (date.year) seg.push(`${mlaDate(date)},`);
  else if (useND) seg.push("n.d.,");
  if (hasUrl) {
    seg.push(`${url}.`);
    if (s.accessDate) seg.push(`Accessed ${mlaDate(parseSourceDate(s.accessDate))}.`);
  }
  const out = seg.join(" ");
  return out.endsWith(",") ? out.slice(0, -1) + "." : out;
}

/** APA 7. Author initials carry their own periods; a single "." follows the list. */
function apaFormat(s) {
  const date = parseSourceDate(s.publishDate);
  const authors = (s.authors || []).filter((a) => a?.name);
  const title = sentenceCase(s.title);
  const container = String(s.publication || "").trim();
  const url = cleanUrl(s.url);
  const pages = String(s.pages || "").trim();

  const seg = [];
  if (authors.length) {
    const list = authorApaList(authors).replace(/\.\s*$/, "");
    seg.push(`${list}.`);
  } else if (title) {
    seg.push(`${title}.`);
  }
  seg.push(`(${apaDate(date)}).`);
  if (title && authors.length) seg.push(`${title}.`);
  if (container) seg.push(`*${container}*.`);
  if (pages) seg.push(`pp. ${pages}.`);
  if (url) seg.push(url);
  return seg.join(" ");
}

/** Chicago notes-bibliography (web/journal shorthand). */
function chicagoFormat(s) {
  const date = parseSourceDate(s.publishDate);
  const author = authorMlaChicago(s.authors);
  const title = String(s.title || "").trim();
  const container = String(s.publication || "").trim();
  const url = cleanUrl(s.url);

  const seg = [];
  if (author) seg.push(`${author}.`);
  if (title) seg.push(`“${title}.”`);
  if (container) seg.push(`*${container}*,`);
  if (date.year) seg.push(`${chicagoDate(date)}.`);
  if (url) seg.push(`${url}.`);
  const out = seg.join(" ");
  return out.endsWith(",") ? out.slice(0, -1) + "." : out;
}

/** Short attribution for debate evidence cards: Author — Publication, Date. */
function debateFormat(s) {
  const author = authorDebate(s.authors);
  const container = String(s.publication || "").trim();
  const date = parseSourceDate(s.publishDate);
  const who = author || container || "Unknown source";
  const when = date.year ? (date.month ? `${MONTHS[date.month]} ${date.year}` : String(date.year)) : "n.d.";
  const containerBit = author ? (container ? `, ${container}` : "") : "";
  return `${who}${containerBit}, ${when}`;
}

const FORMATTERS = {
  mla: mlaFormat,
  apa: apaFormat,
  chicago: chicagoFormat,
  debate: debateFormat
};

/** Generate a citation from canonical source metadata. Never fabricates data. */
export function formatCitation(source, style = "mla") {
  const fn = FORMATTERS[style] || FORMATTERS.mla;
  return fn(source || {});
}

/** Pre-formatted citation for every supported style (for preview tabs). */
export function citationPreview(source) {
  const out = {};
  for (const s of CITATION_STYLES) out[s.id] = formatCitation(source, s.id);
  return out;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function isValidUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/** DOI pattern: 10.<4-9 digits>/<characters> (lenient on the suffix). */
export function isValidDoi(doi) {
  return /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(String(doi || "").trim());
}

/**
 * Citation metadata issues. The goal is to explain impact, not reject the
 * source: missing data produces the best valid citation, and this tells the
 * user what that cost is.
 */
export function citationIssues(source) {
  const s = source || {};
  const issues = [];
  const url = String(s.url || "").trim();
  if (!String(s.title || "").trim()) issues.push({ field: "title", severity: "high", message: "No title — citations will start with the publication or URL instead." });
  if (!(s.authors || []).some((a) => a?.name)) issues.push({ field: "authors", severity: "medium", message: "No author — the publication or organization will stand in as author." });
  if (!String(s.publication || "").trim()) issues.push({ field: "publication", severity: "medium", message: "No publication/container — MLA and APA lose their container element." });
  if (!s.publishDate) issues.push({ field: "publishDate", severity: "low", message: "No publication date — citations will read “n.d.” (no date)." });
  if (url && !isValidUrl(url)) issues.push({ field: "url", severity: "medium", message: "That URL doesn't look valid — check it before citing." });
  if (s.doi && !isValidDoi(s.doi)) issues.push({ field: "doi", severity: "medium", message: "That DOI doesn't match the 10.xxxx/xxxx pattern." });
  return issues;
}

/** Sort key for alphabetical bibliography ordering (MLA/APA/Chicago). */
export function bibliographySortKey(source) {
  const first = (source?.authors || []).find((a) => a?.name);
  const base = first ? authorInverted(first) : (source?.title || "").trim();
  return base.toLowerCase().replace(/^(a|an|the)\s+/, "");
}

export function styleLabel(id) {
  return CITATION_STYLES.find((s) => s.id === id)?.label || id;
}
