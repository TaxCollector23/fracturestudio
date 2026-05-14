export type CitationStyle = 'APA' | 'MLA' | 'Chicago notes';

export type CitationSource = {
  id: string;
  raw: string;
  title?: string;
  authors?: string[];
  year?: string;
  publisher?: string;
  container?: string;
  url?: string;
  doi?: string;
  accessed?: string;
  credibility?: string;
  missingFields?: string[];
};

export type CitationReport = {
  style: CitationStyle;
  sources: CitationSource[];
  formatted: string[];
  inTextExamples: string[];
  citationNeeds: string[];
  sourceClaimLinks: string[];
  hallucinationChecks: string[];
  freshnessWarnings: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStyle(style: string | undefined): CitationStyle {
  const raw = (style || 'APA').toLowerCase();
  if (raw.includes('mla')) {
    return 'MLA';
  }
  if (raw.includes('chicago')) {
    return 'Chicago notes';
  }
  return 'APA';
}

function splitAuthors(raw: string): string[] {
  return raw
    .split(/\s*(?:;|\band\b|&)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function cleanTitle(value: string): string {
  return value
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function missingFields(source: CitationSource): string[] {
  const missing: string[] = [];
  if (!source.authors?.length) {
    missing.push('author');
  }
  if (!source.title) {
    missing.push('title');
  }
  if (!source.year) {
    missing.push('year');
  }
  if (!source.publisher && !source.container) {
    missing.push('publisher/container');
  }
  if (!source.url && !source.doi) {
    missing.push('url/doi');
  }
  return missing;
}

function parseLine(line: string, index: number): CitationSource {
  const url = line.match(/https?:\/\/[^\s)]+/i)?.[0];
  const doi = line.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0];
  const year = line.match(/\b(19|20)\d{2}\b/)?.[0];
  const parts = line
    .replace(url ?? '', '')
    .replace(doi ?? '', '')
    .split(/\s+\|\s+|\t+/)
    .map((part) => part.trim())
    .filter(Boolean);

  let authors: string[] | undefined;
  let title: string | undefined;
  let publisher: string | undefined;

  if (parts.length >= 3) {
    authors = splitAuthors(parts[0]);
    title = cleanTitle(parts[1]);
    publisher = parts.slice(2).join(', ').replace(year ?? '', '').trim() || undefined;
  } else {
    const sentencePieces = line.split('.').map((piece) => piece.trim()).filter(Boolean);
    if (sentencePieces.length >= 2) {
      authors = splitAuthors(sentencePieces[0].replace(/\((19|20)\d{2}\)/, '').trim());
      title = cleanTitle(sentencePieces[1]);
      publisher = sentencePieces.slice(2).join('. ').replace(url ?? '', '').trim() || undefined;
    } else if (url) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        title = host;
        publisher = host;
      } catch {
        title = line;
      }
    } else {
      title = cleanTitle(line);
    }
  }

  const source: CitationSource = {
    id: `source-${index + 1}`,
    raw: line,
    authors,
    title,
    year,
    publisher,
    url,
    doi,
    accessed: todayIso(),
    credibility: url ? 'Needs source review: URL metadata should be checked against the claim it supports.' : 'Needs source review: parsed from pasted text.',
  };

  return { ...source, missingFields: missingFields(source) };
}

