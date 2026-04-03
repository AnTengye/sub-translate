import { useRef, useEffect, useCallback } from 'react';
import type { TranslationLogEntry } from '../types';

interface ActivityConsoleProps {
  logs: TranslationLogEntry[];
}

function getMessageTone(message: string) {
  if (message.includes('❌') || message.includes('错误') || message.includes('出错')) {
    return 'warn';
  }

  if (message.includes('成功') || message.includes('完成') || message.includes('✅')) {
    return 'ok';
  }

  if (message.includes('重试') || message.includes('等待') || message.includes('失败') || message.includes('⚠️')) {
    return 'warn';
  }

  return 'info';
}

export function ActivityConsole({ logs }: ActivityConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    // If user scrolled away from bottom, pause auto-scroll
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }, []);

  useEffect(() => {
    if (bodyRef.current && !userScrolledRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-panel">
      <div className="log-header">
        <div className="log-title">
          <div className="rec-dot" />
          实时运行日志 {logs.length > 0 ? `(${logs.length})` : ''}
        </div>
      </div>
      <div
        id="activity-console-body"
        ref={bodyRef}
        className="log-body"
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="log-line">
            <span className="log-time">--:--:--</span>
            <span className="log-msg info">已加载工作台，等待翻译任务启动</span>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={`${log.t}-${index}`} className="log-line">
              <span className="log-time">{log.t}</span>
              <span className={`log-msg ${getMessageTone(log.msg)}`}>{log.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
