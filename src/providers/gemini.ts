import { friendlyError } from '../lib/errors';
import { smartFetch } from '../lib/smartFetch';
import { readSSE } from '../lib/sse';
import { ChatArgs, normalizeMessages, Provider } from './types';

export const geminiProvider: Provider = {
  id: 'gemini',
  name: 'Google Gemini',

  async listModels(key: string): Promise<{ id: string; label: string }[]> {
    const res = await smartFetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      {
        headers: {
          'x-goog-api-key': key,
        },
      },
      'Google Gemini'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(friendlyError('Google Gemini', res.status, errText));
    }

    const data = await res.json();
    const models: { id: string; label: string }[] = [];

    const dropRegex = /(embedding|tts|image|live|audio)/i;

    if (Array.isArray(data.models)) {
      for (const m of data.models) {
        const rawName = m.name || '';
        const id = rawName.replace(/^models\//, '');
        const supported = Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods
          : [];

        if (
          supported.includes('generateContent') &&
          id.toLowerCase().includes('gemini') &&
          !dropRegex.test(id)
        ) {
          models.push({
            id,
            label: m.displayName || id,
          });
        }
      }
    }

    // Sort descending
    models.sort((a, b) => b.id.localeCompare(a.id));
    return models;
  },

  async chat(args: ChatArgs): Promise<void> {
    const normalized = normalizeMessages(args.messages);
    if (normalized.length === 0) return;

    const buildPayload = (includeSearchTool: boolean) => {
      const contentsPayload: any[] = [];

      for (const m of normalized) {
        const parts: any[] = [];
        if (m.images && m.images.length > 0) {
          for (const img of m.images) {
            parts.push({
              inlineData: {
                mimeType: img.mime,
                data: img.base64,
              },
            });
          }
        }
        if (m.text) {
          parts.push({ text: m.text });
        }

        contentsPayload.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }

      const body: any = {
        contents: contentsPayload,
      };

      if (args.system) {
        body.systemInstruction = {
          parts: [{ text: args.system }],
        };
      }

      const genConfig: any = {};
      if (args.temperature !== null) {
        genConfig.temperature = args.temperature;
      }
      if (Object.keys(genConfig).length > 0) {
        body.generationConfig = genConfig;
      }

      if (includeSearchTool) {
        body.tools = [{ googleSearch: {} }];
      }

      return body;
    };

    let searchToolActive = !!args.geminiSearch;

    const cleanModelId = args.model.replace(/^models\//, '');
    const doRequest = async (useSearch: boolean): Promise<Response> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cleanModelId
      )}:streamGenerateContent?alt=sse`;
      return await smartFetch(
        url,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': args.key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPayload(useSearch)),
          signal: args.signal,
        },
        'Google Gemini'
      );
    };

    let res = await doRequest(searchToolActive);

    // If 400 happens while google_search is on, retry once without tools and notify
    if (!res.ok && (res.status === 400 || res.status === 403 || res.status === 429) && searchToolActive) {
      searchToolActive = false;
      if (args.onNotice) {
        args.onNotice("This model can't search the web; answered without search.");
      }
      res = await doRequest(false);
    }

    if (!res.ok) {
      const errText = await res.text();
      const lower = errText.toLowerCase();
      if (
        lower.includes('image') ||
        lower.includes('vision') ||
        lower.includes('multimodal')
      ) {
        throw new Error(
          "This model can't read images. Choose a model that supports images, or remove the image."
        );
      }
      throw new Error(friendlyError('Google Gemini', res.status, errText, null, args.model));
    }

    let receivedChars = 0;
    let safetyBlocked = false;
    const groundingCitations: { title: string; url: string }[] = [];
    const seenUrls = new Set<string>();

    await readSSE(
      res,
      (data) => {
        const candidate = data?.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY' || data?.promptFeedback?.blockReason) {
          safetyBlocked = true;
        }

        const parts = candidate?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (p.thought === true) continue;
            if (typeof p.text === 'string' && p.text.length > 0) {
              receivedChars += p.text.length;
              args.onText(p.text);
            }
          }
        }

        // Collect grounding metadata
        const chunks = candidate?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          for (const c of chunks) {
            const web = c.web;
            if (web?.uri && !seenUrls.has(web.uri)) {
              seenUrls.add(web.uri);
              groundingCitations.push({
                title: web.title || web.uri,
                url: web.uri,
              });
            }
          }
        }
      },
      args.signal
    );

    if (groundingCitations.length > 0 && args.onCitations) {
      args.onCitations(groundingCitations);
    }

    if (receivedChars === 0 && !args.signal.aborted) {
      if (safetyBlocked) {
        throw new Error('Gemini blocked this response for safety reasons.');
      }
      throw new Error('The model returned an empty response. Try again or choose another model.');
    }
  },
};
