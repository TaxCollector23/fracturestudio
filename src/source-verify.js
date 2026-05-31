const CLAIM_LIMIT = 10;
const RESULTS_PER_CLAIM = 4;
const SEARCH_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 7000;
const USER_AGENT = "FractureStudioSourceVerifier/1.0 (+https://fracturestudio.vercel.app)";

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "because", "before", "being",
  "between", "could", "does", "doing", "during", "each", "from", "have",
  "having", "into", "itself", "more", "most", "other", "over", "same",
  "should", "such", "than", "that", "their", "there", "these", "they",
  "this", "those", "through", "under", "until", "very", "were", "what",
  "when", "where", "which", "while", "will", "with", "would", "your"
]);

const FACTUAL_SIGNALS = [
  /\baccording to\b/i,
  /\b(study|report|survey|research|data|statistics|evidence|article|journal|book|source)\b/i,
  /\b(found|shows?|showed|suggests?|demonstrates?|indicates?|proves?|reported|published)\b/i,
  /\b(causes?|caused|leads? to|results? in|increases?|decreases?|reduces?|prevents?|improves?)\b/i,
  /\b(in|since|by|during)\s+(1[5-9]\d{2}|20\d{2})\b/i,
  /\b\d+(?:\.\d+)?\s*(%|percent|million|billion|thousand|years?|people|students|adults)\b/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,}\b/
];

const VAGUE_SOURCE_PATTERNS = [
  /\baccording to (a|an|the)?\s*(website|article|source|study|research|report)\b/i,
  /\bstudies show\b/i,
  /\bresearch says\b/i,
  /\bexperts say\b/i,
  /\bdata shows\b/i
];

export async function verifySources(input = {}) {
  const essay = typeof input.essay === "string" ? input.essay.trim() : "";
  const audit = input.audit && typeof input.audit === "object" ? input.audit : null;
  const extractedClaims = extractClaims(essay, audit).slice(0, CLAIM_LIMIT);

  if (!essay && !extractedClaims.length) {
    return {
      claims: [],
      works_cited: [],
      summary: {
        total_claims: 0,
        supported: 0,
        partially_supported: 0,
        unsupported: 0,
        contradicted: 0,
        source_not_found: 0,
        source_too_vague: 0,
        needs_review: 0,
        note: "No essay text or audit claims were provided."
      }
    };
  }

  const claims = [];
  const citedSources = new Map();

  for (const claim of extractedClaims) {
    const result = await verifyClaim(claim);
    claims.push(result);
    for (const source of result.sources) {
      if (source.url && !citedSources.has(source.url)) {
        citedSources.set(source.url, source);
      }
    }
  }

  const worksCited = Array.from(citedSources.values()).map((source) => ({
    url: source.url,
    title: source.title || source.site_name || source.url,
    entry: buildWorksCitedEntry(source)
  }));

  return {
    claims,
    works_cited: worksCited,
    summary: buildSummary(claims, worksCited)
  };
}

export function extractClaims(essay = "", audit = null) {
  const seen = new Set();
  const claims = [];
  const addClaim = (text, origin = "essay", priority = 4) => {
    const quote = cleanText(text);
    if (!quote || quote.length < 18) return;
    const key = quote.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    claims.push({
      id: `claim_${claims.length + 1}`,
      text: quote,
      origin,
      priority,
      query: buildSearchQuery(quote),
      citation_issues: detectCitationIssues(quote)
    });
  };

  if (audit) {
    addClaim(audit?.collapse_point?.quote, "audit.collapse_point", 1);
    for (const claim of ensureArray(audit?.argument_strength?.claims)) {
      addClaim(claim?.quote, "audit.argument_strength.claims", 2);
    }
    for (const fix of ensureArray(audit?.priority_fixes)) {
      addClaim(fix?.quote, "audit.priority_fixes", 3);
    }
  }

  for (const sentence of splitSentences(essay)) {
    if (looksFactual(sentence)) addClaim(sentence, "essay", 4);
  }

  return claims
    .sort((a, b) => a.priority - b.priority || b.text.length - a.text.length)
    .map((claim, index) => ({ ...claim, id: `claim_${index + 1}` }));
}

