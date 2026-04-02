import type { ProviderTarget } from './target-selection';

export type WorkflowStageType = 'translate' | 'judge' | 'review';
export type WorkflowExecutionMode = 'serial' | 'parallel';

export interface WorkflowTemplateNode {
  id: string;
  label: string;
  type: WorkflowStageType;
  enabled: boolean;
  prompt: string;
  target: ProviderTarget | null;
}

export interface WorkflowTemplateStage {
  id: string;
  name: string;
  type: WorkflowStageType;
  execution: WorkflowExecutionMode;
  strategy: string;
  nodes: WorkflowTemplateNode[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  scenario: string;
  stages: WorkflowTemplateStage[];
}

export interface WorkflowTemplateStateData {
  version: 1;
  templates: WorkflowTemplate[];
}

export function cloneWorkflowTemplate(template: WorkflowTemplate): WorkflowTemplate {
  return {
    ...template,
    stages: template.stages.map((stage) => ({
      ...stage,
      nodes: stage.nodes.map((node) => ({
        ...node,
        target: node.target ? { ...node.target } : null,
      })),
    })),
  };
}
