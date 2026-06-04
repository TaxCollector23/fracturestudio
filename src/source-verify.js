import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const CLAIM_LIMIT = 8;
const RESULTS_PER_CLAIM = 5;
const RESEARCH_RESULT_LIMIT = 5;
const SEARCH_TIMEOUT_MS = 4500;
const PAGE_TIMEOUT_MS = 4000;
const PAGE_MAX_BYTES = 350000;
const MAX_REDIRECTS = 3;
const VERIFY_DEADLINE_MS = 28000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const USER_AGENT = "FractureStudioSourceVerifier/1.0 (+https://fracturestudio.vercel.app)";
const searchCache = new Map();

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
  const citationStyle = normalizeCitationStyle(input.citationStyle);
  const extractedClaims = extractClaims(essay, audit).slice(0, CLAIM_LIMIT);

  if (!essay && !extractedClaims.length) {
    return {
      citation_style: citationStyle,
      bibliography_title: citationStyle === "apa" ? "References" : "Works Cited",
      claims: [],
      works_cited: [],
      summary: {
        total_claims: 0,
        likely_supported: 0,
        partial_match: 0,
        needs_source_review: 0,
        possible_conflict: 0,
        source_not_found: 0,
        citation_incomplete: 0,
        source_too_vague: 0,
        needs_review: 0,
        note: "No essay text or audit claims were provided."
      }
    };
  }

  const claims = [];
  const citedSources = new Map();
  const deadline = Date.now() + VERIFY_DEADLINE_MS;

  for (const claim of extractedClaims) {
    const result = Date.now() < deadline - 1500
      ? await verifyClaim(claim, citationStyle)
      : finalizeClaim(claim, [], "needs_review", "The source-review time limit was reached. Check this claim manually or run Verify Sources again.", citationStyle);
    claims.push(result);
    const bestSource = result.sources.find((source) => source.match_score >= 0.72 && source.url);
    if (result.support_status === "likely_supported" && bibliographyReady(result, bestSource) && !citedSources.has(bestSource.url)) {
      citedSources.set(bestSource.url, bestSource);
    }
  }

  const worksCited = Array.from(citedSources.values()).map((source) => ({
    url: source.url,
    title: source.title || source.site_name || source.url,
    style: citationStyle,
    entry: buildCitationEntry(source, citationStyle),
    mla: buildMlaEntry(source),
    apa: buildApaEntry(source)
  }));

  const researchSuggestions = await buildResearchSuggestions({ essay, audit, citationStyle, deadline });

  return {
    citation_style: citationStyle,
    bibliography_title: citationStyle === "apa" ? "References" : "Works Cited",
    claims,
    works_cited: worksCited,
    research_suggestions: researchSuggestions,
    summary: buildSummary(claims, worksCited, citationStyle)
  };
}