async function verifyClaim(claim) {
  if (isSourceTooVague(claim.text)) {
    return finalizeClaim(claim, [], "source_too_vague", "The claim invokes a source without enough identifying detail to verify it directly.");
  }

  let search;
  try {
    search = await searchOpenWeb(claim.query);
  } catch (err) {
    return finalizeClaim(claim, [], "needs_review", `Search failed gracefully: ${err?.message || String(err)}`);
  }

  if (!search.results.length && search.fallback_error) {
    return finalizeClaim(claim, [], "needs_review", `Search failed gracefully: ${search.fallback_error}`);
  }

  if (!search.results.length) {
    return finalizeClaim(claim, [], "source_not_found", "No usable public web result was found for this claim.");
  }

  const sources = [];
  for (const result of search.results.slice(0, RESULTS_PER_CLAIM)) {
    const metadata = await fetchPageMetadata(result.url);
    sources.push(normalizeSource({ ...result, ...metadata }));
  }

  const status = classifySupport(claim.text, sources);
  return finalizeClaim(claim, sources, status.status, status.reason);
}

function finalizeClaim(claim, sources, supportStatus, verificationNote) {
  return {
    id: claim.id,
    claim: claim.text,
    origin: claim.origin,
    search_query: claim.query,
    support_status: supportStatus,
    confidence: confidenceFor(supportStatus, sources),
    verification_note: verificationNote,
    citation_issues: claim.citation_issues,
    citation_issue_fields: citationIssueFields(claim.text, sources),
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      site_name: source.site_name,
      author: source.author,
      published_date: source.published_date,
      accessed_date: source.accessed_date,
      snippet: source.snippet,
      mla: buildWorksCitedEntry(source)
    }))
  };
}

