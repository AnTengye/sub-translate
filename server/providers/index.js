import { translateWithBaidu } from './baidu.js';
import { translateWithClaude } from './claude.js';
import { translateWithOpenAiCompatible } from './openai-compatible.js';

export async function dispatchServerTranslate(provider, request, signal, deps = {}) {
  switch (provider) {
    case 'claude-compatible':
      return translateWithClaude(request, signal, deps);
    case 'openai-compatible':
      return translateWithOpenAiCompatible(request, signal, deps);
    case 'baidu':
      return translateWithBaidu(request, signal, deps);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
