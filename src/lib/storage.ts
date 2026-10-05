import { get, set, del, keys as idbKeys } from 'idb-keyval';

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'xai';

export interface Keys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  xai?: string;
  tavily?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
}

export interface Citation {
  n: number;
  kind: 'doc' | 'web';
  title: string;
  url?: string;
  page?: number;
  excerpt: string;
}

export interface MessageImage {
  mime: string;
  base64: string;
}

export interface ModelRef {
  provider: ProviderId;
  id: string;
  label: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: MessageImage[];
  model?: ModelRef;
  citations?: Citation[];
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  error?: string;
  createdAt: number;
}

export interface ConversationSettings {
  systemPrompt: string;
  temperature: number | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  docIds: string[];
  webSearch: boolean;
  settings: ConversationSettings;
  model: ModelRef | null;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface Doc {
  id: string;
  name: string;
  size: number;
  hash: string;
  pages: number;
  chars: number;
  createdAt: number;
}

export interface Chunk {
  docId: string;
  idx: number;
  page: number;
  text: string;
}

let onQuotaExceededCallback: (() => void) | null = null;
export function setQuotaExceededHandler(handler: () => void) {
  onQuotaExceededCallback = handler;
}

function handleStorageError(err: unknown) {
  if (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.code === 22)
  ) {
    if (onQuotaExceededCallback) {
      onQuotaExceededCallback();
    }
  }
}

// ================= Key Storage =================

