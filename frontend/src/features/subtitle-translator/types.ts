import type { SubtitleEntry } from '../../lib/subtitle/types';
import type { ProviderProfileStorageData } from './config-storage';
import type { ProviderCenterStateData } from './provider-center-api';
import type { ProviderTarget } from './target-selection';
import type { WorkflowTemplate, WorkflowTemplateStateData } from './workflow-types';
import type { WorkflowExecutionSnapshot } from './utils/workflow';

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
export type WorkflowRunStatus = 'idle' | 'running' | 'paused' | 'paused-interrupted' | 'completed';

export interface SubtitleTranslatorState {
  step: WorkflowStep;
  fileName: string;
  sourceContent: string;
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
  runStatus: WorkflowRunStatus;
  pausedSnapshot: WorkflowExecutionSnapshot | null;
  filter: SubtitleFilter;
  error: string | null;
  isRetrying: boolean;
  retryingIndex: number | null;
}
