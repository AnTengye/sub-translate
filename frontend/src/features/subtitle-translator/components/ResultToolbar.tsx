import type { SubtitleFilter, SubtitleTranslatorState } from '../types';

interface ResultToolbarProps {
  state: SubtitleTranslatorState;
  doneCount: number;
  errorCount: number;
  onFilterChange: (filter: SubtitleFilter) => void;
  onDownload: () => void;
  onRetryAllFailed: () => void | Promise<void>;
  onCancelRetry: () => void;
  onResetTranslation: () => void;
  onCancelTranslation: () => void;
}

export function ResultToolbar({
  state,
  doneCount,
  errorCount,
  onFilterChange,
  onDownload,
  onRetryAllFailed,
  onCancelRetry,
  onResetTranslation,
  onCancelTranslation,
}: ResultToolbarProps) {
  return (
    <div className="list-header" style={{ marginBottom: '14px' }}>
      <div className="section-title">
        字幕预览
        <span className="count-badge">{state.display.length}</span>
      </div>
      <div className="list-header-actions">
        <div className="filter-tabs">
          {(['all', 'error', 'done'] as const).map((filter) => (
            <button
              key={filter}
              className={`tab${state.filter === filter ? ' active' : ''}`}
              type="button"
              onClick={() => onFilterChange(filter)}
            >
              {filter === 'all' ? `全部 ${state.display.length}` : null}
              {filter === 'error' ? `失败 ${errorCount}` : null}
              {filter === 'done' ? `成功 ${doneCount}` : null}
            </button>
          ))}
        </div>

        <div className="bulk-actions">
          {state.step === 'translating' ? (
            <button className="bulk-btn" type="button" onClick={onCancelTranslation}>
              取消翻译
            </button>
          ) : null}
          {state.isRetrying ? (
            <button className="bulk-btn" type="button" onClick={onCancelRetry}>
              取消重试
            </button>
          ) : null}
          {state.step === 'done' ? (
            <>
              {errorCount > 0 ? (
                <button className="bulk-btn" type="button" onClick={onRetryAllFailed}>
                  重试失败
                </button>
              ) : null}
              <button className="bulk-btn" type="button" onClick={onResetTranslation}>
                重新翻译
              </button>
              <button className="bulk-btn" type="button" onClick={onDownload}>
                下载结果
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
