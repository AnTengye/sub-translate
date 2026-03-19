import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translateWithBaidu } from './baidu';
import { translateWithOpenAiCompatible } from './openai-compatible';

describe('provider adapters', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts OpenAI-compatible requests to chat completions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '["你好"]' } }],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(
      translateWithOpenAiCompatible(
        ['こんにちは'],
        [],
        {
          apiKey: 'sk-demo',
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual(['你好']);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-demo',
        }),
      }),
    );
  });

  it('throws when baidu credentials are missing', async () => {
    await expect(
      translateWithBaidu(['こんにちは'], [], {}, new AbortController().signal),
    ).rejects.toThrow('请填写百度翻译 APP ID 和密钥');
  });
});
