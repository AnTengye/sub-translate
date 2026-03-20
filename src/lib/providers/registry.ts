import { providerDefinitions } from './definitions';
import {
  createProxyTranslationRun,
  finalizeProxyTranslationRun,
  translateViaProxy,
} from './adapters/proxy';
import type {
  ProviderDefinition,
  ProviderId,
  TranslationBatchMetadata,
  TranslationRunCreatePayload,
} from './types';

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

export async function createTranslationRun(
  payload: TranslationRunCreatePayload,
  signal: AbortSignal,
): Promise<{ runId: string }> {
  return createProxyTranslationRun(payload, signal);
}

export async function finalizeTranslationRun(
  runId: string,
  payload: {
    status: 'completed' | 'failed' | 'cancelled';
    summary?: Record<string, number>;
    error?: {
      message: string;
    };
  },
  signal: AbortSignal,
): Promise<{ runId: string }> {
  return finalizeProxyTranslationRun(runId, payload, signal);
}

export async function dispatchTranslate(
  provider: ProviderId,
  texts: string[],
  contextTexts: string[],
  batch: TranslationBatchMetadata,
  runId: string,
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  return translateViaProxy(provider, texts, contextTexts, batch, runId, config, signal);
}
