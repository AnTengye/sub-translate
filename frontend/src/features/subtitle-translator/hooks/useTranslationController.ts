import { useEffect, useRef } from 'react';
import {
  createTranslationRun,
  dispatchTranslate as dispatchTranslateWithProvider,
  finalizeTranslationRun,
} from '../../../lib/providers/registry';
import type { SubtitleEntry } from '../../../lib/subtitle/types';
import type { SubtitleTranslatorAction } from '../state/reducer';
import { buildProviderRequestConfig, isSameTarget } from '../target-selection';
import type { SubtitleTranslatorState } from '../types';
import { runRetry, runTranslation } from '../utils/translation';

function isCancellationError(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'cancelled');
}

function buildLogEntry(message: string) {
  return {
    t: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    msg: message,
  };
}

function summarizeDisplay(entries: SubtitleEntry[], targetedEntries?: number) {
  return {
    totalEntries: entries.length,
    targetedEntries: targetedEntries ?? entries.length,
    translatedCount: entries.filter((entry) => entry.status === 'done').length,
    errorCount: entries.filter((entry) => entry.status === 'error').length,
  };
}

export function useTranslationController(
  state: SubtitleTranslatorState,
  dispatch: React.Dispatch<SubtitleTranslatorAction>,
) {
  const translationAbortRef = useRef<AbortController | null>(null);
  const retryAbortRef = useRef<AbortController | null>(null);
  const displayRef = useRef(state.display);

  useEffect(() => {
    displayRef.current = state.display;
  }, [state.display]);

  function appendLog(message: string) {
    dispatch({
      type: 'appendLog',
      log: buildLogEntry(message),
    });
  }

  async function createRun(mode: 'translate' | 'retry-all' | 'retry-single', signal: AbortSignal) {
    const primaryRequest = buildProviderRequestConfig(
      state.providerCenter,
      state.primaryTarget,
      state.translationConfig.temperature,
    );

    if (!primaryRequest) {
      throw new Error('主 Provider 未配置');
    }

    const run = await createTranslationRun(
      {
        fileName: state.fileName,
        provider: primaryRequest.provider,
        profileId: primaryRequest.profileId ?? undefined,
        totalEntries: state.entries.length,
        entries: state.entries.map((entry) => ({
          idx: entry.idx,
          timecode: entry.timecode,
          text: entry.text,
        })),
        providerConfig: primaryRequest.config,
        translationConfig: state.translationConfig,
        mode,
      },
      signal,
    );

    appendLog(`🧾 日志任务 ${run.runId}`);
    return run.runId;
  }

  async function finalizeRun(
    runId: string | null,
    status: 'completed' | 'failed' | 'cancelled',
    entries: SubtitleEntry[],
    targetedEntries?: number,
    error?: unknown,
  ) {
    if (!runId) {
      return;
    }

    try {
      await finalizeTranslationRun(
        runId,
        {
          status,
          summary: summarizeDisplay(entries, targetedEntries),
          error:
            status === 'failed'
              ? {
                  message: error instanceof Error ? error.message : '翻译失败',
                }
              : undefined,
        },
        new AbortController().signal,
      );
    } catch (finalizeError) {
      appendLog(
        `⚠️ 写入日志文件失败: ${finalizeError instanceof Error ? finalizeError.message : '未知错误'}`,
      );
    }
  }

  async function dispatchWithFallback(
    texts: string[],
    contextTexts: string[],
    batch: Parameters<Parameters<typeof runTranslation>[1]['dispatchTranslate']>[2],
    runId: string,
    signal: AbortSignal,
  ) {
    const primaryRequest = buildProviderRequestConfig(
      state.providerCenter,
      state.primaryTarget,
      state.translationConfig.temperature,
    );
    const fallbackRequest = buildProviderRequestConfig(
      state.providerCenter,
      state.fallbackTarget,
      state.translationConfig.temperature,
    );

    if (!primaryRequest) {
      throw new Error('主 Provider 未配置');
    }

    try {
      return await dispatchTranslateWithProvider(
        primaryRequest.provider,
        primaryRequest.profileId,
        texts,
        contextTexts,
        batch,
        runId,
        primaryRequest.config,
        primaryRequest.runtimeOverrides,
        signal,
      );
    } catch (error) {
      if (
        !fallbackRequest ||
        isSameTarget(state.primaryTarget, state.fallbackTarget) ||
        isCancellationError(error)
      ) {
        throw error;
      }

      appendLog(
        `⚠️ 主 Provider 失败，切换备选 ${fallbackRequest.profileId ?? fallbackRequest.provider}`,
      );

      return dispatchTranslateWithProvider(
        fallbackRequest.provider,
        fallbackRequest.profileId,
        texts,
        contextTexts,
        batch,
        runId,
        fallbackRequest.config,
        fallbackRequest.runtimeOverrides,
        signal,
      );
    }
  }

  async function startTranslation() {
    dispatch({ type: 'startTranslation' });
    translationAbortRef.current = new AbortController();
    let runId: string | null = null;
    let latestDisplay: SubtitleEntry[] = state.entries.map((entry) => ({
      ...entry,
      translated: null,
      status: 'pending' as const,
    }));

    try {
      runId = await createRun('translate', translationAbortRef.current.signal);
      const display = await runTranslation(state.entries, {
        runId,
        batchSize: state.translationConfig.batchSize,
        contextLines: state.translationConfig.contextLines,
        delayMs: 150,
        signal: translationAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts, batch, currentRunId) =>
          dispatchWithFallback(
            texts,
            contextTexts,
            batch,
            currentRunId,
            translationAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries, progress) => {
          latestDisplay = entries;
          dispatch({
            type: 'translationProgress',
            display: entries,
            progress: progress ?? state.progress,
          });
        },
        onLog: appendLog,
      });

      await finalizeRun(runId, 'completed', display);
      dispatch({ type: 'translationDone', display });
    } catch (error) {
      if (isCancellationError(error)) {
        await finalizeRun(runId, 'cancelled', latestDisplay);
        appendLog('⚠️ 已取消');
        dispatch({ type: 'setStep', step: 'config' });
        dispatch({ type: 'setError', error: null });
        return;
      }

      await finalizeRun(runId, 'failed', latestDisplay, undefined, error);
      dispatch({
        type: 'translationFailed',
        error: error instanceof Error ? error.message : '翻译失败',
      });
      appendLog(`❌ ${error instanceof Error ? error.message : '翻译失败'}`);
    } finally {
      translationAbortRef.current = null;
    }
  }

  async function retryAllFailed() {
    const failedIndices = state.display
      .map((entry, index) => (entry.status === 'error' ? index : -1))
      .filter((index) => index >= 0);

    if (failedIndices.length === 0) {
      return;
    }

    dispatch({ type: 'beginRetryAll' });
    appendLog(`♻️ 开始重试 ${failedIndices.length} 条失败字幕`);
    retryAbortRef.current = new AbortController();
    let runId: string | null = null;
    let latestDisplay = state.display.map((entry) => ({ ...entry }));

    try {
      runId = await createRun('retry-all', retryAbortRef.current.signal);
      const display = await runRetry(failedIndices, state.display, {
        runId,
        batchSize: state.translationConfig.batchSize,
        contextLines: state.translationConfig.contextLines,
        delayMs: 150,
        signal: retryAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts, batch, currentRunId) =>
          dispatchWithFallback(
            texts,
            contextTexts,
            batch,
            currentRunId,
            retryAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries) => {
          latestDisplay = entries;
          dispatch({ type: 'setDisplay', display: entries });
        },
        onLog: appendLog,
      });

      await finalizeRun(runId, 'completed', display, failedIndices.length);
      dispatch({ type: 'finishRetryAll', display });
    } catch (error) {
      if (isCancellationError(error)) {
        await finalizeRun(runId, 'cancelled', latestDisplay, failedIndices.length);
        appendLog('⚠️ 重试已取消');
      } else {
        await finalizeRun(runId, 'failed', latestDisplay, failedIndices.length, error);
        appendLog(`❌ 重试出错: ${error instanceof Error ? error.message : '重试失败'}`);
        dispatch({
          type: 'setError',
          error: error instanceof Error ? error.message : '重试失败',
        });
      }

      dispatch({ type: 'finishRetryAll', display: displayRef.current });
    } finally {
      retryAbortRef.current = null;
    }
  }

  async function retrySingle(index: number) {
    if (state.retryingIndex !== null || state.isRetrying) {
      return;
    }

    dispatch({ type: 'beginRetrySingle', index });
    retryAbortRef.current = new AbortController();
    let runId: string | null = null;
    let latestDisplay = state.display.map((entry) => ({ ...entry }));

    try {
      runId = await createRun('retry-single', retryAbortRef.current.signal);
      const display = await runRetry([index], state.display, {
        runId,
        batchSize: 1,
        contextLines: state.translationConfig.contextLines,
        signal: retryAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts, batch, currentRunId) =>
          dispatchWithFallback(
            texts,
            contextTexts,
            batch,
            currentRunId,
            retryAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries) => {
          latestDisplay = entries;
          dispatch({ type: 'setDisplay', display: entries });
        },
        onLog: appendLog,
      });

      await finalizeRun(runId, 'completed', display, 1);
      dispatch({ type: 'finishRetrySingle', display, index: null });
    } catch (error) {
      if (isCancellationError(error)) {
        await finalizeRun(runId, 'cancelled', latestDisplay, 1);
        appendLog(`⚠️ 第 ${index + 1} 条取消`);
      } else {
        await finalizeRun(runId, 'failed', latestDisplay, 1, error);
        appendLog(`❌ 第 ${index + 1} 条出错: ${error instanceof Error ? error.message : '重试失败'}`);
      }

      dispatch({ type: 'finishRetrySingle', display: displayRef.current, index: null });
    } finally {
      retryAbortRef.current = null;
    }
  }

  return {
    startTranslation,
    retryAllFailed,
    retrySingle,
    cancelTranslation: () => translationAbortRef.current?.abort(),
    cancelRetry: () => retryAbortRef.current?.abort(),
  };
}
