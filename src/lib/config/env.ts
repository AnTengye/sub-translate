import type { ProviderId } from '../providers/types';

function readEnv(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

function readProviderId(value: string | undefined): ProviderId {
  switch (value) {
    case 'openai-compatible':
    case 'claude-compatible':
    case 'baidu':
      return value;
    default:
      return 'openai-compatible';
  }
}

export const appEnv = {
  appTitle: readEnv(import.meta.env.VITE_APP_TITLE, 'SRT Translate'),
  defaultProvider: readProviderId(import.meta.env.VITE_DEFAULT_PROVIDER),
  claudeModel: readEnv(import.meta.env.VITE_CLAUDE_MODEL, 'claude-3-5-sonnet-latest'),
  openAiModel: readEnv(import.meta.env.VITE_OPENAI_MODEL, 'gpt-4o-mini'),
};
