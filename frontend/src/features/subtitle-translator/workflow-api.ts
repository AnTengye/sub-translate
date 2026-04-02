import type { WorkflowTemplateStateData } from './workflow-types';

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

function normalizeWorkflowState(input: WorkflowTemplateStateData): WorkflowTemplateStateData {
  return {
    version: 1,
    templates: Array.isArray(input.templates) ? input.templates : [],
  };
}

export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateStateData> {
  const response = await fetch('/api/workflow-templates');
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `加载工作流模板失败 ${response.status}`);
  }
  return normalizeWorkflowState(data as WorkflowTemplateStateData);
}

export async function saveWorkflowTemplates(
  state: WorkflowTemplateStateData,
): Promise<WorkflowTemplateStateData> {
  const response = await fetch('/api/workflow-templates', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `保存工作流模板失败 ${response.status}`);
  }
  return normalizeWorkflowState(data as WorkflowTemplateStateData);
}
