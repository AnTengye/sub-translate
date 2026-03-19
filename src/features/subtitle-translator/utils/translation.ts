import type { SubtitleEntry } from '../../../lib/subtitle/types';

type DispatchTranslate = (texts: string[], contextTexts: string[]) => Promise<string[]>;

interface SharedOptions {
  batchSize: number;
  contextLines: number;
  dispatchTranslate: DispatchTranslate;
  onLog: (message: string) => void;
  signal?: AbortSignal;
  delayMs?: number;
}

interface RunTranslationOptions extends SharedOptions {
  onUpdate: (entries: SubtitleEntry[], progress: number | null) => void;
}

interface RunRetryOptions extends SharedOptions {
  onUpdate: (entries: SubtitleEntry[], progress: number | null) => void;
}

function getContextBefore(entries: SubtitleEntry[], beforeIndex: number, count: number) {
  if (count <= 0) {
    return [];
  }

  const context: string[] = [];
  for (let index = beforeIndex - 1; index >= 0 && context.length < count; index -= 1) {
    const entry = entries[index];
    if (entry?.status === 'done' && entry.translated) {
      context.unshift(entry.translated);
    }
  }

  return context;
}

async function maybeDelay(delayMs: number) {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('cancelled');
  }
}

export async function runTranslation(
  entries: SubtitleEntry[],
  options: RunTranslationOptions,
): Promise<SubtitleEntry[]> {
  const results = entries.map((entry) => ({ ...entry }));
  const total = entries.length;

  for (let start = 0; start < total; start += options.batchSize) {
    ensureNotAborted(options.signal);

    const end = Math.min(start + options.batchSize, total);
    const batch = entries.slice(start, end);
    const context = getContextBefore(results, start, options.contextLines);
    options.onLog(`📝 翻译 ${start + 1}–${end} / ${total}`);

    try {
      const translated = await options.dispatchTranslate(
        batch.map((entry) => entry.text),
        context,
      );

      for (let index = 0; index < batch.length; index += 1) {
        const text = translated[index];
        results[start + index] = {
          ...results[start + index],
          translated: text ?? '[翻译失败]',
          status: text && text !== '[翻译失败]' ? 'done' : 'error',
        };
      }
    } catch (error) {
      if ((error as Error).message === 'cancelled') {
        throw error;
      }

      options.onLog(`❌ 批次错误: ${(error as Error).message}`);
      for (let index = 0; index < batch.length; index += 1) {
        results[start + index] = {
          ...results[start + index],
          translated: '[翻译失败]',
          status: 'error',
        };
      }
    }

    options.onUpdate([...results], (end / total) * 100);
    if (end < total) {
      await maybeDelay(options.delayMs ?? 0);
    }
  }

  options.onLog(`✅ 翻译完成，共 ${total} 条`);
  return results;
}

export async function runRetry(
  failedIndices: number[],
  currentEntries: SubtitleEntry[],
  options: RunRetryOptions,
): Promise<SubtitleEntry[]> {
  const results = currentEntries.map((entry) => ({ ...entry }));
  const sortedIndices = [...failedIndices].sort((left, right) => left - right);
  const batches: number[][] = [];

  for (let index = 0; index < sortedIndices.length; index += options.batchSize) {
    batches.push(sortedIndices.slice(index, index + options.batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    ensureNotAborted(options.signal);

    const batch = batches[batchIndex];
    batch.forEach((entryIndex) => {
      results[entryIndex] = { ...results[entryIndex], status: 'retrying' };
    });
    options.onUpdate([...results], null);

    const context = getContextBefore(results, batch[0] ?? 0, options.contextLines);
    const texts = batch.map((entryIndex) => results[entryIndex].text);

    try {
      const translated = await options.dispatchTranslate(texts, context);
      batch.forEach((entryIndex, index) => {
        const text = translated[index];
        const success = Boolean(text) && text !== '[翻译失败]';
        results[entryIndex] = {
          ...results[entryIndex],
          translated: success ? text : results[entryIndex].translated,
          status: success ? 'done' : 'error',
        };
      });
    } catch (error) {
      if ((error as Error).message === 'cancelled') {
        throw error;
      }

      options.onLog(`❌ 批次重试失败: ${(error as Error).message}`);
      batch.forEach((entryIndex) => {
        results[entryIndex] = { ...results[entryIndex], status: 'error' };
      });
    }

    options.onUpdate([...results], null);
    if (batchIndex < batches.length - 1) {
      await maybeDelay(options.delayMs ?? 0);
    }
  }

  const successCount = sortedIndices.filter((index) => results[index].status === 'done').length;
  options.onLog(`✅ 重试完成：${successCount}/${sortedIndices.length} 成功`);
  return results;
}
