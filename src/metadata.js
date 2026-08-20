// metadata.js — server-side source metadata extraction.
//
// Design goals (from the research spec):
//   * Reliable extraction of public metadata (title, description, author,
//     publication date, canonical URL, Open Graph / structured tags).
//   * NO heavy crawler — one GET per URL, small timeout.
//   * Extracted metadata is treated as *imported*, never as guaranteed truth.
//     Every field stays editable client-side, and provenance is tracked.
//   * Clear fallback states: when nothing can be extracted the client gets a
//     structured reason so it can offer manual entry instead of a broken record.

export const FETCH_TIMEOUT_MS = 8000;
export const MAX_HTML_BYTES = 1_500_000; // 1.5 MB cap on pages we parse

// ─── URL handling ────────────────────────────────────────────────────────────

/** Validate and lightly canonicalize a URL. Throws with a friendly message. */
export function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Enter a URL to extract metadata from.");
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL. Check it and try again.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be read. Try a full web address.");
  }
  u.hash = "";
  return u.toString();
}

// ─── HTML metadata parsing (pure) ────────────────────────────────────────────

const SELF_CLOSING = new Set(["meta", "link", "img", "br", "hr", "input", "source"]);

/**
 * Split an HTML string into tag objects: { tag, attrs } where attrs maps
 * lowercased attribute names to decoded values. Handles attributes in any
 * order and both single/double quotes. Not a real parser — good enough for
 * head-level meta/link/title extraction, which is all we need.
 */
export function tokenizeTags(html) {
  const tags = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = {};
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let a;
    while ((a = attrRe.exec(m[2])) !== null) {
      attrs[a[1].toLowerCase()] = decodeEntities(a[3] ?? a[4] ?? a[5] ?? "");
    }
    tags.push({ tag, attrs, selfClosing: SELF_CLOSING.has(tag) });
  }
  return tags;
}

const NAMED_ENTITIES = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", copy: "©", reg: "®", deg: "°", times: "×", middot: "·",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  agrave: "à", aacute: "á", egrave: "è", eacute: "é", igrave: "ì", iacute: "í",
  ograve: "ò", oacute: "ó", ugrave: "ù", uacute: "ú", ntilde: "ñ", ccedil: "ç"
};

function decodeEntitiesOnce(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ent) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

function decodeEntities(s) {
  // Iterate so double-encoded entities (e.g. &amp;eacute;) resolve fully.
  let out = String(s);
  for (let i = 0; i < 3; i++) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function firstMeta(tags, names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const t of tags) {
    if (t.tag !== "meta") continue;
    const key = String(t.attrs.name || t.attrs.property || t.attrs.itemprop || "").toLowerCase();
    if (wanted.has(key) && clean(t.attrs.content)) return clean(t.attrs.content);
  }
  return "";
}

function firstLink(tags, rels) {
  const wanted = new Set(rels.map((r) => r.toLowerCase()));
  for (const t of tags) {
    if (t.tag !== "link") continue;
    const rel = String(t.attrs.rel || "").toLowerCase().split(/\s+/);
    if (rel.some((r) => wanted.has(r)) && clean(t.attrs.href)) return clean(t.attrs.href);
  }
  return "";
}

function titleFromTags(tags, html) {
  const og = firstMeta(tags, ["og:title"]);
  if (og) return og;
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || "");
  if (m) {
    const raw = decodeEntities(m[1]);
    if (clean(raw)) return clean(raw);
  }
  return "";
}

function splitTitle(title, siteName) {
  if (!title) return "";
  if (!siteName) return title;
  for (const sep of [" – ", " — ", " | "]) {
    if (title.includes(sep) && title.toLowerCase().endsWith(siteName.toLowerCase())) {
      const lead = title.slice(0, title.indexOf(sep)).trim();
      if (lead) return lead;
    }
  }
  return title;
}

/**
 * Infer a likely source type from the domain. This is a heuristic and is
 * always labeled "inferred" client-side — users can override it freely.
 */
export function inferSourceType(url, siteName = "") {
  const u = String(url || "");
  const site = String(siteName || "").toLowerCase();
  const blob = `${u} ${site}`;
  if (/(\.gov\b|\.mil\b)/i.test(blob)) return "government";
  if (/(arxiv|ssrn|researchgate|semanticscholar|ncbi\.nlm|pubmed)/i.test(blob)) return "academic";
  if (/(sciencedirect|springer|wiley|nature\.com|science\.org|jstor|plos)/i.test(blob)) return "journal";
  if (/\.edu\b/i.test(blob)) return "academic";
  if (/(nytimes|washingtonpost|wsj|theguardian|cnn|bbc|apnews|reuters|npr|politico|thehill|axios|vox|economist|wired|time\.com|forbes|bloomberg|cnbc|usatoday|latimes)/i.test(blob)) return "news";
  return "website";
}

