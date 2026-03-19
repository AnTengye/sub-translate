import { useEffect, useMemo, useRef } from 'react';
import { dispatchTranslate as dispatchTranslateWithProvider } from '../../../lib/providers/registry';
import type { SubtitleTranslatorAction } from '../state/reducer';
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

  const providerRuntimeConfig = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.entries(state.providerConfig).filter(([, value]) => value !== ''),
      ),
      temperature: String(state.translationConfig.temperature),
    }),
    [state.providerConfig, state.translationConfig.temperature],
  );

  function appendLog(message: string) {
    dispatch({
      type: 'appendLog',
      log: buildLogEntry(message),
    });
  }

  async function startTranslation() {
    dispatch({ type: 'startTranslation' });
    translationAbortRef.current = new AbortController();

    try {
      const display = await runTranslation(state.entries, {
        batchSize: state.translationConfig.batchSize,
        contextLines: state.translationConfig.contextLines,
        delayMs: 150,
        signal: translationAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts) =>
          dispatchTranslateWithProvider(
            state.provider,
            texts,
            contextTexts,
            providerRuntimeConfig,
            translationAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries, progress) => {
          dispatch({
            type: 'translationProgress',
            display: entries,
            progress: progress ?? state.progress,
          });
        },
        onLog: appendLog,
      });

      dispatch({ type: 'translationDone', display });
    } catch (error) {
      if (isCancellationError(error)) {
        appendLog('⚠️ 已取消');
        dispatch({ type: 'setStep', step: 'config' });
        dispatch({ type: 'setError', error: null });
        return;
      }

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

    try {
      const display = await runRetry(failedIndices, state.display, {
        batchSize: state.translationConfig.batchSize,
        contextLines: state.translationConfig.contextLines,
        delayMs: 150,
        signal: retryAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts) =>
          dispatchTranslateWithProvider(
            state.provider,
            texts,
            contextTexts,
            providerRuntimeConfig,
            retryAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries) => {
          dispatch({ type: 'setDisplay', display: entries });
        },
        onLog: appendLog,
      });

      dispatch({ type: 'finishRetryAll', display });
    } catch (error) {
      if (isCancellationError(error)) {
        appendLog('⚠️ 重试已取消');
      } else {
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

    try {
      const display = await runRetry([index], state.display, {
        batchSize: 1,
        contextLines: state.translationConfig.contextLines,
        signal: retryAbortRef.current.signal,
        dispatchTranslate: (texts, contextTexts) =>
          dispatchTranslateWithProvider(
            state.provider,
            texts,
            contextTexts,
            providerRuntimeConfig,
            retryAbortRef.current?.signal ?? new AbortController().signal,
          ),
        onUpdate: (entries) => {
          dispatch({ type: 'setDisplay', display: entries });
        },
        onLog: appendLog,
      });

      dispatch({ type: 'finishRetrySingle', display, index: null });
    } catch (error) {
      if (isCancellationError(error)) {
        appendLog(`⚠️ 第 ${index + 1} 条取消`);
      } else {
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
