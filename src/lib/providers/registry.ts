import { providerDefinitions } from './definitions';
import { translateViaProxy } from './adapters/proxy';
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
  return translateViaProxy(provider, texts, contextTexts, config, signal);
}
