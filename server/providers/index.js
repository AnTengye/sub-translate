import { translateWithBaidu } from './baidu.js';
import { translateWithClaude } from './claude.js';
import { translateWithOpenAiCompatible } from './openai-compatible.js';
import { translateWithQwen } from './qwen.js';

export async function dispatchServerTranslate(provider, request, signal, deps = {}) {
  switch (provider) {
    case 'claude':
      return translateWithClaude(request, signal, deps);
    case 'openai':
      return translateWithOpenAiCompatible(request, signal, deps);
    case 'qwen':
      return translateWithQwen(request, signal, deps);
    case 'baidu':
      return translateWithBaidu(request, signal, deps);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
