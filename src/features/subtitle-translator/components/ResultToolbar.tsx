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
}: ResultToolbarProps) {
  return (
    <div className="toolbar">
      <div className="filter-row">
        {(['all', 'error', 'done'] as const).map((filter) => (
          <button
            key={filter}
            className={`filter-button${state.filter === filter ? ' active' : ''}`}
            type="button"
            onClick={() => onFilterChange(filter)}
          >
            {filter === 'all' ? `全部 ${state.display.length}` : null}
            {filter === 'error' ? `失败 ${errorCount}` : null}
            {filter === 'done' ? `成功 ${doneCount}` : null}
          </button>
        ))}
      </div>

      <div className="button-row">
        {state.step === 'done' ? (
          <>
            <button className="primary-button" type="button" onClick={onDownload}>
              下载中文字幕
            </button>
            {errorCount > 0 ? (
              <button className="secondary-button" type="button" onClick={onRetryAllFailed}>
                重试全部失败条目
              </button>
            ) : null}
            <button className="ghost-button" type="button" onClick={onResetTranslation}>
              重新翻译全部
            </button>
          </>
        ) : null}

        {state.isRetrying ? (
          <button className="secondary-button" type="button" onClick={onCancelRetry}>
            取消重试
          </button>
        ) : null}
      </div>
    </div>
  );
}
