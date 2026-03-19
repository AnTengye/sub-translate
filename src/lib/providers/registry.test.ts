import { describe, expect, it } from 'vitest';
import { getProviderDefinition, listProviderDefinitions } from './registry';

describe('provider registry', () => {
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
});
