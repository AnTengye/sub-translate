import type { ReactNode } from 'react';

interface TranslationPanelProps {
  title: string;
  summary: string;
  children: ReactNode;
}

export function TranslationPanel({ title, summary, children }: TranslationPanelProps) {
  return (
    <section className="content-panel">
      <header className="content-header">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">{summary}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
