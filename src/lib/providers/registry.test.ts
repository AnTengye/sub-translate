import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchTranslate, getProviderDefinition, listProviderDefinitions } from './registry';

describe('provider registry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns metadata for supported providers', () => {
    expect(getProviderDefinition('openai').label).toContain('OpenAI');
  });

  it('lists all supported providers', () => {
    expect(listProviderDefinitions().map((provider) => provider.id)).toEqual([
      'claude',
      'openai',
      'qwen',
      'baidu',
    ]);
  });

  it('dispatches provider requests through the local proxy endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ translations: ['你好'] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(
      dispatchTranslate(
        'openai',
        ['こんにちは'],
        [],
        {
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          temperature: '0.2',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual(['你好']);

    expect(fetch).toHaveBeenCalledWith(
      '/api/translate/openai',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: ['こんにちは'],
          contextTexts: [],
          options: {
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            temperature: '0.2',
          },
        }),
      }),
    );
  });
});
