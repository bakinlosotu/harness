import { Chunk } from './storage';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves'
]);

export function tokenize(text: string): string[] {
  // Lowercase, split on non-letters/digits with Unicode support
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!matches) return [];

  return matches.filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export function rankBM25(
  chunks: Chunk[],
  query: string,
  selectedDocIds: string[],
  topK = 8
): Chunk[] {
  if (chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  const docTokensList = chunks.map((c) => tokenize(c.text));

  const N = chunks.length;
  const k1 = 1.5;
  const b = 0.75;

  let totalDocLen = 0;
  for (const tokens of docTokensList) {
    totalDocLen += tokens.length;
  }
  const avgdl = totalDocLen > 0 ? totalDocLen / N : 1;

  // Document frequencies for query terms
  const df: Record<string, number> = {};
  for (const qt of queryTokens) {
    let count = 0;
    for (const dTokens of docTokensList) {
      if (dTokens.includes(qt)) {
        count++;
      }
    }
    df[qt] = count;
  }

  // Calculate scores
  const scored: { chunk: Chunk; score: number }[] = [];
  let anyNonZero = false;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokens = docTokensList[i];
    const docLen = tokens.length;

    // Term frequencies
    const tf: Record<string, number> = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }

    let score = 0;
    for (const qt of queryTokens) {
      const termFreq = tf[qt] || 0;
      if (termFreq === 0) continue;

      const docFreq = df[qt] || 0;
      // Standard BM25 IDF
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + (b * docLen) / avgdl);
      score += idf * (numerator / denominator);
    }

    if (score > 0) anyNonZero = true;
    scored.push({ chunk, score });
  }

  if (anyNonZero) {
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  }

  // If every score is 0, take the first 4 chunks of each selected doc (max 8 total)
  const fallbackChunks: Chunk[] = [];
  for (const docId of selectedDocIds) {
    const docChunks = chunks.filter((c) => c.docId === docId);
    const take = docChunks.slice(0, 4);
    for (const ch of take) {
      if (fallbackChunks.length < topK) {
        fallbackChunks.push(ch);
      }
    }
  }

  return fallbackChunks;
}