async function searchOpenWeb(query) {
  const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let fallbackError = "";

  try {
    const html = await fetchText(ddgUrl, SEARCH_TIMEOUT_MS);
    const results = parseDuckDuckGoResults(html);
    if (results.length) return { results };
  } catch (err) {
    fallbackError = err?.message || String(err);
  }

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${RESULTS_PER_CLAIM}&namespace=0&format=json&origin=*`;
    const json = await fetchJson(wikiUrl, SEARCH_TIMEOUT_MS);
    const titles = ensureArray(json?.[1]);
    const descriptions = ensureArray(json?.[2]);
    const urls = ensureArray(json?.[3]);
    const results = urls.map((url, index) => ({
      title: titles[index] || url,
      url,
      snippet: descriptions[index] || ""
    }));
    return {
      results,
      fallback_error: fallbackError
    };
  } catch (err) {
    return {
      results: [],
      fallback_error: fallbackError || err?.message || String(err)
    };
  }
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  let match;

  while ((match = resultPattern.exec(html)) && results.length < RESULTS_PER_CLAIM) {
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[1]));
    if (!url || !/^https?:\/\//i.test(url)) continue;
    results.push({
      title: cleanText(stripHtml(match[2])),
      url,
      snippet: cleanText(stripHtml(match[3]))
    });
  }

  if (results.length) return dedupeResults(results);

  const loosePattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = loosePattern.exec(html)) && results.length < RESULTS_PER_CLAIM) {
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[1]));
    if (!url || !/^https?:\/\//i.test(url)) continue;
    results.push({
      title: cleanText(stripHtml(match[2])),
      url,
      snippet: ""
    });
  }

  return dedupeResults(results);
}

async function fetchPageMetadata(url) {
  try {
    const html = await fetchText(url, PAGE_TIMEOUT_MS);
    return {
      title: firstMeta(html, ["og:title", "twitter:title"]) || htmlTitle(html),
      author: firstMeta(html, ["author", "article:author", "byl"]),
      site_name: firstMeta(html, ["og:site_name", "application-name"]) || hostName(url),
      published_date: firstMeta(html, ["article:published_time", "date", "dc.date", "citation_publication_date"]),
      description: firstMeta(html, ["og:description", "twitter:description", "description"])
    };
  } catch (_) {
    return {
      site_name: hostName(url)
    };
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json"
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function classifySupport(claimText, sources) {
  const claimTerms = importantTerms(claimText);
  if (!claimTerms.length) {
    return {
      status: "source_too_vague",
      reason: "The claim does not contain enough distinctive terms for automated source matching."
    };
  }

  let bestOverlap = 0;
  let hasContradictionCue = false;
  for (const source of sources) {
    const sourceText = `${source.title || ""} ${source.snippet || ""} ${source.description || ""}`.toLowerCase();
    const overlap = claimTerms.filter((term) => sourceText.includes(term)).length / claimTerms.length;
    bestOverlap = Math.max(bestOverlap, overlap);
    if (hasNegationConflict(claimText, sourceText)) hasContradictionCue = true;
  }

  if (hasContradictionCue && bestOverlap >= 0.5) {
    return {
      status: "contradicted",
      reason: "The retrieved source metadata appears to discuss the same subject but contains a conflicting negation cue."
    };
  }
  if (bestOverlap >= 0.72) {
    return {
      status: "supported",
      reason: "Retrieved source metadata closely matches the claim's distinctive terms."
    };
  }
  if (bestOverlap >= 0.42) {
    return {
      status: "partially_supported",
      reason: "Retrieved sources match part of the claim, but the metadata does not verify every important detail."
    };
  }
  if (sources.length) {
    return {
      status: "unsupported",
      reason: "Search returned sources, but their metadata does not clearly support the claim."
    };
  }
  return {
    status: "source_not_found",
    reason: "No source was available to compare against the claim."
  };
}

function detectCitationIssues(text) {
  const issues = [];
  const hasSourceSignal = /\b(according to|study|report|research|survey|article|journal|book|data|source)\b/i.test(text);
  const hasUrl = /https?:\/\/|www\./i.test(text);
  const hasYear = /\b(1[5-9]\d{2}|20\d{2})\b/.test(text);
  const hasAuthorCue = /\bby\s+[A-Z][a-z]+|[A-Z][a-z]+ et al\./.test(text);
  const hasTitleCue = /"[^"]+"|“[^”]+”/.test(text);

  if (hasSourceSignal && !hasAuthorCue) issues.push("missing_author");
  if (hasSourceSignal && !hasTitleCue) issues.push("missing_title");
  if (hasSourceSignal && !hasYear) issues.push("missing_date");
  if (hasSourceSignal && !hasUrl) issues.push("missing_locator");
  if (VAGUE_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) issues.push("vague_source_reference");
  if (!hasSourceSignal && looksFactual(text)) issues.push("source_needed");

  return Array.from(new Set(issues));
}

function citationIssueFields(text, sources) {
  const best = sources[0] || {};
  return {
    author: best.author || null,
    title: best.title || null,
    publisher_or_site: best.site_name || null,
    publication_date: best.published_date || null,
    locator: best.url || null,
    access_date: best.accessed_date || todayIso(),
    in_text_citation_present: /\([^)]{2,}\)|\baccording to\b/i.test(text)
  };
}

function buildWorksCitedEntry(source) {
  const author = source.author ? `${source.author}. ` : "";
  const title = source.title ? `"${trimTrailingPunctuation(source.title)}." ` : "";
  const site = source.site_name ? `${trimTrailingPunctuation(source.site_name)}, ` : "";
  const date = source.published_date ? `${formatDateForMla(source.published_date)}, ` : "";
  const url = source.url || "";
  const accessed = `Accessed ${formatDateForMla(source.accessed_date || todayIso())}.`;
  return cleanText(`${author}${title}${site}${date}${url}. ${accessed}`);
}

function buildSummary(claims, worksCited) {
  const counts = {
    total_claims: claims.length,
    supported: 0,
    partially_supported: 0,
    unsupported: 0,
    contradicted: 0,
    source_not_found: 0,
    source_too_vague: 0,
    needs_review: 0
  };

  for (const claim of claims) {
    if (Object.prototype.hasOwnProperty.call(counts, claim.support_status)) {
      counts[claim.support_status] += 1;
    }
  }

  return {
    ...counts,
    works_cited_count: worksCited.length,
    note: "Automated verification uses public search metadata and should be treated as a triage layer, not a final scholarly source review."
  };
}

function buildSearchQuery(text) {
  const quoted = extractQuotedSource(text);
  if (quoted) return quoted;
  const terms = importantTerms(text).slice(0, 10);
  return terms.length ? terms.join(" ") : text.slice(0, 160);
}

function extractQuotedSource(text) {
  const quoted = text.match(/["“]([^"”]{8,120})["”]/);
  if (quoted) return quoted[1];
  const according = text.match(/\baccording to\s+([^,.]{4,100})/i);
  if (according) return according[1];
  return "";
}

function importantTerms(text) {
  return Array.from(new Set(String(text || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]{2,}/g) || []))
    .filter((term) => !STOP_WORDS.has(term) && !/^\d{1,2}$/.test(term))
    .slice(0, 16);
}

function looksFactual(sentence) {
  const text = String(sentence || "").trim();
  if (text.length < 18) return false;
  if (FACTUAL_SIGNALS.some((pattern) => pattern.test(text))) return true;
  return /\b(is|are|was|were|has|have|had)\b/i.test(text) && /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(text);
}

function isSourceTooVague(text) {
  const sourceVague = VAGUE_SOURCE_PATTERNS.some((pattern) => pattern.test(text));
  const terms = importantTerms(text);
  return sourceVague || terms.length < 3;
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeDuckDuckGoUrl(url) {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : parsed.href;
  } catch (_) {
    return "";
  }
}

function normalizeSource(source) {
  const accessedDate = todayIso();
  return {
    title: cleanText(source.title || source.url || "Untitled source"),
    url: source.url,
    site_name: cleanText(source.site_name || hostName(source.url)),
    author: cleanText(source.author || ""),
    published_date: cleanText(source.published_date || ""),
    accessed_date: accessedDate,
    snippet: cleanText(source.snippet || source.description || ""),
    description: cleanText(source.description || "")
  };
}

function firstMeta(html, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return cleanText(decodeHtml(match[1]));
    }
  }
  return "";
}

function htmlTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(decodeHtml(stripHtml(match[1]))) : "";
}

function hasNegationConflict(claimText, sourceText) {
  const claimNegated = /\b(no|not|never|without|doesn't|does not|isn't|is not|cannot|can't)\b/i.test(claimText);
  const sourceNegated = /\b(no|not|never|without|doesn't|does not|isn't|is not|cannot|can't)\b/i.test(sourceText);
  return claimNegated !== sourceNegated;
}

function confidenceFor(status, sources) {
  const base = {
    supported: 0.74,
    partially_supported: 0.55,
    unsupported: 0.42,
    contradicted: 0.48,
    source_not_found: 0.35,
    source_too_vague: 0.3,
    needs_review: 0.2
  }[status] || 0.25;
  return Number(Math.min(0.85, base + Math.min(sources.length, 3) * 0.03).toFixed(2));
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function stripHtml(text) {
  return String(text || "").replace(/<[^>]+>/g, " ");
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function cleanText(text) {
  return decodeHtml(stripHtml(String(text || "")))
    .replace(/\s+/g, " ")
    .trim();
}

function hostName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function trimTrailingPunctuation(text) {
  return String(text || "").replace(/[.!,;:]+$/g, "");
}

function formatDateForMla(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").trim();
  const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