async function buildResearchSuggestions({ essay, audit, citationStyle, deadline }) {
  const thesis = extractThesisForResearch(essay, audit);
  const terms = importantTerms(thesis || essay).slice(0, 8).join(" ");
  if (!terms) return [];

  const leads = [];

  for (const item of ensureArray(audit?.citation_opportunities).slice(0, 4)) {
    const query = ensureArray(item?.search_queries || item?.source_search_queries || item?.queries).find(Boolean)
      || `${importantTerms(`${item?.claim_to_support || item?.claim || terms} ${item?.evidence_type || ""}`).slice(0, 8).join(" ")} data report evidence`;
    leads.push({
      label: "Citation source lead",
      title: cleanText(item?.claim_to_support || item?.claim || "Find a source for a claim Fracture flagged."),
      explanation: cleanText(item?.why_it_matters || item?.reason || "Open these links and only cite the source if it directly supports the exact sentence."),
      query
    });
  }

  for (const item of ensureArray(audit?.extra_argument_ideas).slice(0, 4)) {
    const query = ensureArray(item?.source_search_queries || item?.search_queries || item?.research_queries).find(Boolean)
      || `${importantTerms(`${item?.argument || terms} ${item?.evidence_needed || ""}`).slice(0, 8).join(" ")} evidence report`;
    leads.push({
      label: "Extra argument source lead",
      title: cleanText(item?.argument || item?.title || "Research a missing argument that may support your thesis."),
      explanation: cleanText(item?.why_it_supports_thesis || item?.why_it_matters || item?.explanation || "Use the links to test whether this missing argument is real and worth adding."),
      query
    });
  }

  leads.push(
    {
      label: "Statistics to add",
      title: "Find one concrete number that proves the size, trend, or impact of your claim.",
      explanation: "Use these links as starting points for data. Do not cite a number until the page directly supports the exact sentence you write.",
      query: `${terms} statistics data report evidence`
    },
    {
      label: "Extra argument to consider",
      title: "Look for a second reason that supports your thesis from a different angle.",
      explanation: "This is meant to surface a possible missing argument, not to invent evidence. Only add it if one of the linked sources actually supports it.",
      query: `${terms} arguments evidence benefits harms`
    },
    {
      label: "Opponent research",
      title: "Find the strongest source-backed objection before someone else uses it.",
      explanation: "Open these links to prepare a rebuttal or qualifier. A good case gets stronger when it knows the best attack against it.",
      query: `${terms} criticism counterargument limitations evidence`
    }
  );

  const suggestions = [];
  for (const lead of leads) {
    if (Date.now() > deadline - 3500) break;
    try {
      const search = await searchOpenWeb(lead.query);
      const links = (search.results || []).slice(0, RESEARCH_RESULT_LIMIT).map((result) => {
        const source = normalizeSource({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          site_name: hostName(result.url),
          accessed_date: todayIso()
        });
        return {
          title: source.title || source.site_name || source.url,
          url: source.url,
          site_name: source.site_name,
          snippet: source.snippet || "",
          mla: buildMlaEntry(source),
          apa: buildApaEntry(source),
          citation: buildCitationEntry(source, citationStyle)
        };
      });
      suggestions.push({
        label: lead.label,
        title: lead.title,
        explanation: lead.explanation,
        search_query: lead.query,
        links
      });
    } catch (err) {
      suggestions.push({
        label: lead.label,
        title: lead.title,
        explanation: `${lead.explanation} Search could not complete: ${err?.message || String(err)}`,
        search_query: lead.query,
        links: []
      });
    }
  }

  return suggestions;
}

function extractThesisForResearch(essay = "", audit = null) {
  const candidates = [
    audit?.argument_strength?.thesis?.quote,
    audit?.thesis?.quote,
    audit?.collapse_point?.quote,
    audit?.verdict,
    splitSentences(essay).find((sentence) => sentence.length >= 24)
  ];
  return cleanText(candidates.find((value) => typeof value === "string" && value.trim()) || essay).slice(0, 280);
}

export function extractClaims(essay = "", audit = null) {
  const seen = new Set();
  const claims = [];
  const addClaim = (text, origin = "essay", priority = 4, options = {}) => {
    const quote = cleanText(text);
    if (!quote || quote.length < (options.quotedPassage ? 12 : 18)) return;
    const key = quote.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    claims.push({
      id: `claim_${claims.length + 1}`,
      text: quote,
      origin,
      priority,
      quoted_passage: options.quotedPassage || "",
      query: buildSearchQuery(quote, options.quotedPassage),
      citation_issues: options.quotedPassage
        ? Array.from(new Set([...detectCitationIssues(quote), "source_needed"]))
        : detectCitationIssues(quote)
    });
  };

  for (const quote of extractQuotedPassages(essay)) {
    addClaim(quote, "draft.quoted_passage", 1, { quotedPassage: quote });
  }

  if (audit) {
    addAuditClaim(audit?.collapse_point?.quote, "audit.collapse_point", 2);
    for (const claim of ensureArray(audit?.argument_strength?.claims)) {
      addAuditClaim(claim?.quote, "audit.argument_strength.claims", 3);
    }
    for (const fix of ensureArray(audit?.priority_fixes)) {
      addAuditClaim(fix?.quote, "audit.priority_fixes", 4);
    }
  }

  for (const sentence of splitSentences(essay)) {
    if (looksFactual(sentence)) addClaim(sentence, "essay", 5);
  }

  return claims
    .sort((a, b) => a.priority - b.priority || b.text.length - a.text.length)
    .map((claim, index) => ({ ...claim, id: `claim_${index + 1}` }));

  function addAuditClaim(text, origin, priority) {
    const cleaned = cleanText(text);
    if (looksCitationRelevant(cleaned)) addClaim(cleaned, origin, priority);
  }
}

