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

function parseTranslationResponse(text, count) {
  try {
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, count).map(String);
    }
  } catch {
    // fall through to tolerant parsing
  }

  const embeddedArrayMatch = text.match(/\[[\s\S]*\]/);
  if (embeddedArrayMatch) {
    try {
      const parsed = JSON.parse(embeddedArrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map(String);
      }
    } catch {
      // keep falling back
    }
  }

  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\d+[.。、:：]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length >= count) {
    return lines.slice(0, count);
  }

  return Array(count).fill('[翻译失败]');
}

export async function translateWithOpenAiCompatible(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const endpoint = (env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1').replace(/\/$/, '');

  if (!env.OPENAI_API_KEY) {
    throw new Error('服务端未配置 OPENAI_API_KEY');
  }

  const { system, user } = buildTranslationMessages(request.texts, request.contextTexts);
  const payload = {
    model: request.options.model || 'gpt-4o-mini',
    temperature: Number.parseFloat(String(request.options.temperature ?? 0.3)) || 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  const response = await fetchImpl(`${endpoint}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
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
