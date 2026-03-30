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
import {
  ensureDistinctTarget,
  getDefaultTargets,
  type ProviderTarget,
  buildProviderTargetOptions,
} from '../target-selection';

export type SubtitleTranslatorAction =
  | { type: 'reset' }
  | { type: 'fileLoaded'; fileName: string; entries: SubtitleEntry[] }
  | { type: 'fileLoadFailed'; error: string }
  | { type: 'hydrateProviderCenter'; providerCenter: ProviderCenterStateData }
  | { type: 'replaceProviderProfiles'; providerProfiles: ProviderProfileStorageData }
  | { type: 'setPrimaryTarget'; target: ProviderTarget | null }
  | { type: 'setFallbackTarget'; target: ProviderTarget | null }
  | { type: 'updateTranslationConfig'; key: keyof TranslationConfig; value: number }
  | { type: 'toggleAdvancedParams'; open?: boolean }
  | { type: 'startTranslation' }
  | { type: 'translationProgress'; display: SubtitleEntry[]; progress: number }
  | { type: 'translationDone'; display: SubtitleEntry[] }
  | { type: 'translationFailed'; error: string }
  | { type: 'setLogs'; logs: TranslationLogEntry[] }
  | { type: 'appendLog'; log: TranslationLogEntry }
  | { type: 'setDisplay'; display: SubtitleEntry[] }
  | { type: 'setFilter'; filter: SubtitleFilter }
  | { type: 'setStep'; step: WorkflowStep }
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
    entries: [],
    display: [],
    providerCenter: null,
    providerProfiles,
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
        entries: action.entries,
        display: action.entries,
        progress: 0,
        logs: [],
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
    case 'translationFailed':
      return {
        ...state,
        step: 'config',
        error: action.error,
      };
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