export function cleanKey(val?: string): string {
  if (!val) return '';
  let str = val.trim();
  // Strip outer quotes if any
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

export function cleanAppPassword(val?: string): string {
  if (!val) return '';
  return val.replace(/\s+/g, '').trim();
}

export function isRememberKeys(): boolean {
  try {
    return localStorage.getItem('harness.rememberKeys') === 'true';
  } catch {
    return false;
  }
}

export function setRememberKeys(remember: boolean): void {
  try {
    localStorage.setItem('harness.rememberKeys', remember ? 'true' : 'false');
    const current = loadKeys();
    if (remember) {
      localStorage.setItem('harness.keys', JSON.stringify(current));
      sessionStorage.removeItem('harness.keys');
    } else {
      sessionStorage.setItem('harness.keys', JSON.stringify(current));
      localStorage.removeItem('harness.keys');
    }
  } catch (e) {
    handleStorageError(e);
  }
}

export function loadKeys(): Keys {
  try {
    const rawLocal = localStorage.getItem('harness.keys');
    if (rawLocal) {
      return JSON.parse(rawLocal);
    }
    const rawSession = sessionStorage.getItem('harness.keys');
    if (rawSession) {
      return JSON.parse(rawSession);
    }
  } catch {
    // Ignore JSON parse errors
  }
  return {};
}

export function saveKeys(keys: Keys): void {
  const cleaned: Keys = {
    openai: cleanKey(keys.openai),
    anthropic: cleanKey(keys.anthropic),
    gemini: cleanKey(keys.gemini),
    xai: cleanKey(keys.xai),
    tavily: cleanKey(keys.tavily),
    gmailUser: cleanKey(keys.gmailUser),
    gmailAppPassword: cleanAppPassword(keys.gmailAppPassword),
  };

  const str = JSON.stringify(cleaned);
  try {
    if (isRememberKeys()) {
      localStorage.setItem('harness.keys', str);
      sessionStorage.removeItem('harness.keys');
    } else {
      sessionStorage.setItem('harness.keys', str);
      localStorage.removeItem('harness.keys');
    }
  } catch (e) {
    handleStorageError(e);
  }
}

export function forgetAllKeys(): void {
  try {
    localStorage.removeItem('harness.keys');
    sessionStorage.removeItem('harness.keys');
    const providers: ProviderId[] = ['openai', 'anthropic', 'gemini', 'xai'];
    for (const p of providers) {
      sessionStorage.removeItem(`harness.models.${p}`);
    }
  } catch {
    // Ignore
  }
}

// ================= Model Storage =================

export function getCachedModels(provider: ProviderId): { id: string; label: string }[] | null {
  try {
    const raw = sessionStorage.getItem(`harness.models.${provider}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return null;
}

export function setCachedModels(provider: ProviderId, models: { id: string; label: string }[]): void {
  try {
    sessionStorage.setItem(`harness.models.${provider}`, JSON.stringify(models));
  } catch (e) {
    handleStorageError(e);
  }
}

export function getLastModel(): ModelRef | null {
  try {
    const raw = localStorage.getItem('harness.lastModel');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return null;
}

export function setLastModel(model: ModelRef | null): void {
  try {
    if (model) {
      localStorage.setItem('harness.lastModel', JSON.stringify(model));
    } else {
      localStorage.removeItem('harness.lastModel');
    }
  } catch (e) {
    handleStorageError(e);
  }
}

// ================= Theme =================

export type Theme = 'system' | 'light' | 'dark';

export function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem('harness.theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem('harness.theme', theme);
  } catch {
    // Ignore
  }
}

// ================= IndexedDB: Conversations =================

export async function getConversationIndex(): Promise<ConversationMeta[]> {
  try {
    const list = await get<ConversationMeta[]>('conv-index');
    return list || [];
  } catch {
    return [];
  }
}

export async function saveConversationIndex(index: ConversationMeta[]): Promise<void> {
  try {
    await set('conv-index', index);
  } catch (e) {
    handleStorageError(e);
  }
}

export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    const conv = await get<Conversation>(`conv:${id}`);
    return conv || null;
  } catch {
    return null;
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  try {
    await set(`conv:${conv.id}`, conv);
    const index = await getConversationIndex();
    const existingIdx = index.findIndex((i) => i.id === conv.id);
    const meta: ConversationMeta = {
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
    };
    if (existingIdx >= 0) {
      index[existingIdx] = meta;
    } else {
      index.unshift(meta);
    }
    index.sort((a, b) => b.updatedAt - a.updatedAt);
    await saveConversationIndex(index);
  } catch (e) {
    handleStorageError(e);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await del(`conv:${id}`);
    const index = await getConversationIndex();
    const updated = index.filter((i) => i.id !== id);
    await saveConversationIndex(updated);
  } catch (e) {
    handleStorageError(e);
  }
}

// ================= IndexedDB: Documents =================

export async function getDocIndex(): Promise<Doc[]> {
  try {
    const list = await get<Doc[]>('doc-index');
    return list || [];
  } catch {
    return [];
  }
}

export async function saveDocIndex(index: Doc[]): Promise<void> {
  try {
    await set('doc-index', index);
  } catch (e) {
    handleStorageError(e);
  }
}

export async function getDoc(id: string): Promise<Doc | null> {
  try {
    const d = await get<Doc>(`doc:${id}`);
    return d || null;
  } catch {
    return null;
  }
}

export async function getDocChunks(id: string): Promise<Chunk[]> {
  try {
    const chunks = await get<Chunk[]>(`chunks:${id}`);
    return chunks || [];
  } catch {
    return [];
  }
}

export async function saveDocWithChunks(doc: Doc, chunks: Chunk[]): Promise<void> {
  try {
    await set(`doc:${doc.id}`, doc);
    await set(`chunks:${doc.id}`, chunks);
    const index = await getDocIndex();
    const existingIdx = index.findIndex((d) => d.id === doc.id);
    if (existingIdx >= 0) {
      index[existingIdx] = doc;
    } else {
      index.unshift(doc);
    }
    await saveDocIndex(index);
  } catch (e) {
    handleStorageError(e);
  }
}

export async function deleteDoc(id: string): Promise<void> {
  try {
    await del(`doc:${id}`);
    await del(`chunks:${id}`);
    const index = await getDocIndex();
    const updated = index.filter((d) => d.id !== id);
    await saveDocIndex(updated);

    // Also remove from all conversations' docIds
    const convIndex = await getConversationIndex();
    for (const cMeta of convIndex) {
      const conv = await getConversation(cMeta.id);
      if (conv && conv.docIds.includes(id)) {
        conv.docIds = conv.docIds.filter((dId) => dId !== id);
        await set(`conv:${conv.id}`, conv);
      }
    }
  } catch (e) {
    handleStorageError(e);
  }
}

// ================= Full Export / Import / Reset =================

export async function exportAllData(): Promise<string> {
  const convIndex = await getConversationIndex();
  const convs: Conversation[] = [];
  for (const meta of convIndex) {
    const c = await getConversation(meta.id);
    if (c) convs.push(c);
  }

  const docs = await getDocIndex();
  const docChunksMap: Record<string, Chunk[]> = {};
  for (const d of docs) {
    docChunksMap[d.id] = await getDocChunks(d.id);
  }

  const payload = {
    version: 1,
    exportedAt: Date.now(),
    conversations: convs,
    documents: docs,
    chunks: docChunksMap,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importData(jsonString: string): Promise<{ importedConvs: number; importedDocs: number; skipped: number }> {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format.');
  }

  let importedConvs = 0;
  let importedDocs = 0;
  let skipped = 0;

  if (Array.isArray(data.conversations)) {
    for (const c of data.conversations) {
      if (c && typeof c.id === 'string' && Array.isArray(c.messages)) {
        await saveConversation(c);
        importedConvs++;
      } else {
        skipped++;
      }
    }
  }

  if (Array.isArray(data.documents)) {
    for (const d of data.documents) {
      if (d && typeof d.id === 'string' && typeof d.name === 'string') {
        const chunks = (data.chunks && Array.isArray(data.chunks[d.id])) ? data.chunks[d.id] : [];
        await saveDocWithChunks(d, chunks);
        importedDocs++;
      } else {
        skipped++;
      }
    }
  }

  return { importedConvs, importedDocs, skipped };
}

export async function deleteAllData(): Promise<void> {
  try {
    const allKeys = await idbKeys();
    for (const k of allKeys) {
      await del(k);
    }
    localStorage.removeItem('harness.lastModel');
  } catch (e) {
    handleStorageError(e);
  }
}
