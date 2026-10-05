import { ProviderId } from '../lib/storage';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { openaiProvider } from './openai';
import { Provider } from './types';
import { xaiProvider } from './xai';

export * from './types';

export const providers: Record<ProviderId, Provider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  xai: xaiProvider,
};

export function getProvider(id: ProviderId): Provider {
  return providers[id];
}
