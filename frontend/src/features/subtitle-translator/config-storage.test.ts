import { describe, expect, it } from 'vitest';
import {
  createDefaultProviderProfiles,
  loadProviderProfiles,
  saveProviderProfiles,
  type ProviderProfileStorageData,
  type ProviderRuntimeSeeds,
} from './config-storage';

const providerSeeds: ProviderRuntimeSeeds = {
  defaultProvider: 'openai-compatible',
  providers: {
    'openai-compatible': {
      profileName: 'Local OpenAI',
      apiEndpoint: 'http://localhost:11434/v1',
      apiKey: 'openai-key',
      model: 'qwen-local',
      disableThinking: '',
    },
    'claude-compatible': {
      profileName: 'Claude Local',
      apiEndpoint: 'http://localhost:11434/v1',
      apiKey: 'claude-key',
      model: 'claude-sonnet',
    },
    baidu: {
      profileName: 'Baidu Local',
      apiEndpoint: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
      appId: 'appid-1',
      apiKey: 'baidu-key',
      secretKey: '',
      modelType: 'llm',
      reference: '',
      punctuationPreprocessing: '',
    },
  },
};

describe('config-storage', () => {
  it('seeds one active profile per provider from runtime defaults when storage is empty', () => {
    window.localStorage.clear();

    const data = loadProviderProfiles(providerSeeds);

    expect(data.defaultProvider).toBe('openai-compatible');
    expect(data.providers['openai-compatible'].activeProfileId).toBe('openai-compatible-default');
    expect(data.providers['openai-compatible'].profiles).toEqual([
      {
        id: 'openai-compatible-default',
        name: 'Local OpenAI',
        config: {
          apiEndpoint: 'http://localhost:11434/v1',
          apiKey: 'openai-key',
          model: 'qwen-local',
          disableThinking: '',
        },
      },
    ]);
    expect(data.providers['claude-compatible'].profiles[0]?.config.apiKey).toBe('claude-key');
    expect(data.providers.baidu.profiles[0]?.config.appId).toBe('appid-1');
  });

  it('restores saved profiles from local storage instead of rebuilding from runtime defaults', () => {
    const saved: ProviderProfileStorageData = {
      version: 1,
      defaultProvider: 'claude-compatible',
      providers: {
        'openai-compatible': {
          activeProfileId: 'openai-alt',
          profiles: [
            {
              id: 'openai-alt',
              name: 'Backup OpenAI',
              config: {
                apiEndpoint: 'https://example.com/v1',
                apiKey: 'persisted-openai-key',
                model: 'gpt-4.1-mini',
                disableThinking: 'true',
              },
            },
          ],
        },
        'claude-compatible': {
          activeProfileId: 'claude-alt',
          profiles: [
            {
              id: 'claude-alt',
              name: 'Backup Claude',
              config: {
                apiEndpoint: 'https://claude.example.com/v1',
                apiKey: 'persisted-claude-key',
                model: 'claude-3-7-sonnet',
              },
            },
          ],
        },
        baidu: {
          activeProfileId: 'baidu-alt',
          profiles: [
            {
              id: 'baidu-alt',
              name: 'Backup Baidu',
              config: {
                apiEndpoint: 'https://baidu.example.com',
                appId: 'persisted-app-id',
                apiKey: '',
                secretKey: 'persisted-secret',
                modelType: 'nmt',
                reference: 'keep names stable',
                punctuationPreprocessing: 'true',
              },
            },
          ],
        },
      },
    };

    saveProviderProfiles(saved);

    const data = loadProviderProfiles(providerSeeds);

    expect(data).toEqual(saved);
  });

  it('falls back to defaults when local storage contains malformed data', () => {
    window.localStorage.setItem('srt-translate.provider-profiles', '{bad json');

    const data = loadProviderProfiles(providerSeeds);
    const defaults = createDefaultProviderProfiles(providerSeeds);

    expect(data).toEqual(defaults);
  });
});
