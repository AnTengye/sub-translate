import { createAppProviderRuntimeSeeds } from '../../../lib/config/env';
import type { SubtitleEntry } from '../../../lib/subtitle/types';
import type {
  SubtitleFilter,
  SubtitleTranslatorState,
  TranslationConfig,
  TranslationLogEntry,
  WorkflowStep,
} from '../types';
import { loadProviderProfiles, type ProviderProfileStorageData } from '../config-storage';
import type { ProviderCenterStateData } from '../provider-center-api';
import { cloneWorkflowTemplate, type WorkflowTemplate, type WorkflowTemplateStateData } from '../workflow-types';
import {
  ensureDistinctTarget,
  getDefaultTargets,
  type ProviderTarget,
  buildProviderTargetOptions,
} from '../target-selection';

export type SubtitleTranslatorAction =
  | { type: 'reset' }
  | { type: 'fileLoaded'; fileName: string; rawContent: string; entries: SubtitleEntry[] }
  | { type: 'fileLoadFailed'; error: string }
  | { type: 'hydrateProviderCenter'; providerCenter: ProviderCenterStateData }
  | { type: 'hydrateWorkflowTemplates'; workflowTemplates: WorkflowTemplateStateData }
  | { type: 'selectWorkflowTemplate'; templateId: string }
  | { type: 'setWorkflowNodeTarget'; stageId: string; nodeId: string; target: ProviderTarget | null }
  | { type: 'replaceProviderProfiles'; providerProfiles: ProviderProfileStorageData }
  | { type: 'setPrimaryTarget'; target: ProviderTarget | null }
  | { type: 'setFallbackTarget'; target: ProviderTarget | null }
  | { type: 'updateTranslationConfig'; key: keyof TranslationConfig; value: number }
  | { type: 'toggleAdvancedParams'; open?: boolean }
  | { type: 'startTranslation'; preserveProgress?: boolean }
  | { type: 'translationProgress'; display: SubtitleEntry[]; progress: number }
  | { type: 'translationDone'; display: SubtitleEntry[] }
  | { type: 'translationFailed'; error: string }
  | { type: 'setLogs'; logs: TranslationLogEntry[] }
  | { type: 'appendLog'; log: TranslationLogEntry }
  | { type: 'setDisplay'; display: SubtitleEntry[] }
  | {
      type: 'restoreWorkflowRun';
      payload: {
        fileName: string;
        sourceContent: string;
        entries: SubtitleEntry[];
        display: SubtitleEntry[];
        providerCenter: ProviderCenterStateData | null;
        translationConfig: TranslationConfig;
        workflowTemplates: WorkflowTemplateStateData;
        activeTemplateId: string | null;
        workflowDraft: WorkflowTemplate | null;
        logs: TranslationLogEntry[];
        progress: number;
        runStatus: SubtitleTranslatorState['runStatus'];
        pausedSnapshot: SubtitleTranslatorState['pausedSnapshot'];
      };
    }
  | { type: 'setFilter'; filter: SubtitleFilter }
  | { type: 'setStep'; step: WorkflowStep }
  | { type: 'setRunStatus'; status: SubtitleTranslatorState['runStatus'] }
  | { type: 'setPausedSnapshot'; snapshot: SubtitleTranslatorState['pausedSnapshot'] }
  | { type: 'beginRetryAll' }
  | { type: 'finishRetryAll'; display: SubtitleEntry[] }
  | { type: 'beginRetrySingle'; index: number }
  | { type: 'finishRetrySingle'; display: SubtitleEntry[]; index: number | null }
  | { type: 'setError'; error: string | null };

function reconcileTargets(
  providerCenter: ProviderCenterStateData | null,
  primaryTarget: ProviderTarget | null,
  fallbackTarget: ProviderTarget | null,
) {
  const options = buildProviderTargetOptions(providerCenter);
  return ensureDistinctTarget(options, primaryTarget, fallbackTarget);
}

export function createInitialState(
  providerProfiles = loadProviderProfiles(createAppProviderRuntimeSeeds()),
): SubtitleTranslatorState {
  return {
    step: 'upload',
    fileName: '',
    sourceContent: '',
    entries: [],
    display: [],
    providerCenter: null,
    providerProfiles,
    workflowTemplates: {
      version: 1,
      templates: [],
    },
    activeTemplateId: null,
    workflowDraft: null,
    primaryTarget: null,
    fallbackTarget: null,
    translationConfig: {
      batchSize: 20,
      contextLines: 3,
      temperature: 0.3,
    },
    advancedParamsOpen: false,
    progress: 0,
    logs: [],
    runStatus: 'idle',
    pausedSnapshot: null,
    filter: 'all',
    error: null,
    isRetrying: false,
    retryingIndex: null,
  };
}

