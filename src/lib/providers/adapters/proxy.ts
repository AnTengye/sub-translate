import type {
  ProviderId,
  TranslationBatchMetadata,
  TranslationRunCreatePayload,
} from '../types';
import { normalizeTranslationItems } from '../response';

interface TranslationRunFinalizePayload {
  status: 'completed' | 'failed' | 'cancelled';
  summary?: Record<string, number>;
  error?: {
    message: string;
  };
}

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export async function createProxyTranslationRun(
  payload: TranslationRunCreatePayload,
  signal: AbortSignal,
): Promise<{ runId: string }> {
  const response = await fetch('/api/translation-runs', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `创建翻译日志失败 ${response.status}`);
  }

  if (typeof data.runId !== 'string' || data.runId === '') {
    throw new Error('翻译任务创建结果无效');
  }

  return {
    runId: data.runId,
  };
}

export async function finalizeProxyTranslationRun(
  runId: string,
  payload: TranslationRunFinalizePayload,
  signal: AbortSignal,
): Promise<{ runId: string }> {
  const response = await fetch(`/api/translation-runs/${runId}/finalize`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `结束翻译日志失败 ${response.status}`);
  }

  if (typeof data.runId !== 'string' || data.runId === '') {
    throw new Error('翻译任务结束结果无效');
  }

  return {
    runId: data.runId,
  };
}

export async function translateViaProxy(
  provider: ProviderId,
  texts: string[],
  contextTexts: string[],
  batch: TranslationBatchMetadata,
  runId: string,
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
      runId,
      texts,
      contextTexts,
      batch,
      options: config,
    }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || `代理请求失败 ${response.status}`);
  }

  if (!Array.isArray(data.translations)) {
    throw new Error('代理返回格式无效');
  }

  return normalizeTranslationItems(data.translations, texts.length);
}
