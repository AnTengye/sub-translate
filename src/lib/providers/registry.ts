import { providerDefinitions } from './definitions';
import { translateWithBaidu } from './adapters/baidu';
import { translateWithClaude } from './adapters/claude';
import { translateWithOpenAiCompatible } from './adapters/openai-compatible';
import { translateWithQwen } from './adapters/qwen';
import type { ProviderDefinition, ProviderId } from './types';

const definitionsById = new Map<ProviderId, ProviderDefinition>(
  providerDefinitions.map((definition) => [definition.id as ProviderId, definition]),
);

export function getProviderDefinition(id: ProviderId): ProviderDefinition {
  const definition = definitionsById.get(id);
  if (!definition) {
    throw new Error(`Unknown provider: ${id}`);
  }

  return definition;
}

export function listProviderDefinitions(): ProviderDefinition[] {
  return providerDefinitions;
}

export async function dispatchTranslate(
  provider: ProviderId,
  texts: string[],
  contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  switch (provider) {
    case 'claude':
      return translateWithClaude(texts, contextTexts, config, signal);
    case 'openai':
      return translateWithOpenAiCompatible(texts, contextTexts, config, signal);
    case 'qwen':
      return translateWithQwen(texts, contextTexts, config, signal);
    case 'baidu':
      return translateWithBaidu(texts, contextTexts, config, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
