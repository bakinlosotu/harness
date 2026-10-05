import { friendlyError } from '../lib/errors';
import { smartFetch } from '../lib/smartFetch';
import { readSSE } from '../lib/sse';
import { ChatArgs, normalizeMessages, Provider } from './types';

export const anthropicProvider: Provider = {
  id: 'anthropic',
  name: 'Anthropic',

  async listModels(key: string): Promise<{ id: string; label: string }[]> {
    const res = await smartFetch(
      'https://api.anthropic.com/v1/models?limit=100',
      {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
      },
      'Anthropic'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(friendlyError('Anthropic', res.status, errText));
    }

    const data = await res.json();
    const models: { id: string; label: string }[] = [];

    if (Array.isArray(data.data)) {
      for (const m of data.data) {
        if (m.id) {
          models.push({
            id: m.id,
            label: m.display_name || m.id,
          });
        }
      }
    }

    models.sort((a, b) => b.id.localeCompare(a.id));
    return models;
  },

  async chat(args: ChatArgs): Promise<void> {
    const normalized = normalizeMessages(args.messages);
    if (normalized.length === 0) return;

    const buildPayload = (maxTokens: number) => {
      const messagesPayload: any[] = [];

      for (const m of normalized) {
        const contentParts: any[] = [];

        if (m.images && m.images.length > 0) {
          for (const img of m.images) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.mime,
                data: img.base64,
              },
            });
          }
        }

        if (m.text) {
          contentParts.push({
            type: 'text',
            text: m.text,
          });
        }

        // If content is pure string with no images, Anthropic allows string or array
        messagesPayload.push({
          role: m.role,
          content: contentParts.length > 0 ? contentParts : m.text,
        });
      }

      const body: any = {
        model: args.model,
        max_tokens: maxTokens,
        stream: true,
        messages: messagesPayload,
      };

      if (args.system) {
        body.system = args.system;
      }

      if (args.temperature !== null) {
        body.temperature = args.temperature;
      }

      return body;
    };

    let maxTokens = 8192;

    const doRequest = async (tokens: number): Promise<Response> => {
      return await smartFetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'x-api-key': args.key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json',
          },
          body: JSON.stringify(buildPayload(tokens)),
          signal: args.signal,
        },
        'Anthropic'
      );
    };

    let res = await doRequest(maxTokens);

    if (!res.ok && res.status === 400) {
      const errText = await res.text();
      const lower = errText.toLowerCase();

      if (lower.includes('max_tokens')) {
        maxTokens = 4096;
        res = await doRequest(maxTokens);
      } else {
        if (
          lower.includes('image') ||
          lower.includes('vision') ||
          lower.includes('multimodal')
        ) {
          throw new Error(
            "This model can't read images. Choose a model that supports images, or remove the image."
          );
        }
        throw new Error(friendlyError('Anthropic', res.status, errText, null, args.model));
      }
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
      throw new Error(friendlyError('Anthropic', res.status, errText, null, args.model));
    }

    let receivedChars = 0;
    await readSSE(
      res,
      (data) => {
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const delta = data.delta.text;
          if (typeof delta === 'string' && delta.length > 0) {
            receivedChars += delta.length;
            args.onText(delta);
          }
        } else if (data.type === 'error') {
          throw new Error(data.error?.message || 'Anthropic stream error');
        }
      },
      args.signal
    );

    if (receivedChars === 0 && !args.signal.aborted) {
      throw new Error('The model returned an empty response. Try again or choose another model.');
    }
  },
};
