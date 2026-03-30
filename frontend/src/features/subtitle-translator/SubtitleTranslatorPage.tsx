import { useEffect, useMemo, useReducer, useState } from 'react';
import { useToast } from '../../components/ui/feedback/useToast';
import { createAppProviderRuntimeSeeds } from '../../lib/config/env';
import { serializeSrt } from '../../lib/subtitle/srt';
import { ProviderCenter } from './components/ProviderCenter';
import { ActivityConsole } from './components/ActivityConsole';
import { ProviderPanel } from './components/ProviderPanel';
import { ResultToolbar } from './components/ResultToolbar';
import { SubtitleList } from './components/SubtitleList';
import { TranslationPanel } from './components/TranslationPanel';
import { UploadScreen } from './components/UploadScreen';
import {
  checkProviderProfile,
  fetchProviderProfileModelCatalog,
  fetchProviderCenterState,
  saveProviderCenterState,
  type ProviderCenterProfile,
} from './provider-center-api';
import { createDefaultProviderProfiles } from './config-storage';
import { useFileImport } from './hooks/useFileImport';
import { useTranslationController } from './hooks/useTranslationController';
import { createInitialState, subtitleTranslatorReducer } from './state/reducer';

export default function SubtitleTranslatorPage() {
  const [isAdvancedConfigOpen, setIsAdvancedConfigOpen] = useState(false);
  const [state, dispatch] = useReducer(
    subtitleTranslatorReducer,
    undefined,
    createInitialState,
  );
  const toast = useToast();
  const { importFile } = useFileImport(dispatch);
  const translationController = useTranslationController(state, dispatch);

  useEffect(() => {
    let active = true;
    fetchProviderCenterState()
      .then((providerCenter) => {
        if (!active) {
          return;
        }

        dispatch({ type: 'hydrateProviderCenter', providerCenter });
        const providerProfiles = createDefaultProviderProfiles(createAppProviderRuntimeSeeds());
        dispatch({ type: 'replaceProviderProfiles', providerProfiles });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        const providerProfiles = createDefaultProviderProfiles(createAppProviderRuntimeSeeds());
        dispatch({ type: 'replaceProviderProfiles', providerProfiles });
      });

    return () => {
      active = false;
    };
  }, []);

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

  async function handleSaveProviderCenter(nextProviderCenter: Parameters<typeof saveProviderCenterState>[0]) {
    const saved = await saveProviderCenterState(nextProviderCenter);
    dispatch({ type: 'hydrateProviderCenter', providerCenter: saved });
    setIsAdvancedConfigOpen(false);
    toast.success('已保存，将用于后续新任务');
  }

  async function handleCheckProviderProfile(
    family: 'openai-compatible' | 'claude-compatible' | 'baidu',
    profileId: string,
    profile: ProviderCenterProfile,
  ) {
    const result = await checkProviderProfile(family, profileId, profile);
    return result.profile as ProviderCenterProfile;
  }

  async function handleLoadProviderModels(
    family: 'openai-compatible' | 'claude-compatible' | 'baidu',
    profileId: string,
    profile: ProviderCenterProfile,
  ) {
    return fetchProviderProfileModelCatalog(family, profileId, profile);
  }

  if (state.step === 'upload') {
    return <UploadScreen error={state.error} onFileSelected={importFile} />;
  }

  const completionRate =
    state.display.length === 0 ? 0 : Math.round((doneCount / state.display.length) * 100);
  const activeProgress = state.step === 'translating' ? state.progress : completionRate;

  return (
    <main className="workspace-shell">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">
            Sub<span>Lingo</span>
          </span>
        </div>

        <div className="file-badge" aria-label="工作区概览">
          <strong>{state.fileName}</strong>
          <div className="dot" />
          <span>字幕总数</span>
          <strong>{state.display.length}</strong>
        </div>

        <div className="header-actions">
          <button
            className="provider-btn"
            type="button"
            aria-label="重新上传"
            onClick={() => dispatch({ type: 'reset' })}
          >
            重新上传
          </button>
          <button
            className="provider-btn"
            type="button"
            aria-label="打开 Provider Center"
            onClick={() => setIsAdvancedConfigOpen(true)}
          >
            Provider 中心
          </button>
        </div>
      </header>

      <div className="progress-strip workspace-progress-strip">
        <div className="progress-fill" style={{ width: `${activeProgress}%` }} />
      </div>

      <div className="main">
        <ProviderPanel state={state} dispatch={dispatch} onStart={translationController.startTranslation} />

        <TranslationPanel
          metrics={[
            { label: '已完成', value: String(doneCount), tone: 'success' },
            {
              label: '待处理',
              value: String(state.display.length - doneCount - errorCount),
              tone: 'neutral',
            },
            {
              label: '失败',
              value: String(errorCount),
              tone: errorCount > 0 ? 'danger' : 'neutral',
            },
            { label: '筛选结果', value: String(filteredEntries.length), tone: 'neutral' },
          ]}
          toolbar={
            <ResultToolbar
              state={state}
              doneCount={doneCount}
              errorCount={errorCount}
              onFilterChange={(filter) => dispatch({ type: 'setFilter', filter })}
              onCancelTranslation={translationController.cancelTranslation}
              onDownload={downloadResult}
              onRetryAllFailed={translationController.retryAllFailed}
              onCancelRetry={translationController.cancelRetry}
              onResetTranslation={resetTranslation}
            />
          }
          activity={<ActivityConsole logs={state.logs} />}
        >
          {state.error ? <p className="error-banner">{state.error}</p> : null}

          <SubtitleList
            entries={filteredEntries}
            canRetry={state.step === 'done' && !busy}
            onRetrySingle={translationController.retrySingle}
          />
        </TranslationPanel>
      </div>

      <ProviderCenter
        isOpen={isAdvancedConfigOpen}
        providerCenter={state.providerCenter}
        initialProvider={state.primaryTarget?.family ?? state.providerCenter?.defaultProvider ?? 'openai-compatible'}
        disableSave={busy}
        onClose={() => setIsAdvancedConfigOpen(false)}
        onSave={handleSaveProviderCenter}
        onCheck={handleCheckProviderProfile}
        onLoadModelCatalog={handleLoadProviderModels}
      />
    </main>
  );
}
