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
