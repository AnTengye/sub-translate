import { buildTranslationMessages } from '../messages';
import { parseTranslationResponse } from '../response';

export async function translateWithClaude(
  texts: string[],
  contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  if (!config.apiKey) {
    throw new Error('请填写 Claude API Key');
  }

  const { system, user } = buildTranslationMessages(texts, contextTexts);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-sonnet-latest',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Claude API ${response.status}: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return parseTranslationResponse(data.content[0].text, texts.length);
}
