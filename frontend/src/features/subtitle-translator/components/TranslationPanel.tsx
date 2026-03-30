import type { ReactNode } from 'react';

interface TranslationPanelProps {
  metrics: Array<{ label: string; value: string; tone: 'success' | 'danger' | 'neutral' }>;
  activity: ReactNode;
  toolbar: ReactNode;
  children: ReactNode;
}

function metricToneClass(tone: 'success' | 'danger' | 'neutral', label: string) {
  if (tone === 'success') return 'completed';
  if (tone === 'danger') return 'failed';
  if (label.includes('筛选')) return 'filtered';
  return 'pending';
}

function metricSubtext(label: string, value: string) {
  if (label === '已完成') return `已处理 ${value} 条`;
  if (label === '待处理') return '排队中';
  if (label === '失败') return value === '0' ? '暂无错误' : '等待处理';
  return '当前视图';
}

export function TranslationPanel({ metrics, activity, toolbar, children }: TranslationPanelProps) {
  return (
    <div className="content">
      {activity}

      <div className="stats-row" aria-label="结果摘要">
        {metrics.map((metric) => {
          const toneClass = metricToneClass(metric.tone, metric.label);
          return (
            <div key={metric.label} className={`stat-card ${toneClass}`}>
              <div className="stat-label">{metric.label}</div>
              <div className="stat-val">{metric.value}</div>
              <div className="stat-sub">{metricSubtext(metric.label, metric.value)}</div>
            </div>
          );
        })}
      </div>

      <div>
        {toolbar}
        {children}
      </div>
    </div>
  );
}
