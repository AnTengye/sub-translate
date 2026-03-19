import { buildTranslationMessages } from '../messages';
import { parseTranslationResponse } from '../response';

export async function translateWithOpenAiCompatible(
  texts: string[],
  contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  const endpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  const { system, user } = buildTranslationMessages(texts, contextTexts);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      temperature: Number.parseFloat(config.temperature || '0.3') || 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API ${response.status}: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return parseTranslationResponse(data.choices[0].message.content, texts.length);
}
