export type ProviderFieldType = 'text' | 'password' | 'select';

export interface ProviderFieldDefinition {
  key: string;
  label: string;
  type: ProviderFieldType;
  placeholder?: string;
  options?: string[];
}

export interface ProviderDefinition {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  fields: ProviderFieldDefinition[];
  defaults: Record<string, string>;
  corsNote?: string;
}

export type ProviderId = 'claude' | 'openai' | 'qwen' | 'baidu';

export interface TranslationBatchMetadata {
  kind: 'translate' | 'retry';
  sequence: number;
  startIndex: number;
  endIndex: number;
  totalEntries: number;
}

export interface TranslationRunEntry {
  idx: number;
  timecode: string;
  text: string;
}

export interface TranslationRunCreatePayload {
  fileName: string;
  provider: ProviderId;
  totalEntries: number;
  entries: TranslationRunEntry[];
  providerConfig: Record<string, string>;
  translationConfig: {
    batchSize: number;
    contextLines: number;
    temperature: number;
  };
  mode: 'translate' | 'retry-all' | 'retry-single';
}