async function verifyClaim(claim, citationStyle) {
  const citationTooVague = isSourceTooVague(claim.text);

  let search;
  try {
    search = await searchOpenWeb(claim.query);
  } catch (err) {
    return finalizeClaim(claim, [], "needs_review", `Search failed gracefully: ${err?.message || String(err)}`, citationStyle);
  }

  if (!search.results.length && search.fallback_error) {
    return finalizeClaim(claim, [], "needs_review", `Search failed gracefully: ${search.fallback_error}`, citationStyle);
  }

  if (!search.results.length) {
    return finalizeClaim(
      claim,
      [],
      citationTooVague ? "citation_incomplete" : "source_not_found",
      citationTooVague
        ? "The draft does not identify the source precisely enough, and the public search did not find a dependable match."
        : "No usable public web result was found for this claim.",
      citationStyle
    );
  }

  const sources = await Promise.all(search.results.slice(0, RESULTS_PER_CLAIM).map(async (result) => {
    const metadata = await fetchPageMetadata(result.url);
    return normalizeSource({ ...result, ...metadata });
  }));

  const scoredSources = sources
    .map((source) => ({
      ...source,
      match_score: sourceMatchScore(claim.text, source),
      quote_match: claim.quoted_passage ? quotedPassageMatch(claim.quoted_passage, source) : null
    }))
    .sort((a, b) => b.match_score - a.match_score);
  const status = classifySupport(claim, scoredSources, citationTooVague);
  return finalizeClaim(claim, scoredSources, status.status, status.reason, citationStyle);
}

function finalizeClaim(claim, sources, supportStatus, verificationNote, citationStyle) {
  return {
    id: claim.id,
    claim: claim.text,
    origin: claim.origin,
    search_query: claim.query,
    quoted_passage: claim.quoted_passage || null,
    support_status: supportStatus,
    confidence: confidenceFor(supportStatus, sources),
    verification_note: verificationNote,
    verification_scope: "Public web search and retrieved page text comparison. Open the source before treating the claim as verified.",
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
      match_score: source.match_score,
      quote_match: source.quote_match,
      page_retrieved: source.page_retrieved,
      mla: buildMlaEntry(source),
      apa: buildApaEntry(source),
      citation: buildCitationEntry(source, citationStyle)
    }))
  };
}

