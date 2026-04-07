import type { ProviderTargetOption } from '../target-selection';
import type { WorkflowRunStatus } from '../types';
import type { WorkflowTemplate, WorkflowTemplateStateData } from '../workflow-types';
import { WorkflowStageCard } from './WorkflowStageCard';

interface WorkflowTemplatePanelProps {
  workflowTemplates: WorkflowTemplateStateData;
  activeTemplateId: string | null;
  workflowDraft: WorkflowTemplate | null;
  providerOptions: ProviderTargetOption[];
  batchSize: number;
  contextLines: number;
  temperature: number;
  busy: boolean;
  runStatus: WorkflowRunStatus;
  canResume: boolean;
  onTemplateChange: (templateId: string) => void;
  onBatchSizeChange: (value: number) => void;
  onContextLinesChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
  onNodeTargetChange: (stageId: string, nodeId: string, value: string) => void;
  onSave: () => void | Promise<void>;
  onStart: () => void | Promise<void>;
  onPause: () => void;
  onResume: () => void | Promise<void>;
  onCancel: () => void;
  onExport: () => void;
}

export function WorkflowTemplatePanel({
  workflowTemplates,
  activeTemplateId,
  workflowDraft,
  providerOptions,
  batchSize,
  contextLines,
  temperature,
  busy,
  runStatus,
  canResume,
  onTemplateChange,
  onBatchSizeChange,
  onContextLinesChange,
  onTemperatureChange,
  onNodeTargetChange,
  onSave,
  onStart,
  onPause,
  onResume,
  onCancel,
  onExport,
}: WorkflowTemplatePanelProps) {
  return (
    <aside className="sidebar" aria-label="工作流配置">
      <section className="sidebar-card workflow-card">
        <div className="sidebar-label">工作流模板</div>
        <label className="workflow-field">
          <span>模板</span>
          <select
            aria-label="工作流模板"
            className="workflow-select"
            value={activeTemplateId ?? ''}
            disabled={busy}
            onChange={(event) => onTemplateChange(event.target.value)}
          >
            {workflowTemplates.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        {workflowDraft ? <p className="workflow-template-description">{workflowDraft.description}</p> : null}
      </section>

      <section className="sidebar-card workflow-card">
        <div className="sidebar-label">运行参数</div>
        <label className="workflow-field">
          <span>批大小</span>
          <input
            aria-label="每批字幕数量"
            className="workflow-input"
            type="number"
            min="1"
            max="50"
            value={batchSize}
            disabled={busy}
            onChange={(event) => onBatchSizeChange(Number(event.target.value))}
          />
        </label>
        <label className="workflow-field">
          <span>上下文</span>
          <input
            aria-label="上下文条数"
            className="workflow-input"
            type="number"
            min="0"
            max="10"
            value={contextLines}
            disabled={busy}
            onChange={(event) => onContextLinesChange(Number(event.target.value))}
          />
        </label>
        <label className="workflow-field">
          <span>温度</span>
          <input
            aria-label="温度"
            className="workflow-input"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            disabled={busy}
            onChange={(event) => onTemperatureChange(Number(event.target.value))}
          />
        </label>
      </section>

      {workflowDraft?.stages.map((stage) => (
        <WorkflowStageCard
          key={stage.id}
          stage={stage}
          providerOptions={providerOptions}
          onNodeTargetChange={onNodeTargetChange}
        />
      ))}

      <button className="provider-btn workflow-save-btn" type="button" disabled={busy} onClick={() => void onSave()}>
        保存工作流模板
      </button>
      <button className="provider-btn workflow-save-btn" type="button" disabled={!workflowDraft} onClick={onExport}>
        导出工作流
      </button>
      {busy ? (
        <>
          <button className="provider-btn workflow-save-btn" type="button" onClick={onPause}>
            暂停工作流
          </button>
          <button className="start-btn" type="button" onClick={onCancel}>
            终止工作流
          </button>
        </>
      ) : (
        <>
          {canResume && runStatus !== 'completed' ? (
            <button className="provider-btn workflow-save-btn" type="button" onClick={() => void onResume()}>
              继续工作流
            </button>
          ) : null}
          <button className="start-btn" type="button" disabled={!workflowDraft} onClick={() => void onStart()}>
            开始工作流
          </button>
        </>
      )}
    </aside>
  );
}
