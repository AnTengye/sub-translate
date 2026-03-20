import type { ProviderId } from '../types';

export async function translateViaProxy(
  provider: ProviderId,
  texts: string[],
  contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  const response = await fetch(`/api/translate/${provider}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts,
      contextTexts,
      options: config,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `代理请求失败 ${response.status}`);
  }

  if (!Array.isArray(data.translations)) {
    throw new Error('代理返回格式无效');
  }

  return data.translations.map(String);
}
