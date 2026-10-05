import { ProviderId } from '../lib/storage';

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  images?: { mime: string; base64: string }[];
}

export interface ChatArgs {
  model: string;
  system: string;
  messages: ChatMsg[];
  temperature: number | null;
  key: string;
  signal: AbortSignal;
  geminiSearch?: boolean;
  onText: (delta: string) => void;
  onCitations?: (c: { title: string; url: string }[]) => void;
  onNotice?: (notice: string) => void;
}

export interface Provider {
  id: ProviderId;
  name: string;
  listModels(key: string): Promise<{ id: string; label: string }[]>;
  chat(args: ChatArgs): Promise<void>;
}

export function normalizeMessages(messages: ChatMsg[]): ChatMsg[] {
  if (messages.length === 0) return [];

  // Drop empty assistant messages
  const filtered = messages.filter((m) => {
    if (m.role === 'assistant' && !m.text.trim()) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) return [];

  // Merge consecutive messages with the same role
  const merged: ChatMsg[] = [];
  for (const m of filtered) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === m.role) {
      prev.text = prev.text ? `${prev.text}\n\n${m.text}` : m.text;
      if (m.images && m.images.length > 0) {
        prev.images = [...(prev.images || []), ...m.images];
      }
    } else {
      merged.push({
        role: m.role,
        text: m.text,
        images: m.images ? [...m.images] : undefined,
      });
    }
  }

  // Make sure first message is from user
  while (merged.length > 0 && merged[0].role !== 'user') {
    merged.shift();
  }

  return merged;
}