export function parseSourcesText(text: string, webSources: CitationSource[] = []): CitationSource[] {
  const localSources = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine);

  const seen = new Set<string>();
  return [...webSources, ...localSources]
    .filter((source) => {
      const key = (source.doi || source.url || source.title || source.raw).toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((source, index) => ({ ...source, id: `source-${index + 1}`, missingFields: missingFields(source) }));
}

function authorLead(source: CitationSource, style: CitationStyle): string {
  const authors = source.authors ?? [];
  if (authors.length === 0) {
    return '[MISSING: author]';
  }
  if (style === 'MLA') {
    return authors.length > 1 ? `${authors[0]}, et al.` : authors[0];
  }
  if (authors.length > 2) {
    return `${authors[0]} et al.`;
  }
  return authors.join(' & ');
}

function titleFor(source: CitationSource): string {
  return source.title || '[MISSING: title]';
}

function locator(source: CitationSource): string {
  if (source.doi) {
    return `https://doi.org/${source.doi.replace(/^https?:\/\/doi\.org\//i, '')}`;
  }
  if (source.url) {
    return source.url;
  }
  return '[MISSING: url/doi]';
}

export function formatCitation(source: CitationSource, styleInput: string): string {
  const style = normalizeStyle(styleInput);
  const author = authorLead(source, style);
  const title = titleFor(source);
  const year = source.year || '[MISSING: year]';
  const publisher = source.publisher || source.container || '[MISSING: publisher/container]';
  const link = locator(source);

  if (style === 'MLA') {
    return `${author}. "${title}." ${publisher}, ${year}, ${link}. Accessed ${source.accessed || todayIso()}.`;
  }

  if (style === 'Chicago notes') {
    return `${author}. "${title}." ${publisher}. ${year}. ${link}.`;
  }

  return `${author}. (${year}). ${title}. ${publisher}. ${link}`;
}

function inText(source: CitationSource, style: CitationStyle): string {
  const author = source.authors?.[0]?.split(',')[0]?.trim() || source.authors?.[0]?.split(/\s+/).slice(-1)[0] || 'MISSING author';
  const year = source.year || 'MISSING year';
  if (style === 'MLA') {
    return `(${author})`;
  }
  if (style === 'Chicago notes') {
    return `${author}, "${titleFor(source)}."`;
  }
  return `(${author}, ${year})`;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFactualClaim(sentence: string): boolean {
  return (
    /\d/.test(sentence) ||
    /\b(is|are|was|were|causes|caused|increases|decreases|improves|harms|leads to|results in)\b/i.test(sentence)
  );
}

export function findCitationNeeds(draftOrClaims: string): string[] {
  return splitSentences(draftOrClaims)
    .filter((sentence) => isFactualClaim(sentence) && !/\([^)]*(19|20)\d{2}[^)]*\)|https?:\/\//.test(sentence))
    .slice(0, 8)
    .map((sentence) => `Citation needed: ${sentence}`);
}

function sourceClaimLinks(claimText: string, sources: CitationSource[]): string[] {
  const claims = splitSentences(claimText).filter(isFactualClaim).slice(0, 8);
  if (claims.length === 0) {
    return ['No factual claim text was supplied for source-to-claim linking.'];
  }
  if (sources.length === 0) {
    return claims.map((claim) => `No source available for: ${claim}`);
  }

  return claims.map((claim, index) => {
    const source = sources[index % sources.length];
    return `${source.id} should support: ${claim}`;
  });
}

function hallucinationChecks(sources: CitationSource[]): string[] {
  if (sources.length === 0) {
    return ['No sources supplied or found, so no citation can be verified.'];
  }
  return sources.map((source) => {
    const missing = source.missingFields ?? [];
    if (missing.length > 0) {
      return `${source.id}: do not invent ${missing.join(', ')}. Mark missing data until verified.`;
    }
    return `${source.id}: metadata is complete enough for a formatted citation; still verify the source supports the exact claim.`;
  });
}

function freshnessWarnings(sources: CitationSource[]): string[] {
  const currentYear = new Date().getFullYear();
  return sources
    .filter((source) => {
      const year = Number(source.year);
      return Number.isFinite(year) && currentYear - year >= 6;
    })
    .map((source) => `${source.id}: ${source.year} may be old for current topics such as AI, economics, law, climate, or health policy.`);
}

export function buildCitationReport(input: {
  style?: string;
  sourcesText: string;
  claimText?: string;
  webSources?: CitationSource[];
}): CitationReport {
  const style = normalizeStyle(input.style);
  const sources = parseSourcesText(input.sourcesText, input.webSources);
  const formatted = sources.map((source) => formatCitation(source, style));
  const inTextExamples = sources.slice(0, 6).map((source) => `${source.id}: ${inText(source, style)}`);
  const claimText = input.claimText || input.sourcesText;

  return {
    style,
    sources,
    formatted,
    inTextExamples,
    citationNeeds: findCitationNeeds(claimText),
    sourceClaimLinks: sourceClaimLinks(claimText, sources),
    hallucinationChecks: hallucinationChecks(sources),
    freshnessWarnings: freshnessWarnings(sources),
  };
}

function renderBullets(items: string[], empty: string): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
}

export function renderCitationReport(report: CitationReport): string {
  return `## ${report.style} Bibliography
${renderBullets(report.formatted, 'No citations generated. Add source text, URLs, DOI values, or a research query.')}

## In-Text Citation Examples
${renderBullets(report.inTextExamples, 'No in-text examples yet.')}

## Citation Needed Tags
${renderBullets(report.citationNeeds, 'No uncited factual claims found in the supplied text.')}

## Source-to-Claim Verifier
${renderBullets(report.sourceClaimLinks, 'No source-to-claim links generated.')}

## Citation Hallucination Check
${renderBullets(report.hallucinationChecks, 'No hallucination checks generated.')}

## Evidence Freshness
${renderBullets(report.freshnessWarnings, 'No stale source warnings from available dates.')}`;
}
