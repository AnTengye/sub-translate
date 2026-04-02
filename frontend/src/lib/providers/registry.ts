import { providerDefinitions } from './definitions';
import {
  createProxyTranslationRun,
  executeWorkflowNodeViaProxy,
  finalizeProxyTranslationRun,
  translateViaProxy,
} from './adapters/proxy';
import type {
  ProviderDefinition,
  ProviderId,
  ProviderRuntimeOverrides,
  TranslationBatchMetadata,
  TranslationRunCreatePayload,
  WorkflowCandidateSet,
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
  profileId: string | null,
  texts: string[],
  contextTexts: string[],
  batch: TranslationBatchMetadata,
  runId: string,
  config: Record<string, string>,
  runtimeOverrides: ProviderRuntimeOverrides,
  signal: AbortSignal,
): Promise<string[]> {
  return translateViaProxy(
    provider,
    profileId,
    texts,
    contextTexts,
    batch,
    runId,
    config,
    runtimeOverrides,
    signal,
  );
}

export async function executeWorkflowNode(
  provider: ProviderId,
  payload: {
    operation: 'translate' | 'review' | 'judge';
    profileId: string | null;
    texts: string[];
    contextTexts: string[];
    batch: TranslationBatchMetadata;
    runId: string;
    config: Record<string, string>;
    runtimeOverrides: ProviderRuntimeOverrides;
    draftTexts?: string[];
    candidateSets?: WorkflowCandidateSet[];
  },
  signal: AbortSignal,
): Promise<{ translations: string[]; metadata?: Record<string, unknown> }> {
  return executeWorkflowNodeViaProxy(provider, payload, signal);
}
