import type { SubtitleEntry } from '../../lib/subtitle/types';
import type { ProviderCenterStateData } from './provider-center-api';
import type { TranslationConfig, TranslationLogEntry, WorkflowRunStatus } from './types';
import type { WorkflowCandidateTrack, WorkflowExecutionSnapshot, WorkflowJudgeDecision } from './utils/workflow';
import type { WorkflowTemplate, WorkflowTemplateStateData } from './workflow-types';

export interface WorkflowRunExportPayload {
  version: 1;
  exportedAt: string;
  run: {
    fileName: string;
    sourceContent: string;
    entries: SubtitleEntry[];
    display: SubtitleEntry[];
    providerCenter: ProviderCenterStateData | null;
    workflowTemplates: WorkflowTemplateStateData;
    activeTemplateId: string | null;
    workflowDraft: WorkflowTemplate | null;
    translationConfig: TranslationConfig;
    logs: TranslationLogEntry[];
    progress: number;
    runStatus: WorkflowRunStatus;
    pausedSnapshot: WorkflowExecutionSnapshot | null;
    candidateTracks: WorkflowCandidateTrack[];
    judgeDecisions: WorkflowJudgeDecision[];
    selectedTrackByEntry: string[];
    fallbackTexts: string[];
  };
}

export function createWorkflowRunExport(payload: WorkflowRunExportPayload['run']): WorkflowRunExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    run: payload,
  };
}

export function parseWorkflowRunExport(raw: string): WorkflowRunExportPayload {
  const parsed = JSON.parse(raw) as WorkflowRunExportPayload;
  if (parsed.version !== 1 || !parsed.run || typeof parsed.run.fileName !== 'string') {
    throw new Error('工作流快照格式无效');
  }
  return parsed;
}

