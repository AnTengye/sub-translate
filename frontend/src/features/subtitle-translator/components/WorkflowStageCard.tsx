import type { ProviderTargetOption } from '../target-selection';
import type { WorkflowTemplateStage } from '../workflow-types';

interface WorkflowStageCardProps {
  stage: WorkflowTemplateStage;
  providerOptions: ProviderTargetOption[];
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

export function WorkflowStageCard({
  stage,
  providerOptions,
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
        {stage.nodes.map((node) => (
          <label key={node.id} className="workflow-node-card">
            <span className="workflow-node-label">{node.label}</span>
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
        ))}
      </div>
    </section>
  );
}
