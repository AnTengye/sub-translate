import type { ProviderTargetOption } from '../target-selection';
import type { WorkflowNodeModelCheckState } from '../types';
import type { WorkflowTemplateStage } from '../workflow-types';

interface WorkflowStageCardProps {
  stage: WorkflowTemplateStage;
  providerOptions: ProviderTargetOption[];
  nodeCheckStates: Record<string, WorkflowNodeModelCheckState>;
  onNodeTargetChange: (stageId: string, nodeId: string, value: string) => void;
}

function stringifyTargetValue(
  target: { family: string; profileId: string; modelId: string } | null,
) {
  if (!target) {
    return '';
  }

  return `${target.family}::${target.profileId}::${target.modelId}`;
}

function getNodeCheckBadge(checkState?: WorkflowNodeModelCheckState) {
  if (!checkState) {
    return { className: 'idle', label: '未检测', title: '尚未检测该节点模型是否可用' };
  }

  switch (checkState.status) {
    case 'checking':
      return { className: 'checking', label: '检测中', title: checkState.summary };
    case 'available':
      return { className: 'available', label: '可用', title: checkState.summary };
    case 'unavailable':
      return { className: 'unavailable', label: '不可用', title: checkState.error ?? checkState.summary };
    default:
      return { className: 'error', label: '检测失败', title: checkState.error ?? checkState.summary };
  }
}

export function WorkflowStageCard({
  stage,
  providerOptions,
  nodeCheckStates,
  onNodeTargetChange,
}: WorkflowStageCardProps) {
  return (
    <section className="workflow-stage-card">
      <div className="workflow-stage-header">
        <div>
          <div className="workflow-stage-name">{stage.name}</div>
          <div className="workflow-stage-meta">
            {stage.execution} · {stage.strategy}
          </div>
        </div>
      </div>

      <div className="workflow-node-list">
        {stage.nodes.map((node) => {
          const checkState = nodeCheckStates[`${stage.id}::${node.id}`];
          const badge = getNodeCheckBadge(checkState);
          return (
          <label key={node.id} className="workflow-node-card">
            <span className="workflow-node-label">
              {node.label}
              <span
                className={`workflow-node-badge workflow-node-badge-${badge.className}`}
                title={badge.title}
              >
                {badge.label}
              </span>
            </span>
            <select
              aria-label={`${node.label} 模型`}
              className="workflow-select"
              value={stringifyTargetValue(node.target)}
              onChange={(event) => onNodeTargetChange(stage.id, node.id, event.target.value)}
            >
              <option value="">选择模型</option>
              {providerOptions.map((option) => (
                <option
                  key={`${option.family}-${option.profileId}-${option.modelId}`}
                  value={`${option.family}::${option.profileId}::${option.modelId}`}
                >
                  {option.profileName} / {option.modelId}
                </option>
              ))}
            </select>
          </label>
        )})}
      </div>
    </section>
  );
}
