import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProviderCenterStorage } from './storage.js';

describe('provider-center storage', () => {
  it('seeds default provider-center data from env when storage is empty', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'provider-center-storage-'));
    const dataFile = join(tempDir, 'provider-center.json');

    const storage = createProviderCenterStorage({
      dataFile,
      env: {
        VITE_DEFAULT_PROVIDER: 'openai-compatible',
        OPENAI_API_ENDPOINT: 'https://openai.example/v1',
        OPENAI_API_KEY: 'openai-key',
        VITE_OPENAI_MODEL: 'gpt-4.1-mini',
        CLAUDE_API_ENDPOINT: 'https://claude.example/v1',
        CLAUDE_API_KEY: 'claude-key',
        VITE_CLAUDE_MODEL: 'claude-3-5-sonnet',
        BAIDU_API_ENDPOINT: 'https://baidu.example',
        BAIDU_APP_ID: 'baidu-app-id',
        BAIDU_API_KEY: 'baidu-key',
        BAIDU_SECRET_KEY: 'baidu-secret',
      },
    });

    const state = await storage.read();

    expect(state.defaultProvider).toBe('openai-compatible');
    expect(state.families['openai-compatible'].profiles).toHaveLength(1);
    expect(state.families['openai-compatible'].profiles[0].connection.apiEndpoint).toBe(
      'https://openai.example/v1',
    );
    expect(state.families['openai-compatible'].profiles[0].settings.model).toBe('gpt-4.1-mini');
    expect(state.families['openai-compatible'].profiles[0].models).toEqual([]);
  });

  it('persists saved provider-center state to disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'provider-center-storage-'));
    const dataFile = join(tempDir, 'provider-center.json');

    const storage = createProviderCenterStorage({ dataFile, env: {} });
    const state = await storage.read();
    const updated = {
      ...state,
      families: {
        ...state.families,
        'openai-compatible': {
          ...state.families['openai-compatible'],
          profiles: state.families['openai-compatible'].profiles.map((profile) =>
            profile.id === 'openai-compatible-default'
              ? {
                  ...profile,
                  name: 'Saved OpenAI',
                  enabled: false,
                }
              : profile,
          ),
        },
      },
    };

    await storage.write(updated);

    const written = JSON.parse(await readFile(dataFile, 'utf8'));
    expect(written.families['openai-compatible'].profiles[0].name).toBe('Saved OpenAI');
    expect(written.families['openai-compatible'].profiles[0].enabled).toBe(false);
  });
});
