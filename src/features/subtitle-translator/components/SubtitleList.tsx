import type { SubtitleEntry } from '../../../lib/subtitle/types';

interface SubtitleListProps {
  entries: Array<SubtitleEntry & { _index: number }>;
  canRetry: boolean;
  onRetrySingle: (index: number) => void | Promise<void>;
}

export function SubtitleList({ entries, canRetry, onRetrySingle }: SubtitleListProps) {
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

  if (entries.length === 0) {
    return <div className="empty-state">当前筛选条件下没有条目。</div>;
  }

  return (
    <div className="subtitle-list">
      {entries.map((entry) => (
        <article key={`${entry.idx}-${entry.timecode}`} className={`subtitle-card status-${entry.status}`}>
          <div className="subtitle-topline">
            <span className="chip chip-index">#{entry.idx}</span>
            <span className="timecode">{entry.timecode}</span>
            <span className={`chip chip-status status-pill-${entry.status}`}>
              {getStatusLabel(entry.status)}
            </span>
          </div>
          <div className="subtitle-columns">
            <div className="subtitle-column">
              <h3>原文</h3>
              <p>{entry.text}</p>
            </div>
            <div className="subtitle-column subtitle-column-translation">
              <h3>译文</h3>
              <p>
                {entry.status === 'retrying'
                  ? '重试中…'
                  : entry.translated || (entry.status === 'error' ? '翻译失败' : '待翻译')}
              </p>
            </div>
          </div>
          {entry.status === 'error' && canRetry ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => onRetrySingle(entry._index)}
            >
              重试该条
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
