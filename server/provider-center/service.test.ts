import { describe, expect, it, vi } from 'vitest';
import { createProviderCenterService } from './service.js';

describe('provider-center service', () => {
  it('returns provider center state from storage', async () => {
    const read = vi.fn().mockResolvedValue({
      version: 1,
      defaultProvider: 'openai-compatible',
      families: {
        'openai-compatible': {
          id: 'openai-compatible',
          label: 'OpenAI Compatible',
          description: '',
          activeProfileId: 'openai-compatible-default',
          profiles: [],
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
    });
    const service = createProviderCenterService({
      storage: { read, write: vi.fn() },
      discoverModelsForProfile: vi.fn(),
      checkProfileHealth: vi.fn(),
    });

    await expect(service.read()).resolves.toMatchObject({
      defaultProvider: 'openai-compatible',
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('runs discovery for a specific profile and persists the updated state', async () => {
    const write = vi.fn(async (value) => value);
    const state = {
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
              connection: { apiEndpoint: 'https://api.example/v1', apiKey: 'key' },
              settings: { model: 'gpt-4o-mini', disableThinking: '' },
              capabilities: {
                supportsModelDiscovery: true,
                supportsConnectionCheck: true,
                supportsManualModelManagement: true,
                supportsThinkingToggle: true,
              },
              models: [],
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
    };
    const service = createProviderCenterService({
      storage: { read: vi.fn().mockResolvedValue(state), write },
      discoverModelsForProfile: vi.fn().mockResolvedValue({
        models: [{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'auto' }],
        summary: '发现 1 个模型',
      }),
      checkProfileHealth: vi.fn(),
    });

    const result = await service.discoverModels({
      family: 'openai-compatible',
      profileId: 'openai-compatible-default',
    });

    expect(result.models).toHaveLength(1);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
