import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth/mammoth.browser';
import { chunkPageText } from './chunk';
import { generateId } from './ids';
import { Chunk, Doc } from './storage';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv', 'json'];

export async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isSupportedDocFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export interface ParseResult {
  doc: Doc;
  chunks: Chunk[];
}

export async function parseDocumentFile(
  file: File,
  onProgress?: (progress: string) => void
): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error('Only PDF, Word (.docx) and text files are supported.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Files must be under 20 MB.');
  }

  onProgress?.('Reading file…');
  const buffer = await file.arrayBuffer();
  const hash = await computeSHA256(buffer);
  const docId = generateId('doc');

  let pagesCount = 1;
  const pageTexts: { page: number; text: string }[] = [];

  if (ext === 'pdf') {
    let pdf: any;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      pdf = await loadingTask.promise;
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('password') || err?.name === 'PasswordException') {
        throw new Error('This PDF is password protected.');
      }
      throw new Error("Couldn't read this PDF.");
    }

    pagesCount = pdf.numPages || 1;
    for (let p = 1; p <= pagesCount; p++) {
      onProgress?.(`Reading page ${p} of ${pagesCount}…`);
      try {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const pageStr = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        pageTexts.push({ page: p, text: pageStr });
      } catch {
        // Fallback empty page
        pageTexts.push({ page: p, text: '' });
      }
    }
  } else if (ext === 'docx') {
    onProgress?.('Extracting document text…');
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      pageTexts.push({ page: 1, text: result.value || '' });
    } catch {
      throw new Error("Couldn't read this Word document.");
    }
  } else {
    // Text formats: txt, md, csv, json
    onProgress?.('Reading text…');
    const textDecoder = new TextDecoder('utf-8');
    const text = textDecoder.decode(buffer);
    pageTexts.push({ page: 1, text });
  }

  let totalChars = 0;
  let nonWhitespaceCount = 0;
  for (const pt of pageTexts) {
    totalChars += pt.text.length;
    const clean = pt.text.replace(/\s/g, '');
    nonWhitespaceCount += clean.length;
  }

  if (nonWhitespaceCount < 20) {
    throw new Error(`${file.name} has no readable text. It may be a scanned image.`);
  }

  // Chunk each page
  onProgress?.('Indexing contents…');
  const allChunks: Chunk[] = [];
  let chunkIdx = 0;
  for (const pt of pageTexts) {
    const pageChunks = chunkPageText(docId, pt.page, pt.text, chunkIdx);
    allChunks.push(...pageChunks);
    chunkIdx += pageChunks.length;
  }

  const doc: Doc = {
    id: docId,
    name: file.name,
    size: file.size,
    hash,
    pages: pagesCount,
    chars: totalChars,
    createdAt: Date.now(),
  };

  return { doc, chunks: allChunks };
}
