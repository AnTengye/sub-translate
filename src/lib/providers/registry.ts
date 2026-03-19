import { providerDefinitions } from './definitions';
import type { ProviderDefinition, ProviderId } from './types';

const definitionsById = new Map<ProviderId, ProviderDefinition>(
  providerDefinitions.map((definition) => [definition.id, definition]),
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
