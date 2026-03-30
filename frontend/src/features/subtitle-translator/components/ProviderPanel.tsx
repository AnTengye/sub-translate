import type { Dispatch } from 'react';
import { listProviderDefinitions } from '../../../lib/providers/registry';
import type { ProviderId } from '../../../lib/providers/types';
import type { ProviderCenterProfile } from '../provider-center-api';
import type { SubtitleTranslatorAction } from '../state/reducer';
import type { SubtitleTranslatorState } from '../types';

interface ProviderPanelProps {
  state: SubtitleTranslatorState;
  dispatch: Dispatch<SubtitleTranslatorAction>;
  onStart: () => void | Promise<void>;
}

const providerDefinitions = listProviderDefinitions();

function getActiveProfile(state: SubtitleTranslatorState): ProviderCenterProfile | null {
  const family = state.providerCenter?.families[state.provider];
  if (!family) {
    return null;
  }

  return family.profiles.find((profile) => profile.id === family.activeProfileId) ?? null;
}

function getProviderDisplayName(providerId: ProviderId) {
  switch (providerId) {
    case 'openai-compatible':
      return 'OpenAI';
    case 'claude-compatible':
      return 'Claude';
    case 'baidu':
      return 'Baidu';
    default:
      return providerId;
  }
}

export function ProviderPanel({ state, dispatch, onStart }: ProviderPanelProps) {
  const disableInputs = state.step === 'translating' || state.isRetrying || state.retryingIndex !== null;
  const activeProfile = getActiveProfile(state);
  const activeProvider = providerDefinitions.find((provider) => provider.id === state.provider);
  const activeProviderIndex = providerDefinitions.findIndex((provider) => provider.id === state.provider);
  const backupProvider =
    providerDefinitions[(activeProviderIndex + 1 + providerDefinitions.length) % providerDefinitions.length];

  function switchProvider(providerId: ProviderId) {
    dispatch({ type: 'setProvider', provider: providerId });
  }

  return (
    <aside className="sidebar" aria-label="配置侧栏">
      <div className="sidebar-section">
        <div className="sidebar-label">翻译参数</div>
        <label className="config-item">
          <span className="config-key">每批次数量</span>
          <input
            aria-label="每批字幕数量"
            className="config-input"
            type="number"
            min="5"
            max="50"
            step="1"
            disabled={disableInputs}
            value={state.translationConfig.batchSize}
            onChange={(event) =>
              dispatch({
                type: 'updateTranslationConfig',
                key: 'batchSize',
                value: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="config-item">
          <span className="config-key">上下文条数</span>
          <input
            aria-label="上下文条数"
            className="config-input"
            type="number"
            min="0"
            max="10"
            step="1"
            disabled={disableInputs}
            value={state.translationConfig.contextLines}
            onChange={(event) =>
              dispatch({
                type: 'updateTranslationConfig',
                key: 'contextLines',
                value: Number(event.target.value),
              })
            }
          />
        </label>
        {state.provider === 'openai-compatible' ? (
          <label className="config-item">
            <span className="config-key">Temperature</span>
            <input
              aria-label="Temperature"
              className="config-input"
              type="number"
              min="0"
              max="1"
              step="0.05"
              disabled={disableInputs}
              value={state.translationConfig.temperature}
              onChange={(event) =>
                dispatch({
                  type: 'updateTranslationConfig',
                  key: 'temperature',
                  value: Number(event.target.value),
                })
              }
            />
          </label>
        ) : null}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">当前 Provider</div>
        <button
          className="provider-card provider-card-button"
          type="button"
          aria-label={`当前 Provider ${getProviderDisplayName(state.provider)}`}
          disabled={disableInputs}
          onClick={() => switchProvider(backupProvider.id as ProviderId)}
        >
          <div className="provider-name">
            <div className="status-dot" />
            {getProviderDisplayName(state.provider)}
          </div>
          <div className="provider-model">
            {(activeProfile?.settings.model ??
              activeProfile?.settings.modelType ??
              activeProvider?.label ??
              '未配置')}{' '}
            {activeProfile ? `· ${activeProfile.name}` : ''}
          </div>
          <span className="params-btn">
            模型参数
          </span>
        </button>
        <div className="provider-helper-text">配置、模型列表、连通性检查全部由服务端统一管理。</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">失败备选</div>
        <button
          className="backup-provider"
          type="button"
          aria-label={`备选 Provider ${backupProvider.label}`}
          disabled={disableInputs}
          onClick={() => switchProvider(backupProvider.id as ProviderId)}
        >
          <span className="backup-label">备选 Provider</span>
          <span className="backup-val">{backupProvider ? `${backupProvider.label} ›` : '未配置'}</span>
        </button>
      </div>

      {state.step === 'config' ? (
        <button className="start-btn" type="button" onClick={onStart}>
          开始翻译
        </button>
      ) : null}
    </aside>
  );
}
