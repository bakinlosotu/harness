import { smartFetch } from './smartFetch';
import { Citation } from './storage';

export interface WebSearchResult {
  sources: { title: string; url: string; content: string }[];
  notice?: string;
  sourceType: 'tavily' | 'wikipedia' | 'none';
  error?: string;
}

export async function searchWikipedia(rawQuery: string): Promise<WebSearchResult> {
  const query = rawQuery.trim().slice(0, 200);
  if (!query) {
    return { sources: [], notice: 'Web search query is empty.', sourceType: 'none' };
  }

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=4&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=max&format=json&origin=*`;

    let res: Response;
    try {
      res = await fetch(searchUrl, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      res = await smartFetch(searchUrl, undefined, 'Wikipedia');
    }

    if (!res.ok) {
      return { sources: [], notice: 'Wikipedia search request failed.', sourceType: 'none' };
    }

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== 'object') {
      return { sources: [], notice: 'No Wikipedia results found.', sourceType: 'none' };
    }

    const sources: { title: string; url: string; content: string }[] = [];
    const pageList = Object.values(pages) as any[];

    for (const p of pageList) {
      if (p && p.title && p.extract) {
        const title = p.title;
        const url = p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
        const content = String(p.extract).trim().slice(0, 1500);
        if (content.length > 20) {
          sources.push({ title, url, content });
        }
      }
    }

    if (sources.length === 0) {
      return { sources: [], notice: 'No Wikipedia results found for this query.', sourceType: 'none' };
    }

    return {
      sources,
      notice: 'Searched Wikipedia.',
      sourceType: 'wikipedia',
    };
  } catch (err: any) {
    return { sources: [], notice: err?.message || 'Wikipedia search error.', sourceType: 'none' };
  }
}

export async function searchTavily(rawKey: string, rawQuery: string): Promise<WebSearchResult> {
  const key = rawKey.trim();
  const query = rawQuery.trim().slice(0, 400);

  if (!key) {
    return await searchWikipedia(rawQuery);
  }

  if (!query) {
    return { sources: [], notice: 'Search query is empty.', sourceType: 'none' };
  }

  try {
    const res = await smartFetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          api_key: key,
          query,
          max_results: 5,
          search_depth: 'basic',
          include_answer: false,
        }),
      },
      'Tavily'
    );

    if (res.status === 401 || res.status === 403) {
      const wiki = await searchWikipedia(rawQuery);
      return {
        ...wiki,
        notice: 'Tavily rejected your API key (unauthorized). Check your key in Settings. Used Wikipedia instead.',
        error: 'Tavily key invalid',
      };
    }

    if (res.status === 429 || res.status === 432) {
      const wiki = await searchWikipedia(rawQuery);
      return {
        ...wiki,
        notice: 'Your free Tavily searches for this month are used up. Used Wikipedia instead.',
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      const wiki = await searchWikipedia(rawQuery);
      return {
        ...wiki,
        notice: `Tavily returned an error (${res.status}). Used Wikipedia instead.`,
        error: errText.slice(0, 100),
      };
    }

    const data = await res.json();
    const results = data?.results;

    if (Array.isArray(results) && results.length > 0) {
      const sources = results.map((r: any) => ({
        title: r.title || r.url || 'Web result',
        url: r.url || '',
        content: String(r.content || '').slice(0, 1500),
      }));
      return {
        sources,
        notice: `Found ${sources.length} sources via Tavily search.`,
        sourceType: 'tavily',
      };
    }

    // If Tavily returned 0 results, fallback to Wikipedia
    const wiki = await searchWikipedia(rawQuery);
    return {
      ...wiki,
      notice: wiki.sources.length > 0 ? 'Tavily found 0 results. Used Wikipedia.' : 'Web search found nothing for this query.',
    };
  } catch (err: any) {
    const wiki = await searchWikipedia(rawQuery);
    return {
      ...wiki,
      notice: `Tavily search network issue: ${err?.message || 'could not reach Tavily'}. Used Wikipedia instead.`,
      error: err?.message,
    };
  }
}

export function buildWebResultsText(
  sources: { title: string; url: string; content: string }[],
  startNum = 1
): {
  text: string;
  citations: Citation[];
} {
  if (sources.length === 0) return { text: '', citations: [] };

  const lines: string[] = ['Web search results:'];
  const citations: Citation[] = [];

  for (let i = 0; i < sources.length; i++) {
    const num = startNum + i;
    const s = sources[i];
    lines.push(`[${num}] ${s.title}\nURL: ${s.url}\n${s.content}`);
    citations.push({
      n: num,
      kind: 'web',
      title: s.title,
      url: s.url,
      excerpt: s.content,
    });
  }

  return {
    text: lines.join('\n\n'),
    citations,
  };
}
