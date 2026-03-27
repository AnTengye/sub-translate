import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProviderCenterState } from './provider-center-api';

describe('provider-center api normalization', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            version: 1,
            defaultProvider: 'openai-compatible',
            families: {
              'openai-compatible': {
                id: 'openai-compatible',
                label: 'OpenAI Compatible',
                description: '',
                activeProfileId: 'openai-compatible-default',
                profiles: [
                  {
                    id: 'openai-compatible-default',
                    family: 'openai-compatible',
                    name: 'Default OpenAI',
                    enabled: true,
                    isDefault: true,
                    connection: {
                      apiEndpoint: 'https://api.example.com/v1',
                      apiKey: 'key',
                    },
                    settings: {
                      model: 'gpt-4o-mini',
                    },
                    capabilities: {
                      supportsModelDiscovery: true,
                    },
                    models: null,
                    availableModels: null,
                    modelDiscovery: {
                      sourceMode: 'auto',
                      supportsModelDiscovery: true,
                      lastCheckedAt: null,
                      lastStatus: 'idle',
                      lastError: null,
                    },
                    health: {
                      status: 'idle',
                      summary: '未检查',
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
                activeProfileId: 'claude-compatible-default',
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
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes null model arrays into empty arrays', async () => {
    const state = await fetchProviderCenterState();

    expect(state.families['openai-compatible'].profiles[0].models).toEqual([]);
    expect(state.families['openai-compatible'].profiles[0].availableModels).toEqual([]);
  });
});
