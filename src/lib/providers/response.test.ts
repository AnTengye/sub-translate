import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './response';

describe('parseTranslationResponse', () => {
  it('parses json arrays wrapped in code fences', () => {
    expect(parseTranslationResponse('```json\n["一","二"]\n```', 2)).toEqual(['一', '二']);
  });

  it('falls back to embedded arrays when present in the response body', () => {
    expect(parseTranslationResponse('结果如下：["一","二"]', 2)).toEqual(['一', '二']);
  });

  it('extracts translations from object arrays returned by local models', () => {
    expect(
      parseTranslationResponse(
        '[{"中文文本":"你确定吗？"},{"translatedText":"虽然有年龄差"}]',
        2,
      ),
    ).toEqual(['你确定吗？', '虽然有年龄差']);
  });

  it('extracts translations from wrapped array payloads', () => {
    expect(
      parseTranslationResponse(
        '{"translations":[{"text":"你确定吗？"},{"content":"虽然有年龄差"}]}',
        2,
      ),
    ).toEqual(['你确定吗？', '虽然有年龄差']);
  });

  it('splits numbered translations embedded in a single object item', () => {
    expect(
      parseTranslationResponse(
        '[{"中文文本":"【待翻译字幕】\\n1. 你确定吗？\\n2. 虽然有年龄差"}]',
        2,
      ),
    ).toEqual(['你确定吗？', '虽然有年龄差']);
  });

  it('returns placeholder failures when content is unusable', () => {
    expect(parseTranslationResponse('oops', 2)).toEqual(['[翻译失败]', '[翻译失败]']);
  });
});
