import { describe, expect, it } from 'vitest';
import type { ProviderCenterStateData } from './provider-center-api';
import { buildProviderRequestConfig } from './target-selection';

const providerCenter: ProviderCenterStateData = {
  version: 1,
  defaultProvider: 'google',
  families: {
    google: {
      id: 'google',
      label: 'Google',
      description: '',
      activeProfileId: 'google-default',
      profiles: [
        {
          id: 'google-default',
          family: 'google',
          name: 'Google Local',
          enabled: true,
          isDefault: true,
          connection: {
            apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: 'google-key',
          },
          settings: {
            model: 'models/gemini-2.5-flash',
            providerLabel: 'Google',
            disableThinking: 'true',
          },
          capabilities: {},
          models: [{ id: 'models/gemini-2.5-flash', label: 'models/gemini-2.5-flash', enabled: true, source: 'auto', rpmLimit: 0 }],
          modelDiscovery: {
            sourceMode: 'auto',
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
    'openai-compatible': {
      id: 'openai-compatible',
      label: 'OpenAI Compatible',
      description: '',
      activeProfileId: 'openai-default',
      profiles: [],
    },
    'claude-compatible': {
      id: 'claude-compatible',
      label: 'Claude Compatible',
      description: '',
      activeProfileId: 'claude-default',
      profiles: [],
    },
    baidu: {
      id: 'baidu',
      label: 'Baidu',
      description: '',
      activeProfileId: 'baidu-default',
      profiles: [],
    },
  },
};

describe('target-selection', () => {
  it('builds google provider request config from selected target', () => {
    const result = buildProviderRequestConfig(
      providerCenter,
      {
        family: 'google',
        profileId: 'google-default',
        modelId: 'models/gemini-2.5-flash',
      },
      0.2,
    );

    expect(result).toEqual({
      provider: 'google',
      profileId: 'google-default',
      config: {
        model: 'models/gemini-2.5-flash',
        temperature: '0.2',
        disableThinking: 'true',
      },
      runtimeOverrides: {
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'google-key',
      },
    });
  });
});
