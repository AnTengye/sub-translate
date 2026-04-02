import type { SubtitleEntry } from '../../lib/subtitle/types';
import type { ProviderProfileStorageData } from './config-storage';
import type { ProviderCenterStateData } from './provider-center-api';
import type { ProviderTarget } from './target-selection';
import type { WorkflowTemplate, WorkflowTemplateStateData } from './workflow-types';

export interface TranslationConfig {
  batchSize: number;
  contextLines: number;
  temperature: number;
  maxTokens?: number;
}

export interface TranslationLogEntry {
  t: string;
  msg: string;
}

export type SubtitleFilter = 'all' | 'error' | 'done';

export type WorkflowStep = 'upload' | 'config' | 'translating' | 'done';

export interface SubtitleTranslatorState {
  step: WorkflowStep;
  fileName: string;
  entries: SubtitleEntry[];
  display: SubtitleEntry[];
  providerCenter: ProviderCenterStateData | null;
  providerProfiles: ProviderProfileStorageData;
  workflowTemplates: WorkflowTemplateStateData;
  activeTemplateId: string | null;
  workflowDraft: WorkflowTemplate | null;
  primaryTarget: ProviderTarget | null;
  fallbackTarget: ProviderTarget | null;
  translationConfig: TranslationConfig;
  advancedParamsOpen: boolean;
  progress: number;
  logs: TranslationLogEntry[];
  filter: SubtitleFilter;
  error: string | null;
  isRetrying: boolean;
  retryingIndex: number | null;
}
