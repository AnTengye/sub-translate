import type { SubtitleEntry } from '../../../lib/subtitle/types';
import { getProviderDefinition } from '../../../lib/providers/registry';
import type {
  SubtitleFilter,
  SubtitleTranslatorState,
  TranslationConfig,
  TranslationLogEntry,
  WorkflowStep,
} from '../types';

type ProviderId = SubtitleTranslatorState['provider'];

export type SubtitleTranslatorAction =
  | { type: 'reset' }
  | { type: 'fileLoaded'; fileName: string; entries: SubtitleEntry[] }
  | { type: 'fileLoadFailed'; error: string }
  | { type: 'setProvider'; provider: ProviderId }
  | { type: 'updateProviderConfig'; key: string; value: string }
  | { type: 'updateTranslationConfig'; key: keyof TranslationConfig; value: number }
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

function getDefaultProviderConfig(provider: ProviderId) {
  return { ...getProviderDefinition(provider).defaults };
}

export function createInitialState(): SubtitleTranslatorState {
  return {
    step: 'upload',
    fileName: '',
    entries: [],
    display: [],
    provider: 'claude',
    providerConfig: getDefaultProviderConfig('claude'),
    translationConfig: {
      batchSize: 20,
      contextLines: 3,
      temperature: 0.3,
    },
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
    case 'setProvider':
      return {
        ...state,
        provider: action.provider,
        providerConfig: getDefaultProviderConfig(action.provider),
      };
    case 'updateProviderConfig':
      return {
        ...state,
        providerConfig: {
          ...state.providerConfig,
          [action.key]: action.value,
        },
      };
    case 'updateTranslationConfig':
      return {
        ...state,
        translationConfig: {
          ...state.translationConfig,
          [action.key]: action.value,
        },
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
