import type { ProviderId } from '../providers/types';

function readEnv(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

function readProviderId(value: string | undefined): ProviderId {
  switch (value) {
    case 'claude':
    case 'openai':
    case 'qwen':
    case 'baidu':
      return value;
    default:
      return 'claude';
  }
}

export const appEnv = {
  appTitle: readEnv(import.meta.env.VITE_APP_TITLE, 'SRT Translate'),
  defaultProvider: readProviderId(import.meta.env.VITE_DEFAULT_PROVIDER),
  claudeModel: readEnv(import.meta.env.VITE_CLAUDE_MODEL, 'claude-3-5-sonnet-latest'),
  openAiEndpoint: readEnv(import.meta.env.VITE_OPENAI_ENDPOINT, 'https://api.openai.com/v1'),
  openAiModel: readEnv(import.meta.env.VITE_OPENAI_MODEL, 'gpt-4o-mini'),
  qwenModel: readEnv(import.meta.env.VITE_QWEN_MODEL, 'qwen-mt-turbo'),
};