export function subtitleTranslatorReducer(
  state: SubtitleTranslatorState,
  action: SubtitleTranslatorAction,
): SubtitleTranslatorState {
  switch (action.type) {
    case 'reset':
      return createInitialState();
    case 'fileLoaded':
      return {
        ...state,
        step: 'config',
        fileName: action.fileName,
        sourceContent: action.rawContent,
        entries: action.entries,
        display: action.entries,
        progress: 0,
        logs: [],
        runStatus: 'idle',
        pausedSnapshot: null,
        error: null,
        filter: 'all',
        isRetrying: false,
        retryingIndex: null,
      };
    case 'fileLoadFailed':
      return {
        ...state,
        error: action.error,
      };
    case 'hydrateProviderCenter': {
      const defaults = getDefaultTargets(action.providerCenter);
      const targets = reconcileTargets(
        action.providerCenter,
        state.primaryTarget ?? defaults.primaryTarget,
        state.fallbackTarget ?? defaults.fallbackTarget,
      );

      return {
        ...state,
        providerCenter: action.providerCenter,
        primaryTarget: targets.primaryTarget,
        fallbackTarget: targets.fallbackTarget,
      };
    }
    case 'hydrateWorkflowTemplates': {
      const firstTemplate = action.workflowTemplates.templates[0] ?? null;
      return {
        ...state,
        workflowTemplates: action.workflowTemplates,
        activeTemplateId: firstTemplate?.id ?? null,
        workflowDraft: firstTemplate ? cloneWorkflowTemplate(firstTemplate) : null,
      };
    }
    case 'selectWorkflowTemplate': {
      const template =
        state.workflowTemplates.templates.find((item) => item.id === action.templateId) ?? null;
      return {
        ...state,
        activeTemplateId: template?.id ?? null,
        workflowDraft: template ? cloneWorkflowTemplate(template) : null,
      };
    }
    case 'setWorkflowNodeTarget':
      if (!state.workflowDraft) {
        return state;
      }

      return {
        ...state,
        workflowDraft: {
          ...state.workflowDraft,
          stages: state.workflowDraft.stages.map((stage) => {
            if (stage.id !== action.stageId) {
              return stage;
            }

            return {
              ...stage,
              nodes: stage.nodes.map((node) =>
                node.id === action.nodeId
                  ? {
                      ...node,
                      target: action.target ? { ...action.target } : null,
                    }
                  : node,
              ),
            };
          }),
        },
      };
    case 'replaceProviderProfiles':
      return {
        ...state,
        providerProfiles: action.providerProfiles,
      };
    case 'setPrimaryTarget': {
      const targets = reconcileTargets(state.providerCenter, action.target, state.fallbackTarget);
      return {
        ...state,
        primaryTarget: targets.primaryTarget,
        fallbackTarget: targets.fallbackTarget,
      };
    }
    case 'setFallbackTarget': {
      const targets = reconcileTargets(state.providerCenter, state.primaryTarget, action.target);
      return {
        ...state,
        primaryTarget: targets.primaryTarget,
        fallbackTarget: targets.fallbackTarget,
      };
    }
    case 'updateTranslationConfig':
      return {
        ...state,
        translationConfig: {
          ...state.translationConfig,
          [action.key]: action.value,
        },
      };
    case 'toggleAdvancedParams':
      return {
        ...state,
        advancedParamsOpen: action.open ?? !state.advancedParamsOpen,
      };
    case 'startTranslation':
      if (action.preserveProgress) {
        return {
          ...state,
          step: 'translating',
          error: null,
          filter: 'all',
          advancedParamsOpen: false,
        };
      }
      return {
        ...state,
        step: 'translating',
        progress: 0,
        display: state.entries.map((entry) => ({
          ...entry,
          translated: null,
          status: 'pending',
        })),
        logs: [],
        error: null,
        filter: 'all',
        advancedParamsOpen: false,
      };
    case 'translationProgress':
      return {
        ...state,
        display: action.display,
        progress: action.progress,
      };
    case 'translationDone':
      return {
        ...state,
        step: 'done',
        display: action.display,
        progress: 100,
      };
    case 'translationFailed': {
      const hasPartialResults = state.display.some((entry) => entry.status === 'done');
      return {
        ...state,
        step: hasPartialResults ? 'done' : 'config',
        error: action.error,
      };
    }
    case 'setLogs':
      return {
        ...state,
        logs: action.logs,
      };
    case 'appendLog':
      return {
        ...state,
        logs: [...state.logs, action.log],
      };
    case 'setDisplay':
      return {
        ...state,
        display: action.display,
      };
    case 'restoreWorkflowRun':
      {
        const defaults = getDefaultTargets(action.payload.providerCenter);
        const targets = reconcileTargets(
          action.payload.providerCenter,
          defaults.primaryTarget,
          defaults.fallbackTarget,
        );
      return {
        ...state,
        step: action.payload.runStatus === 'completed' ? 'done' : 'config',
        fileName: action.payload.fileName,
        sourceContent: action.payload.sourceContent,
        entries: action.payload.entries,
        display: action.payload.display,
        providerCenter: action.payload.providerCenter,
        translationConfig: action.payload.translationConfig,
        workflowTemplates: action.payload.workflowTemplates,
        activeTemplateId: action.payload.activeTemplateId,
        workflowDraft: action.payload.workflowDraft,
        primaryTarget: targets.primaryTarget,
        fallbackTarget: targets.fallbackTarget,
        logs: action.payload.logs,
        progress: action.payload.progress,
        runStatus: action.payload.runStatus,
        pausedSnapshot: action.payload.pausedSnapshot,
        error: null,
      };
      }
    case 'setFilter':
      return {
        ...state,
        filter: action.filter,
      };
    case 'setStep':
      return {
        ...state,
        step: action.step,
      };
    case 'setRunStatus':
      return {
        ...state,
        runStatus: action.status,
      };
    case 'setPausedSnapshot':
      return {
        ...state,
        pausedSnapshot: action.snapshot,
      };
    case 'beginRetryAll':
      return {
        ...state,
        isRetrying: true,
        error: null,
      };
    case 'finishRetryAll':
      return {
        ...state,
        isRetrying: false,
        display: action.display,
      };
    case 'beginRetrySingle':
      return {
        ...state,
        retryingIndex: action.index,
      };
    case 'finishRetrySingle':
      return {
        ...state,
        display: action.display,
        retryingIndex: action.index,
      };
    case 'setError':
      return {
        ...state,
        error: action.error,
      };
    default:
      return state;
  }
}
