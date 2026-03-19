import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './response';

describe('parseTranslationResponse', () => {
  it('parses json arrays wrapped in code fences', () => {
    expect(parseTranslationResponse('```json\n["一","二"]\n```', 2)).toEqual(['一', '二']);
  });

  it('falls back to embedded arrays when present in the response body', () => {
    expect(parseTranslationResponse('结果如下：["一","二"]', 2)).toEqual(['一', '二']);
  });

  it('returns placeholder failures when content is unusable', () => {
    expect(parseTranslationResponse('oops', 2)).toEqual(['[翻译失败]', '[翻译失败]']);
  });
});