async function searchOpenWeb(query) {
  const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const readerLiteUrl = `https://r.jina.ai/http://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const errors = [];
  const cached = searchCache.get(query);

  if (cached && Date.now() - cached.createdAt < SEARCH_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const html = await fetchText(ddgUrl, SEARCH_TIMEOUT_MS);
    const results = parseDuckDuckGoResults(html);
    if (results.length) return cacheSearch(query, { results });
  } catch (err) {
    errors.push(`standard search: ${err?.message || String(err)}`);
  }

  try {
    const html = await fetchText(liteUrl, SEARCH_TIMEOUT_MS);
    const results = parseDuckDuckGoLiteResults(html);
    if (results.length) return cacheSearch(query, { results });
  } catch (err) {
    errors.push(`lightweight search: ${err?.message || String(err)}`);
  }

  try {
    const markdown = await fetchText(readerLiteUrl, SEARCH_TIMEOUT_MS);
    const results = parseReaderSearchResults(markdown);
    if (results.length) return cacheSearch(query, { results });
  } catch (err) {
    errors.push(`reader search: ${err?.message || String(err)}`);
  }

  return cacheSearch(query, {
    results: [],
    fallback_error: errors.length ? errors.join("; ") : ""
  });
}

function cacheSearch(query, value) {
  searchCache.set(query, { createdAt: Date.now(), value });
  return value;
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  let match;

  while ((match = resultPattern.exec(html)) && results.length < RESULTS_PER_CLAIM) {
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[1]));
    if (!isUsableSourceUrl(url)) continue;
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
    if (!isUsableSourceUrl(url)) continue;
    results.push({
      title: cleanText(stripHtml(match[2])),
      url,
      snippet: ""
    });
  }

  return dedupeResults(results);
}

function parseDuckDuckGoLiteResults(html) {
  const results = [];
  const resultPattern = /<a([^>]*class=['"][^'"]*result-link[^'"]*['"][^>]*)>([\s\S]*?)<\/a>[\s\S]*?<td[^>]+class=['"][^'"]*result-snippet[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi;
  let match;

  while ((match = resultPattern.exec(html)) && results.length < RESULTS_PER_CLAIM) {
    const href = match[1].match(/href=['"]([^'"]+)['"]/i);
    const url = normalizeDuckDuckGoUrl(decodeHtml(href?.[1] || ""));
    if (!isUsableSourceUrl(url)) continue;
    results.push({
      title: cleanText(stripHtml(match[2])),
      url,
      snippet: cleanText(stripHtml(match[3]))
    });
  }

  return dedupeResults(results);
}

function parseReaderSearchResults(markdown) {
  const results = [];
  const lines = String(markdown || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\d+\.\[([^\]]+)\]\((https?:\/\/duckduckgo\.com\/l\/\?[^)]+)\)$/i);
    if (!match) continue;
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[2]));
    if (!isUsableSourceUrl(url)) continue;
    results.push({
      title: cleanText(match[1]),
      url,
      snippet: cleanText(lines[index + 1] || "")
    });
    if (results.length >= RESULTS_PER_CLAIM) break;
  }

  return dedupeResults(results);
}

async function fetchPageMetadata(url) {
  try {
    const html = await fetchPublicPageText(url, PAGE_TIMEOUT_MS);
    return {
      title: firstMeta(html, ["og:title", "twitter:title"]) || htmlTitle(html),
      author: firstMeta(html, ["author", "article:author", "byl"]),
      site_name: firstMeta(html, ["og:site_name", "application-name"]) || hostName(url),
      published_date: firstMeta(html, ["article:published_time", "date", "dc.date", "citation_publication_date"]),
      description: firstMeta(html, ["og:description", "twitter:description", "description"]),
      page_excerpt: pageExcerpt(html),
      page_retrieved: true
    };
  } catch (_) {
    return {
      site_name: hostName(url),
      page_retrieved: false
    };
  }
}

async function fetchText(url, timeoutMs, userAgent = USER_AGENT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
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

async function fetchPublicPageText(url, timeoutMs, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) throw new Error("Too many redirects");
  await assertPublicHttpsUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "manual",
      signal: controller.signal
    });
    if (res.status >= 300 && res.status < 400) {
      const destination = new URL(res.headers.get("location") || "", url).href;
      return fetchPublicPageText(destination, timeoutMs, redirectCount + 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return readBoundedText(res, PAGE_MAX_BYTES);
  } finally {
    clearTimeout(timer);
  }
}

async function assertPublicHttpsUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS public pages are allowed");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateAddress(host)) {
    throw new Error("Private-network pages are not allowed");
  }
  const results = await lookup(host, { all: true, verbatim: true });
  if (!results.length || results.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private-network pages are not allowed");
  }
}

async function readBoundedText(response, limit) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) throw new Error("Retrieved page is too large");
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function classifySupport(claim, sources, citationTooVague) {
  const claimText = claim.text;
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
    const sourceText = `${source.title || ""} ${source.snippet || ""} ${source.description || ""} ${source.page_excerpt || ""}`.toLowerCase();
    const contradictionText = `${source.title || ""} ${source.snippet || ""} ${source.description || ""}`.toLowerCase();
    const overlap = source.match_score ?? claimTerms.filter((term) => sourceText.includes(term)).length / claimTerms.length;
    bestOverlap = Math.max(bestOverlap, overlap);
    if (hasNegationConflict(claimText, contradictionText)) hasContradictionCue = true;
  }

  if (claim.quoted_passage) {
    if (sources.some((source) => source.quote_match)) {
      return {
        status: "likely_supported",
        reason: "A retrieved public page contains this quoted passage. Treat this as a tentative source match: open the page and confirm the speaker, context, and citation details before using it."
      };
    }
    if (!sources.some((source) => source.page_retrieved)) {
      return {
        status: "needs_source_review",
        reason: "Search found possible public pages, but their page text could not be retrieved. Open the source and locate the quotation manually before using it."
      };
    }
    return {
      status: "quote_not_supported",
      reason: "The retrieved public pages did not contain this quoted passage. It is not supported by the retrieved pages; locate the original text or remove the quotation."
    };
  }

  if (hasContradictionCue && bestOverlap >= 0.5) {
    return {
      status: "possible_conflict",
      reason: "The retrieved source metadata appears to discuss the same subject but contains a conflicting negation cue. Inspect the full source before relying on the claim."
    };
  }
  if (citationTooVague) {
    return {
      status: "citation_incomplete",
      reason: "A potentially relevant public page was found, but the draft does not identify the source precisely enough to connect it confidently to this claim."
    };
  }
  if (ensureArray(claim.citation_issues).includes("source_needed") && bestOverlap >= 0.72) {
    return {
      status: "needs_source_review",
      reason: "Search found a closely related public page, but the draft does not identify a source. Open the page and confirm the exact passage before adding it to the bibliography."
    };
  }
  if (bestOverlap >= 0.72) {
    return {
      status: "likely_supported",
      reason: "Public retrieval closely matches the claim's distinctive terms. Treat this as a tentative source match: open the source and confirm the exact passage before final submission."
    };
  }
  if (bestOverlap >= 0.42) {
    return {
      status: "partial_match",
      reason: "Retrieved sources match part of the claim, but the metadata does not verify every important detail. Narrow the claim or cite the exact passage."
    };
  }
  if (sources.length) {
    return {
      status: "needs_source_review",
      reason: "Search returned public pages, but their metadata does not clearly support the claim. Inspect the pages and replace the citation if the match is weak."
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

function buildMlaEntry(source) {
  const author = source.author ? `${source.author}. ` : "";
  const title = source.title ? `"${trimTrailingPunctuation(source.title)}." ` : "";
  const site = source.site_name ? `${trimTrailingPunctuation(source.site_name)}, ` : "";
  const date = source.published_date ? `${formatDateForMla(source.published_date)}, ` : "";
  const url = source.url || "";
  const accessed = `Accessed ${formatDateForMla(source.accessed_date || todayIso())}.`;
  return cleanText(`${author}${title}${site}${date}${url}. ${accessed}`);
}

function buildApaEntry(source) {
  const author = source.author ? `${trimTrailingPunctuation(source.author)}. ` : "";
  const date = source.published_date ? `(${formatDateForApa(source.published_date)}). ` : "(n.d.). ";
  const title = source.title ? `${sentenceCase(trimTrailingPunctuation(source.title))}. ` : "";
  const site = source.site_name ? `${trimTrailingPunctuation(source.site_name)}. ` : "";
  return cleanText(`${author}${date}${title}${site}${source.url || ""}`);
}

function buildCitationEntry(source, style) {
  return style === "apa" ? buildApaEntry(source) : buildMlaEntry(source);
}

function buildSummary(claims, worksCited, citationStyle) {
  const counts = {
    total_claims: claims.length,
    likely_supported: 0,
    partial_match: 0,
    needs_source_review: 0,
    possible_conflict: 0,
    source_not_found: 0,
    quote_not_supported: 0,
    citation_incomplete: 0,
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
    all_sources_likely_supported: claims.length > 0 && claims.every((claim) => claim.support_status === "likely_supported"),
    citation_style: citationStyle,
    style_edition: citationStyle === "apa" ? "APA 7th edition" : "MLA 9th edition",
    note: claims.length > 0 && claims.every((claim) => claim.support_status === "likely_supported")
      ? "Every checked citation has a tentative public-web match. Open each retrieved page and confirm the exact passage before final submission."
      : "Automated verification searched public pages and retrieved page text for comparison. Treat matches as tentative, and review each not-supported or incomplete citation before final submission."
  };
}

function buildSearchQuery(text, quotedPassage = "") {
  const quoted = quotedPassage || extractQuotedSource(text);
  if (quoted) return `"${quoted.slice(0, 240)}"`;
  const terms = importantTerms(text).slice(0, 10);
  return Array.from(new Set(terms.filter(Boolean))).join(" ") || text.slice(0, 160);
}

function extractQuotedSource(text) {
  const quoted = text.match(/["“]([^"”]{8,240})["”]/);
  if (quoted) return quoted[1];
  const according = text.match(/\baccording to\s+([^,.]{4,100})/i);
  if (according) return according[1];
  return "";
}

export function extractQuotedPassages(text = "") {
  const passages = [];
  const pattern = /"([^"\r\n]{12,500})"|“([^”\r\n]{12,500})”/g;
  let match;

  while ((match = pattern.exec(String(text || "")))) {
    const passage = cleanText(match[1] || match[2] || "");
    if (passage) passages.push(passage);
  }

  return Array.from(new Set(passages));
}

function importantTerms(text) {
  return Array.from(new Set(String(text || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]{2,}/g) || []))
    .filter((term) => !STOP_WORDS.has(term) && !/^\d{1,2}$/.test(term))
    .slice(0, 16);
}

function sourceMatchScore(claimText, source) {
  const claimTerms = importantTerms(claimText);
  if (!claimTerms.length) return 0;
  const sourceText = `${source.title || ""} ${source.snippet || ""} ${source.description || ""} ${source.page_excerpt || ""}`.toLowerCase();
  const overlap = claimTerms.filter((term) => sourceText.includes(term)).length / claimTerms.length;
  return Number(overlap.toFixed(2));
}

function quotedPassageMatch(quotedPassage, source) {
  const quoted = normalizeComparableText(quotedPassage);
  if (!quoted) return false;
  const retrievedText = normalizeComparableText(source.page_excerpt || "");
  return retrievedText.includes(quoted);
}

function looksFactual(sentence) {
  const text = String(sentence || "").trim();
  if (text.length < 18) return false;
  if (FACTUAL_SIGNALS.some((pattern) => pattern.test(text))) return true;
  return /\b(is|are|was|were|has|have|had)\b/i.test(text) && /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(text);
}

function looksCitationRelevant(text) {
  const cleaned = String(text || "").trim();
  return cleaned.length >= 18 && FACTUAL_SIGNALS.slice(0, 6).some((pattern) => pattern.test(cleaned));
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

function isUsableSourceUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /^https:\/\//i.test(url)
      && host !== "duckduckgo.com"
      && !host.endsWith(".duckduckgo.com")
      && host !== "r.jina.ai"
      && host !== "localhost"
      && !host.endsWith(".localhost")
      && !isPrivateAddress(host);
  } catch (_) {
    return false;
  }
}

function isPrivateAddress(value) {
  const address = String(value || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!isIP(address)) return false;
  if (address === "::1" || address === "::" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb")) return true;
  if (address.startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] >= 224;
}

function bibliographyReady(claim, source) {
  if (!source || !source.url || source.page_retrieved !== true) return false;
  if (source.quote_match === true) return true;
  return !ensureArray(claim.citation_issues).includes("source_needed") && source.match_score >= 0.72;
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
    description: cleanText(source.description || ""),
    page_excerpt: cleanText(source.page_excerpt || ""),
    page_retrieved: source.page_retrieved === true
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
    likely_supported: 0.7,
    partial_match: 0.52,
    needs_source_review: 0.36,
    possible_conflict: 0.44,
    source_not_found: 0.35,
    quote_not_supported: 0.28,
    citation_incomplete: 0.32,
    source_too_vague: 0.3,
    needs_review: 0.2
  }[status] || 0.25;
  return Number(Math.min(0.85, base + Math.min(sources.length, 3) * 0.03).toFixed(2));
}

function normalizeComparableText(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
    .replace(/&#x27;/gi, "'")
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

function formatDateForApa(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").trim();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${date.getUTCFullYear()}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function pageExcerpt(html) {
  return cleanText(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .slice(0, 6000);
}

function sentenceCase(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function normalizeCitationStyle(value) {
  return String(value || "").toLowerCase() === "apa" ? "apa" : "mla";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
