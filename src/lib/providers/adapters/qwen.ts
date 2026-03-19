import { translateWithOpenAiCompatible } from './openai-compatible';

export async function translateWithQwen(
  texts: string[],
  contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  return translateWithOpenAiCompatible(
    texts,
    contextTexts,
    {
      ...config,
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: config.qwenModel || 'qwen-mt-turbo',
    },
    signal,
  );
}
