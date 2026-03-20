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

function getStageLabel(step: 'upload' | 'config' | 'translating' | 'done') {
  switch (step) {
    case 'upload':
      return '上传字幕';
    case 'config':
      return '配置翻译';
    case 'translating':
      return '执行翻译';
    case 'done':
      return '校对与导出';
    default:
      return '准备中';
  }
}

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

  const stageLabel = getStageLabel(state.step);
  const completionRate =
    state.display.length === 0 ? 0 : Math.round((doneCount / state.display.length) * 100);

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div className="workspace-hero">
          <p className="eyebrow">SRT Translate Workspace</p>
          <h1>字幕翻译工作台</h1>
          <p className="lead">
            上传字幕、切换引擎、批量翻译并集中校对，在一个桌面工作区内完成整个流程。
          </p>
        </div>
        <div className="workspace-overview" aria-label="工作区概览">
          <div className="overview-card">
            <span className="overview-label">当前文件</span>
            <strong>{state.fileName}</strong>
            <span className="overview-meta">{state.entries.length} 条字幕</span>
          </div>
          <div className="overview-card">
            <span className="overview-label">工作阶段</span>
            <strong>{stageLabel}</strong>
            <span className="overview-meta">
              {state.step === 'translating' ? `当前进度 ${state.progress}%` : '可随时调整配置'}
            </span>
          </div>
          <div className="overview-card">
            <span className="overview-label">总条目</span>
            <strong>{state.display.length}</strong>
            <span className="overview-meta">已完成 {doneCount} 条</span>
          </div>
          <div className="overview-card accent">
            <span className="overview-label">完成率</span>
            <strong>{completionRate}%</strong>
            <span className="overview-meta">失败 {errorCount} 条</span>
          </div>
        </div>
      </header>

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
    </main>
  );
}
