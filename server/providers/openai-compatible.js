import { parseTranslationResponse } from './response.js';

function normalizeModelName(model) {
  return String(model || '').trim().toLowerCase();
}

function buildThinkingOverride(model, disableThinking) {
  if (disableThinking !== 'true') {
    return {};
  }

  const normalizedModel = normalizeModelName(model);
  if (normalizedModel === '') {
    return {};
  }

  if (normalizedModel.includes('deepseek')) {
    return {
      thinking: {
        type: 'disabled',
      },
    };
  }

  if (
    normalizedModel.includes('qwen') ||
    normalizedModel.includes('qwq') ||
    normalizedModel.includes('kimi') ||
    normalizedModel.includes('moonshot')
  ) {
    return {
      enable_thinking: false,
    };
  }

  return {};
}

function buildTranslationMessages(texts, contextTexts) {
  const system = `你是专业的日语字幕翻译员，将日语字幕精准翻译成简体中文。
规则：保持自然流畅的中文表达；字幕简洁不冗长；人名、专有名词前后一致。
必须严格返回JSON数组格式，如：["翻译1","翻译2"]，不含任何说明或代码块。`;

  const contextBlock =
    contextTexts.length > 0
      ? `\n【前文参考（勿重复翻译，仅用于保持人名、剧情连贯）】\n${contextTexts
          .map((text, index) => `${index + 1}. ${text}`)
          .join('\n')}\n`
      : '';

  return {
    system,
    user: `${contextBlock}\n【待翻译字幕】\n${texts
      .map((text, index) => `${index + 1}. ${text}`)
      .join('\n')}\n\n以JSON数组返回翻译结果：`,
  };
}

export async function translateWithOpenAiCompatible(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const runtimeOverrides =
    request.runtimeOverrides && typeof request.runtimeOverrides === 'object'
      ? request.runtimeOverrides
      : {};
  const endpoint = (
    runtimeOverrides.apiEndpoint ||
    env.OPENAI_API_ENDPOINT ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  const apiKey = runtimeOverrides.apiKey || env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('服务端未配置 OPENAI_API_KEY');
  }

  const { system, user } = buildTranslationMessages(request.texts, request.contextTexts);
  const model = request.options.model || 'gpt-4o-mini';
  const payload = {
    model,
    temperature: Number.parseFloat(String(request.options.temperature ?? 0.3)) || 0.3,
    max_tokens: Number.parseInt(String(request.options.maxTokens ?? 4096), 10) || 4096,
    stop: ['<|endoftext|>', '<|im_start|>'],
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...buildThinkingOverride(model, request.options.disableThinking),
  };
  const response = await fetchImpl(`${endpoint}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API ${response.status}: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content ?? '';

  return {
    translations: parseTranslationResponse(rawText, request.texts.length),
    debug: {
      request: {
        endpoint: `${endpoint}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer [REDACTED]',
        },
        payload,
      },
      response: {
        status: response.status,
        rawText,
      },
    },
  };
}
