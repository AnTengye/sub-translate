import type { TranslationLogEntry } from '../types';

interface ActivityConsoleProps {
  logs: TranslationLogEntry[];
}

function getMessageTone(message: string) {
  if (message.includes('成功') || message.includes('完成')) {
    return 'ok';
  }

  if (message.includes('重试') || message.includes('等待') || message.includes('失败')) {
    return 'warn';
  }

  return 'info';
}

export function ActivityConsole({ logs }: ActivityConsoleProps) {
  const visibleLogs = logs.slice(-3);

  return (
    <div className="log-panel">
      <div className="log-header">
        <div className="log-title">
          <div className="rec-dot" />
          实时运行日志
        </div>
        <span className="log-toggle">▾ 展开</span>
      </div>
      <div className="log-body">
        {visibleLogs.length === 0 ? (
          <div className="log-line">
            <span className="log-time">--:--:--</span>
            <span className="log-msg info">已加载工作台，等待翻译任务启动</span>
          </div>
        ) : (
          visibleLogs.map((log) => (
            <div key={`${log.t}-${log.msg}`} className="log-line">
              <span className="log-time">{log.t}</span>
              <span className={`log-msg ${getMessageTone(log.msg)}`}>{log.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
