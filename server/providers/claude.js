import { parseTranslationResponse } from './response.js';

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

export async function translateWithClaude(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const endpoint = (env.CLAUDE_API_ENDPOINT || 'https://api.anthropic.com/v1').replace(/\/$/, '');

  if (!env.CLAUDE_API_KEY) {
    throw new Error('服务端未配置 CLAUDE_API_KEY');
  }

  const { system, user } = buildTranslationMessages(request.texts, request.contextTexts);
  const payload = {
    model: request.options.model || 'claude-3-5-sonnet-latest',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  };
  const response = await fetchImpl(`${endpoint}/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Claude API ${response.status}: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text ?? '[]';
  return {
    translations: parseTranslationResponse(rawText, request.texts.length),
    debug: {
      request: {
        endpoint: `${endpoint}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '[REDACTED]',
          'anthropic-version': '2023-06-01',
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
