import { friendlyError } from '../lib/errors';
import { smartFetch } from '../lib/smartFetch';
import { readSSE } from '../lib/sse';
import { ChatArgs, normalizeMessages, Provider } from './types';

export const xaiProvider: Provider = {
  id: 'xai',
  name: 'xAI',

  async listModels(key: string): Promise<{ id: string; label: string }[]> {
    const res = await smartFetch(
      'https://api.x.ai/v1/models',
      {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      },
      'xAI'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(friendlyError('xAI', res.status, errText));
    }

    const data = await res.json();
    const models: { id: string; label: string }[] = [];

    if (Array.isArray(data.data)) {
      for (const m of data.data) {
        const id = m.id;
        const lower = id.toLowerCase();
        if (
          lower.includes('grok') &&
          !lower.includes('image') &&
          !lower.includes('imagine')
        ) {
          models.push({ id, label: id });
        }
      }
    }

    models.sort((a, b) => b.id.localeCompare(a.id));
    return models;
  },

  async chat(args: ChatArgs): Promise<void> {
    const normalized = normalizeMessages(args.messages);
    if (normalized.length === 0) return;

    const buildPayload = (
      includeSystemInMessages: boolean,
      sendTemp: boolean,
      prependSystemToFirstUser: boolean
    ) => {
      const messagesPayload: any[] = [];

      let firstUserTextExtra = '';
      if (args.system && prependSystemToFirstUser) {
        firstUserTextExtra = `${args.system}\n\n`;
      } else if (args.system && includeSystemInMessages) {
        messagesPayload.push({
          role: 'system',
          content: args.system,
        });
      }

      for (let i = 0; i < normalized.length; i++) {
        const m = normalized[i];
        let textContent = m.text;
        if (i === 0 && firstUserTextExtra && m.role === 'user') {
          textContent = `${firstUserTextExtra}${textContent}`;
        }

        if (m.images && m.images.length > 0) {
          const contentParts: any[] = [];
          if (textContent) {
            contentParts.push({ type: 'text', text: textContent });
          }
          for (const img of m.images) {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${img.mime};base64,${img.base64}`,
              },
            });
          }
          messagesPayload.push({
            role: m.role,
            content: contentParts,
          });
        } else {
          messagesPayload.push({
            role: m.role,
            content: textContent,
          });
        }
      }

      const body: any = {
        model: args.model,
        stream: true,
        messages: messagesPayload,
      };

      if (sendTemp && args.temperature !== null) {
        body.temperature = args.temperature;
      }

      return body;
    };

    let includeSystem = true;
    let sendTemp = args.temperature !== null;
    let prependSystem = false;

    const doRequest = async (body: any): Promise<Response> => {
      return await smartFetch(
        'https://api.x.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${args.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: args.signal,
        },
        'xAI'
      );
    };

    let res = await doRequest(buildPayload(includeSystem, sendTemp, prependSystem));

    if (!res.ok && res.status === 400) {
      const errText = await res.text();
      const lower = errText.toLowerCase();

      if (lower.includes('system') && lower.includes('not supported')) {
        includeSystem = false;
        prependSystem = true;
        res = await doRequest(buildPayload(includeSystem, sendTemp, prependSystem));
      } else if (lower.includes('temperature')) {
        sendTemp = false;
        res = await doRequest(buildPayload(includeSystem, sendTemp, prependSystem));
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
        throw new Error(friendlyError('xAI', res.status, errText, null, args.model));
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
      throw new Error(friendlyError('xAI', res.status, errText, null, args.model));
    }

    let receivedChars = 0;
    await readSSE(
      res,
      (data) => {
        const delta = data?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          receivedChars += delta.length;
          args.onText(delta);
        }
      },
      args.signal
    );

    if (receivedChars === 0 && !args.signal.aborted) {
      throw new Error('The model returned an empty response. Try again or choose another model.');
    }
  },
};
