import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProviderCenterState } from './provider-center-api';

describe('provider-center-api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes null profile arrays from the provider center payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          defaultProvider: 'google',
          families: {
            google: {
              id: 'google',
              label: 'Google',
              description: '',
              activeProfileId: '',
              profiles: [
                {
                  id: 'google-default',
                  family: 'google',
                  name: 'Google Local',
                  enabled: true,
                  isDefault: true,
                  connection: {},
                  settings: {},
                  capabilities: {},
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
            'openai-compatible': {
              id: 'openai-compatible',
              label: 'OpenAI Compatible',
              description: '',
              activeProfileId: '',
              profiles: null,
            },
            'claude-compatible': {
              id: 'claude-compatible',
              label: 'Claude Compatible',
              description: '',
              activeProfileId: '',
              profiles: [],
            },
            baidu: {
              id: 'baidu',
              label: 'Baidu',
              description: '',
              activeProfileId: '',
              profiles: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const state = await fetchProviderCenterState();

    expect(state.families['openai-compatible'].profiles).toEqual([]);
    expect(state.families.google.profiles[0].models).toEqual([]);
    expect(state.families.google.profiles[0].availableModels).toEqual([]);
  });
});
