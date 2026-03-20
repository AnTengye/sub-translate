import { translateWithOpenAiCompatible } from './openai-compatible.js';

export async function translateWithQwen(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;

  if (!env.QWEN_API_KEY) {
    throw new Error('服务端未配置 QWEN_API_KEY');
  }

  return translateWithOpenAiCompatible(
    {
      ...request,
      options: {
        ...request.options,
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: request.options.qwenModel || 'qwen-mt-turbo',
      },
    },
    signal,
    {
      fetchImpl,
      env: {
        ...env,
        OPENAI_API_KEY: env.QWEN_API_KEY,
      },
    },
  );
}
