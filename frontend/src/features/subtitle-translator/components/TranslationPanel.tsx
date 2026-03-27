import type { ReactNode } from 'react';

interface TranslationPanelProps {
  title: string;
  summary: string;
  metrics: Array<{ label: string; value: string; tone: 'success' | 'danger' | 'neutral' }>;
  children: ReactNode;
}

export function TranslationPanel({ title, summary, metrics, children }: TranslationPanelProps) {
  return (
    <section className="content-panel">
      <header className="content-header">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">{summary}</p>
        </div>
        <div className="summary-strip" aria-label="结果摘要">
          {metrics.map((metric) => (
            <div key={metric.label} className={`summary-card tone-${metric.tone}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </header>
      {children}
    </section>
  );
}
