import { useMemo, useReducer } from 'react';
import { serializeSrt } from '../../lib/subtitle/srt';
import { ProviderPanel } from './components/ProviderPanel';
import { ResultToolbar } from './components/ResultToolbar';
import { SubtitleList } from './components/SubtitleList';
import { TranslationPanel } from './components/TranslationPanel';
import { UploadScreen } from './components/UploadScreen';
import { useFileImport } from './hooks/useFileImport';
import { useTranslationController } from './hooks/useTranslationController';
import { createInitialState, subtitleTranslatorReducer } from './state/reducer';

export default function SubtitleTranslatorPage() {
  const [state, dispatch] = useReducer(
    subtitleTranslatorReducer,
    undefined,
    createInitialState,
  );
  const { importFile } = useFileImport(dispatch);
  const translationController = useTranslationController(state, dispatch);

  const doneCount = state.display.filter((entry) => entry.status === 'done').length;
  const errorCount = state.display.filter((entry) => entry.status === 'error').length;
  const busy = state.step === 'translating' || state.isRetrying || state.retryingIndex !== null;

  const filteredEntries = useMemo(
    () =>
      state.display
        .map((entry, index) => ({ ...entry, _index: index }))
        .filter((entry) => {
          if (state.filter === 'error') {
            return entry.status === 'error' || entry.status === 'retrying';
          }

          if (state.filter === 'done') {
            return entry.status === 'done';
          }

          return true;
        }),
    [state.display, state.filter],
  );

  function downloadResult() {
    const blob = new Blob([`\ufeff${serializeSrt(state.display)}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.fileName.replace(/\.[^.]+$/, '.zh.srt');
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetTranslation() {
    dispatch({ type: 'setStep', step: 'config' });
    dispatch({ type: 'setDisplay', display: state.entries });
    dispatch({ type: 'setError', error: null });
    dispatch({ type: 'setFilter', filter: 'all' });
  }

  if (state.step === 'upload') {
    return <UploadScreen error={state.error} onFileSelected={importFile} />;
  }

  return (
    <div className="app-shell">
      <ProviderPanel
        state={state}
        dispatch={dispatch}
        onStart={translationController.startTranslation}
        onCancelTranslation={translationController.cancelTranslation}
        onReset={() => dispatch({ type: 'reset' })}
      />

      <TranslationPanel
        title={
          state.step === 'translating'
            ? '翻译进行中'
            : state.step === 'done'
              ? '翻译结果'
              : '字幕预览'
        }
        summary={`${doneCount} / ${state.display.length} 条已完成`}
      >
        <ResultToolbar
          state={state}
          doneCount={doneCount}
          errorCount={errorCount}
          onFilterChange={(filter) => dispatch({ type: 'setFilter', filter })}
          onDownload={downloadResult}
          onRetryAllFailed={translationController.retryAllFailed}
          onCancelRetry={translationController.cancelRetry}
          onResetTranslation={resetTranslation}
        />

        {state.error ? <p className="error-banner">{state.error}</p> : null}

        <SubtitleList
          entries={filteredEntries}
          canRetry={state.step === 'done' && !busy}
          onRetrySingle={translationController.retrySingle}
        />
      </TranslationPanel>
    </div>
  );
}