/**
 * Extract the useful metadata we can find in a page's HTML. Pure and
 * dependency-free so it is unit-testable offline. Returns only fields that
 * were actually found; callers compare against known fields to report what is
 * missing.
 */
export function extractMetadataFromHtml(html, baseUrl = "") {
  const tags = tokenizeTags(html);
  const ogUrl = firstMeta(tags, ["og:url"]);
  const canonical = firstLink(tags, ["canonical"]);
  const siteName = firstMeta(tags, ["og:site_name"]);
  const rawTitle = titleFromTags(tags, html) || firstMeta(tags, ["twitter:title"]);
  const title = splitTitle(rawTitle, siteName);

  let resolvedUrl = "";
  for (const candidate of [ogUrl, canonical, baseUrl]) {
    if (!candidate) continue;
    try {
      resolvedUrl = normalizeUrl(candidate);
      break;
    } catch {
      // try the next candidate
    }
  }

  const author =
    firstMeta(tags, ["author", "article:author", "dc.creator", "parsely-author"]) ||
    firstMeta(tags, ["citation_author"]);

  const date =
    firstMeta(tags, ["article:published_time", "datepublished", "pubdate", "date", "dc.date", "citation_publication_date", "parsely-pub-date"]) ||
    firstMeta(tags, ["article:modified_time"]);

  const description =
    firstMeta(tags, ["description", "og:description", "twitter:description"]);

  const keywords = firstMeta(tags, ["keywords", "news_keywords"]);

  const out = {};
  if (title) out.title = title;
  if (siteName) out.publication = siteName;
  if (author) out.author = author;
  if (date) out.publishDate = String(date).slice(0, 10); // normalize ISO-ish
  if (description) out.description = description;
  if (resolvedUrl) out.url = resolvedUrl;
  if (keywords) out.tags = keywords.split(",").map((k) => clean(k)).filter(Boolean).slice(0, 6);
  out.sourceType = inferSourceType(resolvedUrl || baseUrl, siteName);
  return out;
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/** Fetch one page with a hard timeout and a size cap. Never follows into big files. */
export async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FractureResearch/1.0; +https://fracturestudio.com)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!res.ok) {
      const status = res.status;
      if (status === 403 || status === 401) {
        throw new Error("This site blocks automated reading (HTTP " + status + "). You can still add the source manually.");
      }
      if (status === 404) throw new Error("That page wasn't found (HTTP 404). Check the URL.");
      throw new Error("The page could not be read (HTTP " + status + ").");
    }
    const text = await res.text();
    if (text.length > MAX_HTML_BYTES) {
      throw new Error("This page is too large to extract metadata from safely.");
    }
    return text;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("The site took too long to respond. Add the source manually instead.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const KNOWN_FIELDS = ["title", "publication", "author", "publishDate", "description", "url", "tags"];

/**
 * Full workflow: validate → fetch → extract. Always returns a structured
 * result: `{ status: "ok", source, verified, missing }` or
 * `{ status: "error", message }` with a human-readable reason.
 */
export async function extractSourceMetadata(rawUrl) {
  let url;
  try {
    url = normalizeUrl(rawUrl);
  } catch (err) {
    return { status: "error", message: err.message };
  }

  let html;
  try {
    html = await fetchPage(url);
  } catch (err) {
    return {
      status: "error",
      message: err?.message || "Could not read that page.",
      url
    };
  }

  const extracted = extractMetadataFromHtml(html, url);
  const found = KNOWN_FIELDS.filter((f) => extracted[f] !== undefined && extracted[f] !== "");
  const missing = KNOWN_FIELDS.filter((f) => extracted[f] === undefined || extracted[f] === "");

  return {
    status: "ok",
    source: {
      ...extracted,
      url: extracted.url || url,
      // Provenance: everything here was imported from the page, never verified.
      _prov: Object.fromEntries(found.map((f) => [f, "imported"]))
    },
    verified: found,
    missing,
    inferredType: !!extracted.sourceType
  };
}
