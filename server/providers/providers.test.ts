import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchServerTranslate } from './index.js';

describe('server provider adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses server-side OpenAI credentials for OpenAI-compatible requests', async () => {
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
        'openai',
        {
          texts: ['こんにちは'],
          contextTexts: [],
          options: {
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            temperature: 0.2,
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            OPENAI_API_KEY: 'sk-server',
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer [REDACTED]',
          },
          payload: {
            model: 'gpt-4o-mini',
            temperature: 0.2,
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
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-server',
        }),
      }),
    );
  });

  it('uses Baidu AI text translation endpoint with Bearer auth by default', async () => {
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
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
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
      'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
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
          },
        },
      ),
    ).resolves.toEqual({
      translations: ['你好'],
      debug: {
        request: {
          endpoint: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
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
      'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
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
