import type { CitationSource } from '../src/lib/citationEngine';

type OpenAlexWork = {
  title?: string;
  publication_year?: number;
  doi?: string;
  id?: string;
  primary_location?: {
    landing_page_url?: string;
    source?: {
      display_name?: string;
    };
  };
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
};

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
}

function compact(value: string | undefined | null): string | undefined {
  const clean = value?.replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function htmlMeta(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) {
      return compact(match.replace(/&amp;/g, '&'));
    }
  }
  return undefined;
}

async function metadataFromUrl(url: string, index: number): Promise<CitationSource | null> {
  const timer = withTimeout(5500);
  try {
    const response = await fetch(url, {
      signal: timer.signal,
      headers: {
        'User-Agent': 'FractureStudioCitationBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const html = (await response.text()).slice(0, 90_000);
    const title = compact(htmlMeta(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]);
    const author = compact(htmlMeta(html, 'author') || htmlMeta(html, 'article:author'));
    const year = compact(htmlMeta(html, 'article:published_time') || htmlMeta(html, 'date') || htmlMeta(html, 'dc.date'))?.match(/\b(19|20)\d{2}\b/)?.[0];
    const site = compact(htmlMeta(html, 'og:site_name')) || new URL(url).hostname.replace(/^www\./, '');
    const source: CitationSource = {
      id: `web-${index}`,
      raw: url,
      title: title || site,
      authors: author ? [author] : undefined,
      year,
      publisher: site,
      url,
      accessed: todayIso(),
      credibility: response.ok ? `Fetched metadata from ${site}. Verify the page supports the claim before citing.` : `HTTP ${response.status} while reading metadata. Verify manually.`,
    };
    return source;
  } catch {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return {
        id: `web-${index}`,
        raw: url,
        title: host,
        publisher: host,
        url,
        accessed: todayIso(),
        credibility: 'Could not fetch page metadata within the timeout. Verify manually before final use.',
      };
    } catch {
      return null;
    }
  } finally {
    timer.cancel();
  }
}

function openAlexToSource(work: OpenAlexWork, index: number): CitationSource {
  const authors =
    work.authorships
      ?.map((authorship) => compact(authorship.author?.display_name))
      .filter((author): author is string => Boolean(author))
      .slice(0, 8) || [];
  const doi = compact(work.doi)?.replace(/^https?:\/\/doi\.org\//i, '');
  return {
    id: `web-${index}`,
    raw: work.id || work.title || `OpenAlex result ${index}`,
    title: compact(work.title),
    authors: authors.length > 0 ? authors : undefined,
    year: work.publication_year ? String(work.publication_year) : undefined,
    publisher: compact(work.primary_location?.source?.display_name),
    url: compact(work.primary_location?.landing_page_url) || compact(work.doi) || compact(work.id),
    doi,
    accessed: todayIso(),
    credibility: 'Found through OpenAlex. Check author, venue, and claim relevance before final submission.',
  };
}

async function openAlexSearch(query: string, startIndex: number): Promise<CitationSource[]> {
  const timer = withTimeout(6500);
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=4`;
    const response = await fetch(url, { signal: timer.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { results?: OpenAlexWork[] };
    return (data.results || []).slice(0, 4).map((work, index) => openAlexToSource(work, startIndex + index));
  } catch {
    return [];
  } finally {
    timer.cancel();
  }
}

export async function searchCitationSources(input: string): Promise<CitationSource[]> {
  const queries = input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  const results: CitationSource[] = [];
  for (const query of queries) {
    if (isUrl(query)) {
      const source = await metadataFromUrl(query, results.length + 1);
      if (source) {
        results.push(source);
      }
      continue;
    }

    const found = await openAlexSearch(query, results.length + 1);
    results.push(...found);
  }

  const seen = new Set<string>();
  return results.filter((source) => {
    const key = (source.doi || source.url || source.title || source.raw).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
