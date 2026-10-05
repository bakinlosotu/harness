import { Chunk } from './storage';

export function chunkPageText(
  docId: string,
  page: number,
  rawText: string,
  startIdx = 0
): Chunk[] {
  // Normalize whitespace
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const CHUNK_SIZE = 1200;
  const CHUNK_OVERLAP = 200;

  if (normalized.length <= CHUNK_SIZE) {
    return [
      {
        docId,
        idx: startIdx,
        page,
        text: normalized,
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let currentIdx = startIdx;

  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    if (end >= normalized.length) {
      const slice = normalized.slice(start).trim();
      if (slice) {
        chunks.push({
          docId,
          idx: currentIdx++,
          page,
          text: slice,
        });
      }
      break;
    }

    // Try to break at a sentence (.!?) or whitespace near end
    let breakPoint = -1;
    // Look for sentence end in the last 150 characters
    const searchRange = normalized.slice(Math.max(start, end - 150), end);
    const sentenceMatch = searchRange.search(/[.!?]\s+[A-Z0-9]/);
    if (sentenceMatch !== -1) {
      breakPoint = Math.max(start, end - 150) + sentenceMatch + 1;
    } else {
      // Fallback: look for space
      const lastSpace = normalized.lastIndexOf(' ', end);
      if (lastSpace > start + 300) {
        breakPoint = lastSpace;
      }
    }

    if (breakPoint === -1) {
      breakPoint = end;
    }

    const slice = normalized.slice(start, breakPoint).trim();
    if (slice) {
      chunks.push({
        docId,
        idx: currentIdx++,
        page,
        text: slice,
      });
    }

    start = Math.max(start + 1, breakPoint - CHUNK_OVERLAP);
  }

  return chunks;
}
