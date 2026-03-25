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

  it('prefers request-scoped OpenAI runtime overrides over server env values', async () => {
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

    await dispatchServerTranslate(
      'openai-compatible',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'gpt-4o-mini',
        },
        runtimeOverrides: {
          apiEndpoint: 'https://runtime-openai.example/v1',
          apiKey: 'runtime-openai-key',
        },
      },
      new AbortController().signal,
      {
        fetchImpl,
        env: {
          OPENAI_API_KEY: 'sk-server',
          OPENAI_API_ENDPOINT: 'https://server-openai.example/v1',
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://runtime-openai.example/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer runtime-openai-key',
        }),
      }),
    );
  });

  it('normalizes object-array translations from OpenAI-compatible local models', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { 中文文本: '你确定吗？' },
                  { translatedText: '虽然有年龄差' },
                ]),
              },
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
        'openai-compatible',
        {
          texts: ['本当ですか?', '年の差はありますけども'],
          contextTexts: [],
          options: {
            model: 'local-sakura',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            OPENAI_API_KEY: 'sk-server',
            OPENAI_API_ENDPOINT: 'http://127.0.0.1:11434/v1',
          },
        },
      ),
    ).resolves.toMatchObject({
      translations: ['你确定吗？', '虽然有年龄差'],
      debug: {
        request: {
          endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
        },
      },
    });
  });

  it('disables thinking for Qwen-compatible models using fuzzy model matching', async () => {
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

    await dispatchServerTranslate(
      'openai-compatible',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'Qwen/QwQ-32B',
          disableThinking: 'true',
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
    );

    const [, requestInit] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      model: 'Qwen/QwQ-32B',
      enable_thinking: false,
    });
  });

  it('disables thinking for DeepSeek-compatible models using fuzzy model matching', async () => {
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

    await dispatchServerTranslate(
      'openai-compatible',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'deepseek-r1-distill-qwen-32b',
          disableThinking: 'true',
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
    );

    const [, requestInit] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      model: 'deepseek-r1-distill-qwen-32b',
      thinking: {
        type: 'disabled',
      },
    });
  });

  it('ignores the disable thinking toggle for unrecognized models', async () => {
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

    await dispatchServerTranslate(
      'openai-compatible',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'gpt-4o-mini',
          disableThinking: 'true',
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
    );

    const [, requestInit] = fetchImpl.mock.calls[0];
    const payload = JSON.parse(String(requestInit.body));
    expect(payload).not.toHaveProperty('enable_thinking');
    expect(payload).not.toHaveProperty('thinking');
  });

  it('extracts numbered translations wrapped inside a single object item', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    中文文本: '【待翻译字幕】\n1. 你确定吗？\n2. 虽然有年龄差',
                  },
                ]),
              },
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
        'openai-compatible',
        {
          texts: ['本当ですか?', '年の差はありますけども'],
          contextTexts: [],
          options: {
            model: 'local-sakura',
          },
        },
        new AbortController().signal,
        {
          fetchImpl,
          env: {
            OPENAI_API_KEY: 'sk-server',
            OPENAI_API_ENDPOINT: 'http://127.0.0.1:11434/v1',
          },
        },
      ),
    ).resolves.toMatchObject({
      translations: ['你确定吗？', '虽然有年龄差'],
    });
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

  it('prefers request-scoped Claude runtime overrides over server env values', async () => {
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

    const result = await dispatchServerTranslate(
      'claude-compatible',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'claude-3-5-sonnet-latest',
        },
        runtimeOverrides: {
          apiEndpoint: 'https://runtime-claude.example/v1',
          apiKey: 'runtime-claude-key',
        },
      },
      new AbortController().signal,
      {
        fetchImpl,
        env: {
          CLAUDE_API_KEY: 'sk-claude',
          CLAUDE_API_ENDPOINT: 'https://server-claude.example/v1',
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://runtime-claude.example/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'runtime-claude-key',
        }),
      }),
    );
    expect(result.debug.request.headers['x-api-key']).toBe('[REDACTED]');
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

  it('prefers request-scoped Baidu runtime overrides over server env values and keeps auth redacted', async () => {
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

    const result = await dispatchServerTranslate(
      'baidu',
      {
        texts: ['こんにちは'],
        contextTexts: [],
        options: {},
        runtimeOverrides: {
          apiEndpoint: 'https://runtime-baidu.example/translate',
          appId: 'runtime-app-id',
          secretKey: 'runtime-secret',
        },
      },
      new AbortController().signal,
      {
        fetchImpl,
        now: () => 1234567890,
        env: {
          BAIDU_API_KEY: 'server-api-key',
          BAIDU_APP_ID: 'server-app-id',
          BAIDU_API_ENDPOINT: 'https://server-baidu.example/translate',
          BAIDU_SECRET_KEY: 'server-secret',
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://runtime-baidu.example/translate',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
    expect(result.debug.request.headers).not.toHaveProperty('Authorization');
    expect(result.debug.request.payload).toMatchObject({
      appid: 'runtime-app-id',
      salt: '1234567890',
      sign: '8a452261510810e9a8aea9bc3cc3feda',
    });
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
