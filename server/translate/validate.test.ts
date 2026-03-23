import { describe, expect, it } from 'vitest';
import { validateTranslateRequest } from './validate.js';

describe('validateTranslateRequest', () => {
  it('normalizes a valid proxy translation request', () => {
    expect(
      validateTranslateRequest('openai-compatible', {
        runId: 'run-123',
        texts: ['こんにちは'],
        contextTexts: ['前文'],
        batch: {
          kind: 'translate',
          sequence: 1,
          startIndex: 0,
          endIndex: 0,
          totalEntries: 1,
        },
        options: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
        },
      }),
    ).toEqual({
      runId: 'run-123',
      texts: ['こんにちは'],
      contextTexts: ['前文'],
      batch: {
        kind: 'translate',
        sequence: 1,
        startIndex: 0,
        endIndex: 0,
        totalEntries: 1,
      },
      options: {
        model: 'gpt-4o-mini',
        temperature: 0.2,
      },
    });
  });

  it('rejects empty subtitle batches', () => {
    expect(() =>
      validateTranslateRequest('claude-compatible', {
        texts: [],
      }),
    ).toThrow('至少提供一条待翻译字幕');
  });

  it('rejects provider options outside the allowlist', () => {
    expect(() =>
      validateTranslateRequest('openai-compatible', {
        texts: ['こんにちは'],
        options: {
          endpoint: 'https://should-not-come-from-client',
        },
      }),
    ).toThrow('存在不允许的配置项: endpoint');
  });

  it('rejects unknown providers', () => {
    expect(() =>
      validateTranslateRequest('unknown', {
        texts: ['こんにちは'],
      }),
    ).toThrow('不支持的翻译引擎');
  });

  it('rejects malformed batch metadata', () => {
    expect(() =>
      validateTranslateRequest('openai-compatible', {
        runId: 'run-123',
        texts: ['こんにちは'],
        batch: {
          kind: 'translate',
          sequence: '1',
          startIndex: 0,
          endIndex: 0,
          totalEntries: 1,
        },
      }),
    ).toThrow('批次元信息格式无效');
  });

  it('allows the optional Baidu punctuation preprocessing flag', () => {
    expect(
      validateTranslateRequest('baidu', {
        texts: ['こんにちは'],
        options: {
          modelType: 'llm',
          punctuationPreprocessing: 'true',
        },
      }),
    ).toEqual({
      runId: undefined,
      texts: ['こんにちは'],
      contextTexts: [],
      batch: undefined,
      options: {
        modelType: 'llm',
        punctuationPreprocessing: 'true',
      },
    });
  });

  it('allows the optional OpenAI disable thinking flag', () => {
    expect(
      validateTranslateRequest('openai-compatible', {
        texts: ['こんにちは'],
        options: {
          model: 'qwen-turbo',
          disableThinking: 'true',
        },
      }),
    ).toEqual({
      runId: undefined,
      texts: ['こんにちは'],
      contextTexts: [],
      batch: undefined,
      options: {
        model: 'qwen-turbo',
        disableThinking: 'true',
      },
    });
  });
});
