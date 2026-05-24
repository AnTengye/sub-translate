import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProviderProfileModelAvailability, fetchProviderCenterState } from './provider-center-api';

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

  it('keeps layered provider limit fields stable during normalization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            version: 1,
            defaultProvider: 'openai-compatible',
            limits: {
              globalRpmLimit: 120,
              globalRpdLimit: 2400,
              rateLimitInterruptThreshold: 5,
            },
            families: {
              google: {
                id: 'google',
                label: 'Google',
                description: '',
                activeProfileId: 'google-default',
                profiles: [],
              },
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
                    rpmLimit: 60,
                    rpdLimit: 1000,
                    models: [
                      {
                        id: 'gpt-4o-mini',
                        label: 'gpt-4o-mini',
                        enabled: true,
                        source: 'manual',
                        rpmLimit: 20,
                        rpdLimit: 200,
                      },
                    ],
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

    const state = await fetchProviderCenterState();

    expect(state.limits).toEqual({
      globalRpmLimit: 120,
      globalRpdLimit: 2400,
      rateLimitInterruptThreshold: 5,
    });
    expect(state.families['openai-compatible'].profiles[0].rpmLimit).toBe(60);
    expect(state.families['openai-compatible'].profiles[0].rpdLimit).toBe(1000);
    expect(state.families['openai-compatible'].profiles[0].models[0].rpdLimit).toBe(200);
  });

  it('fills missing layered provider limit fields with unlimited defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            version: 1,
            defaultProvider: 'openai-compatible',
            families: {
              google: {
                id: 'google',
                label: 'Google',
                description: '',
                activeProfileId: 'google-default',
                profiles: [],
              },
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
                    models: [
                      {
                        id: 'gpt-4o-mini',
                        label: 'gpt-4o-mini',
                        enabled: true,
                        source: 'manual',
                      },
                    ],
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

    const state = await fetchProviderCenterState();

    expect(state.limits).toEqual({
      globalRpmLimit: 0,
      globalRpdLimit: 0,
      rateLimitInterruptThreshold: 3,
    });
    expect(state.families['openai-compatible'].profiles[0].rpmLimit).toBe(0);
    expect(state.families['openai-compatible'].profiles[0].rpdLimit).toBe(0);
    expect(state.families['openai-compatible'].profiles[0].models[0].rpmLimit).toBe(0);
    expect(state.families['openai-compatible'].profiles[0].models[0].rpdLimit).toBe(0);
  });

  it('parses model availability checks from the workflow probe endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'unavailable',
          summary: '模型 gpt-4.1-mini 当前不可用',
          error: 'model not assigned',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await checkProviderProfileModelAvailability(
      'openai-compatible',
      'openai-compatible-default',
      'gpt-4.1-mini',
    );

    expect(result).toEqual({
      status: 'unavailable',
      summary: '模型 gpt-4.1-mini 当前不可用',
      error: 'model not assigned',
    });
  });
});
