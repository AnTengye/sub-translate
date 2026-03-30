import type { SubtitleEntry } from '../../../lib/subtitle/types';

interface SubtitleListProps {
  entries: Array<SubtitleEntry & { _index: number }>;
  canRetry: boolean;
  onRetrySingle: (index: number) => void | Promise<void>;
}

function getStatusLabel(status: SubtitleEntry['status']) {
  switch (status) {
    case 'done':
      return '已完成';
    case 'error':
      return '失败';
    case 'retrying':
      return '重试中';
    default:
      return '待翻译';
  }
}

function getStatusClass(status: SubtitleEntry['status']) {
  switch (status) {
    case 'done':
      return 'done';
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

export function SubtitleList({ entries, canRetry, onRetrySingle }: SubtitleListProps) {
  if (entries.length === 0) {
    return <div className="empty-state">当前筛选条件下没有条目。</div>;
  }

  return (
    <div className="sub-list">
      {entries.map((entry) => (
        <div key={`${entry.idx}-${entry.timecode}`} className="sub-card">
          <div className="sub-card-header">
            <div className="sub-meta">
              <span className="sub-index">#{entry.idx}</span>
              <span className="sub-time">{entry.timecode}</span>
            </div>
            <div className="sub-header-actions">
              <span className={`sub-status ${getStatusClass(entry.status)}`}>{getStatusLabel(entry.status)}</span>
              {entry.status === 'error' && canRetry ? (
                <button className="bulk-btn sub-retry-btn" type="button" onClick={() => onRetrySingle(entry._index)}>
                  重试该条
                </button>
              ) : null}
            </div>
          </div>
          <div className="sub-body">
            <div className="sub-col">
              <div className="sub-col-label"><span className="flag">JA</span> 原文</div>
              <div className="sub-text">{entry.text}</div>
            </div>
            <div className="sub-col">
              <div className="sub-col-label"><span className="flag">ZH</span> 译文</div>
              {entry.status === 'pending' ? (
                <div>
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              ) : (
                <div
                  className={`sub-text ${
                    entry.status === 'done'
                      ? 'translated'
                      : entry.status === 'error'
                        ? 'waiting'
                        : 'waiting'
                  }`}
                >
                  {entry.status === 'retrying'
                    ? '重试中…'
                    : entry.translated || (entry.status === 'error' ? '翻译失败' : '待翻译…')}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
