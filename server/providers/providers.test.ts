import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchServerTranslate } from './index.js';

describe('server provider adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses server-side OpenAI-compatible credentials and endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '["你好"]' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'openai-compatible',
        {
          texts: ['こんにちは'],
          contextTexts: [],
          options: {
            model: 'gpt-4o-mini',
            temperature: 0.2,
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            OPENAI_API_KEY: 'sk-server',
            OPENAI_API_ENDPOINT: 'https://openrouter.example/api/v1',
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://openrouter.example/api/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer [REDACTED]',
          },
          payload: {
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 4096,
            stop: ['<|endoftext|>', '<|im_start|>'],
            messages: [
              expect.objectContaining({ role: 'system' }),
              expect.objectContaining({ role: 'user' }),
            ],
          },
        },
        response: {
          status: 200,
          rawText: '["你好"]',
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.example/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-server',
        }),
      }),
    );
  });

  it('uses server-side Claude-compatible credentials and endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ text: '["你好"]' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'claude-compatible',
        {
          texts: ['こんにちは'],
          contextTexts: [],
          options: {
            model: 'claude-3-5-sonnet-latest',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            CLAUDE_API_KEY: 'sk-claude',
            CLAUDE_API_ENDPOINT: 'https://claude-proxy.example/v1',
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://claude-proxy.example/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': '[REDACTED]',
            'anthropic-version': '2023-06-01',
          },
          payload: {
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 2048,
            system: expect.any(String),
            messages: [expect.objectContaining({ role: 'user' })],
          },
        },
        response: {
          status: 200,
          rawText: '["你好"]',
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://claude-proxy.example/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-claude',
        }),
      }),
    );
  });

  it('uses the configured Baidu endpoint with Bearer auth by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trans_result: [{ src: 'こんにちは', dst: '你好' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'baidu',
        {
          texts: ['こんにちは'],
          contextTexts: [],
          options: {
            modelType: 'llm',
            reference: '保持口语自然',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            BAIDU_API_KEY: 'baidu-key',
            BAIDU_APP_ID: 'baidu-app',
            BAIDU_API_ENDPOINT: 'https://baidu-proxy.example/translate',
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://baidu-proxy.example/translate',
          headers: {
            Authorization: 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
          },
          payload: {
            appid: 'baidu-app',
            from: 'jp',
            to: 'zh',
            q: 'こんにちは',
            model_type: 'llm',
            reference: '保持口语自然',
          },
        },
        response: {
          status: 200,
          rawText: JSON.stringify({
            trans_result: [{ src: 'こんにちは', dst: '你好' }],
          }),
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://baidu-proxy.example/translate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer baidu-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          appid: 'baidu-app',
          from: 'jp',
          to: 'zh',
          q: 'こんにちは',
          model_type: 'llm',
          reference: '保持口语自然',
        }),
      }),
    );
  });

  it('realigns split Baidu response items back to the original subtitle entries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trans_result: [
            { src: 'うん。', dst: '嗯。' },
            { src: 'だから、ママに先にやっといてほしいなと思って。', dst: '所以，我想让妈妈先帮我做一下。' },
            { src: 'うーん。', dst: '嗯。' },
            { src: '考えとく。', dst: '我考虑一下。' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'baidu',
        {
          texts: ['うん。だから、ママに先にやっといてほしいなと思って。', 'うーん。考えとく。'],
          contextTexts: [],
          options: {
            modelType: 'llm',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            BAIDU_API_KEY: 'baidu-key',
            BAIDU_APP_ID: 'baidu-app',
            BAIDU_API_ENDPOINT: 'https://baidu-proxy.example/translate',
          },
        },
      ),
    ).resolves.toMatchObject({
      translations: ['嗯。所以，我想让妈妈先帮我做一下。', '嗯。我考虑一下。'],
      debug: {
        request: {
          payload: {
            q: 'うん。だから、ママに先にやっといてほしいなと思って。\nうーん。考えとく。',
          },
        },
      },
    });
  });

  it('optionally preprocesses punctuation for Baidu requests and restores it after translation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trans_result: [
            {
              src: 'おかえり__SRT_PUNC_STOP__また来たの__SRT_PUNC_QUESTION__',
              dst: '你回来了__SRT_PUNC_STOP__又来了吗__SRT_PUNC_QUESTION__',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'baidu',
        {
          texts: ['おかえり。また来たの?'],
          contextTexts: [],
          options: {
            modelType: 'llm',
            punctuationPreprocessing: 'true',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            BAIDU_API_KEY: 'baidu-key',
            BAIDU_APP_ID: 'baidu-app',
            BAIDU_API_ENDPOINT: 'https://baidu-proxy.example/translate',
          },
        },
      ),
    ).resolves.toMatchObject({
      translations: ['你回来了。又来了吗?'],
      debug: {
        request: {
          payload: {
            q: 'おかえり__SRT_PUNC_STOP__また来たの__SRT_PUNC_QUESTION__',
          },
        },
      },
    });
  });

  it('falls back to Baidu sign auth when API key is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trans_result: [{ src: 'こんにちは', dst: '你好' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      dispatchServerTranslate(
        'baidu',
        {
          texts: ['こんにちは'],
          contextTexts: [],
          options: {},
        },
        new AbortController().signal,
        {
          fetchImpl,
          now: () => 1234567890,
          env: {
            BAIDU_APP_ID: 'baidu-app',
            BAIDU_SECRET_KEY: 'baidu-secret',
            BAIDU_API_ENDPOINT: 'https://baidu-proxy.example/translate',
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://baidu-proxy.example/translate',
          headers: {
            'Content-Type': 'application/json',
          },
          payload: {
            appid: 'baidu-app',
            from: 'jp',
            to: 'zh',
            q: 'こんにちは',
            salt: '1234567890',
            sign: 'e62b6d999bdc54c1d655787a0e9f0ffb',
          },
        },
        response: {
          status: 200,
          rawText: JSON.stringify({
            trans_result: [{ src: 'こんにちは', dst: '你好' }],
          }),
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://baidu-proxy.example/translate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
        body: JSON.stringify({
          appid: 'baidu-app',
          from: 'jp',
          to: 'zh',
          q: 'こんにちは',
          salt: '1234567890',
          sign: 'e62b6d999bdc54c1d655787a0e9f0ffb',
        }),
      }),
    );
  });
});
