import type { SubtitleEntry } from '../../lib/subtitle/types';
import type { ProviderId } from '../../lib/providers/types';

export interface TranslationConfig {
  batchSize: number;
  contextLines: number;
  temperature: number;
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
  provider: ProviderId;
  providerConfig: Record<string, string>;
  translationConfig: TranslationConfig;
  progress: number;
  logs: TranslationLogEntry[];
  filter: SubtitleFilter;
  error: string | null;
  isRetrying: boolean;
  retryingIndex: number | null;
}
