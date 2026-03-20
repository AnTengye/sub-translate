import { describe, expect, it } from 'vitest';
import { validateTranslateRequest } from './validate.js';

describe('validateTranslateRequest', () => {
  it('normalizes a valid proxy translation request', () => {
    expect(
      validateTranslateRequest('openai', {
        texts: ['こんにちは'],
        contextTexts: ['前文'],
        options: {
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          temperature: 0.2,
        },
      }),
    ).toEqual({
      texts: ['こんにちは'],
      contextTexts: ['前文'],
      options: {
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        temperature: 0.2,
      },
    });
  });

  it('rejects empty subtitle batches', () => {
    expect(() =>
      validateTranslateRequest('claude', {
        texts: [],
      }),
    ).toThrow('至少提供一条待翻译字幕');
  });

  it('rejects provider options outside the allowlist', () => {
    expect(() =>
      validateTranslateRequest('baidu', {
        texts: ['こんにちは'],
        options: {
          apiKey: 'should-not-come-from-client',
        },
      }),
    ).toThrow('存在不允许的配置项: apiKey');
  });

  it('rejects unknown providers', () => {
    expect(() =>
      validateTranslateRequest('unknown', {
        texts: ['こんにちは'],
      }),
    ).toThrow('不支持的翻译引擎');
  });
});
