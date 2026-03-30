import { describe, expect, it } from 'vitest';
import type { ProviderProfileStorageData } from '../config-storage';
import type { ProviderCenterStateData } from '../provider-center-api';
import { createInitialState, subtitleTranslatorReducer } from './reducer';

describe('subtitleTranslatorReducer', () => {
  const persistedProfiles: ProviderProfileStorageData = {
    version: 1,
    defaultProvider: 'claude-compatible',
    providers: {
      'openai-compatible': {
        activeProfileId: 'openai-default',
        profiles: [
          {
            id: 'openai-default',
            name: 'OpenAI Local',
            config: {
              apiEndpoint: 'http://localhost:11434/v1',
              apiKey: 'openai-key',
              model: 'qwen-local',
              disableThinking: '',
            },
          },
        ],
      },
      'claude-compatible': {
        activeProfileId: 'claude-default',
        profiles: [
          {
            id: 'claude-default',
            name: 'Claude Local',
            config: {
              apiEndpoint: 'https://claude.example.com/v1',
              apiKey: 'claude-key',
              model: 'claude-sonnet',
            },
          },
        ],
      },
      baidu: {
        activeProfileId: 'baidu-default',
        profiles: [
          {
            id: 'baidu-default',
            name: 'Baidu Local',
            config: {
              apiEndpoint: 'https://baidu.example.com',
              appId: 'app-id',
              apiKey: 'baidu-key',
              secretKey: '',
              modelType: 'nmt',
              reference: 'keep names stable',
              punctuationPreprocessing: 'true',
            },
          },
        ],
      },
    },
  };

  const providerCenter: ProviderCenterStateData = {
    version: 1,
    defaultProvider: 'openai-compatible',
    families: {
      'openai-compatible': {
        id: 'openai-compatible',
        label: 'OpenAI Compatible',
        description: '',
        activeProfileId: 'openai-default',
        profiles: [
          {
            id: 'openai-default',
            family: 'openai-compatible',
            name: 'OpenAI Local',
            enabled: true,
            isDefault: true,
            connection: {
              apiEndpoint: 'https://openai.example.com/v1',
              apiKey: 'openai-key',
            },
            settings: {
              model: 'gpt-4o-mini',
            },
            capabilities: {},
            models: [
              { id: 'gpt-4o-mini', label: 'gpt-4o-mini', enabled: true, source: 'manual' },
              { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'manual' },
            ],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: true,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'success',
              summary: '可用',
              lastCheckedAt: null,
              error: null,
            },
          },
        ],
      },
      'claude-compatible': {
        id: 'claude-compatible',
        label: 'Claude Compatible',
        description: '',
        activeProfileId: 'claude-default',
        profiles: [
          {
            id: 'claude-default',
            family: 'claude-compatible',
            name: 'Claude Local',
            enabled: true,
            isDefault: false,
            connection: {
              apiEndpoint: 'https://claude.example.com/v1',
              apiKey: 'claude-key',
            },
            settings: {
              model: 'claude-sonnet',
              providerLabel: 'Anthropic',
            },
            capabilities: {},
            models: [
              { id: 'claude-sonnet', label: 'claude-sonnet', enabled: true, source: 'manual' },
            ],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: false,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'success',
              summary: '可用',
              lastCheckedAt: null,
              error: null,
            },
          },
        ],
      },
      baidu: {
        id: 'baidu',
        label: 'Baidu',
        description: '',
        activeProfileId: 'baidu-default',
        profiles: [
          {
            id: 'baidu-default',
            family: 'baidu',
            name: 'Baidu Local',
            enabled: true,
            isDefault: false,
            connection: {
              apiEndpoint: 'https://baidu.example.com',
              appId: 'app-id',
              apiKey: 'baidu-key',
              secretKey: 'baidu-secret',
            },
            settings: {
              modelType: 'llm',
            },
            capabilities: {},
            models: [{ id: 'llm', label: 'llm', enabled: true, source: 'manual' }],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: false,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'warning',
              summary: '未通过检测',
              lastCheckedAt: null,
              error: 'warning',
            },
          },
        ],
      },
    },
  };

  it('moves to config when a valid file is loaded', () => {
    const state = createInitialState();
    const next = subtitleTranslatorReducer(state, {
      type: 'fileLoaded',
      fileName: 'demo.srt',
      entries: [
        {
          idx: 1,
          timecode: '00:00:01,000 --> 00:00:02,000',
          text: 'こんにちは',
          translated: null,
          status: 'pending',
        },
      ],
    });

    expect(next.step).toBe('config');
    expect(next.fileName).toBe('demo.srt');
    expect(next.display).toHaveLength(1);
  });

  it('keeps legacy persisted profiles but does not derive runtime target from them alone', () => {
    const state = createInitialState(persistedProfiles);

    expect(state.providerProfiles).toEqual(persistedProfiles);
    expect(state.primaryTarget).toBeNull();
    expect(state.fallbackTarget).toBeNull();
  });

  it('hydrates eligible primary and fallback targets from provider center data', () => {
    const state = createInitialState(persistedProfiles);

    const next = subtitleTranslatorReducer(state, {
      type: 'hydrateProviderCenter',
      providerCenter,
    });

    expect(next.primaryTarget).toEqual({
      family: 'openai-compatible',
      profileId: 'openai-default',
      modelId: 'gpt-4o-mini',
    });
    expect(next.fallbackTarget).toEqual({
      family: 'claude-compatible',
      profileId: 'claude-default',
      modelId: 'claude-sonnet',
    });
  });

  it('prevents fallback from duplicating the primary target', () => {
    const hydrated = subtitleTranslatorReducer(createInitialState(persistedProfiles), {
      type: 'hydrateProviderCenter',
      providerCenter,
    });

    const next = subtitleTranslatorReducer(hydrated, {
      type: 'setFallbackTarget',
      target: {
        family: 'openai-compatible',
        profileId: 'openai-default',
        modelId: 'gpt-4o-mini',
      },
    });

    expect(next.fallbackTarget).toEqual({
      family: 'claude-compatible',
      profileId: 'claude-default',
      modelId: 'claude-sonnet',
    });
  });
});
