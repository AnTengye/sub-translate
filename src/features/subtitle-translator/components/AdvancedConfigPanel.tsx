import { useEffect, useRef, useState } from 'react';
import type { ProviderFieldDefinition, ProviderId } from '../../../lib/providers/types';
import {
  getActiveProviderProfile,
  type ProviderProfileStorageData,
} from '../config-storage';

interface AdvancedConfigPanelProps {
  isOpen: boolean;
  providerProfiles: ProviderProfileStorageData;
  initialProvider: ProviderId;
  disableSave: boolean;
  onClose: () => void;
  onSave: (providerProfiles: ProviderProfileStorageData) => void;
}

const advancedFieldMap: Record<ProviderId, ProviderFieldDefinition[]> = {
  'openai-compatible': [
    { key: 'name', label: '配置名称', type: 'text', placeholder: '例如：本地 OpenAI' },
    { key: 'apiEndpoint', label: 'API 端点', type: 'text', placeholder: 'https://api.openai.com/v1' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
    { key: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-4o-mini' },
    { key: 'disableThinking', label: '关闭 Thinking', type: 'checkbox' },
  ],
  'claude-compatible': [
    { key: 'name', label: '配置名称', type: 'text', placeholder: '例如：Claude 代理' },
    { key: 'apiEndpoint', label: 'API 端点', type: 'text', placeholder: 'https://api.anthropic.com/v1' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    { key: 'model', label: '模型名称', type: 'text', placeholder: 'claude-3-5-sonnet-latest' },
  ],
  baidu: [
    { key: 'name', label: '配置名称', type: 'text', placeholder: '例如：百度默认' },
    {
      key: 'apiEndpoint',
      label: 'API 端点',
      type: 'text',
      placeholder: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
    },
    { key: 'appId', label: 'APP ID', type: 'text', placeholder: '百度 APP ID' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Bearer API Key' },
    { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'Sign Secret Key' },
    { key: 'modelType', label: '翻译模型', type: 'select', options: ['llm', 'nmt'] },
    { key: 'reference', label: '翻译指令', type: 'text', placeholder: '例如：保持口语自然' },
    { key: 'punctuationPreprocessing', label: '标点预处理', type: 'checkbox' },
  ],
};

function createProfileId(provider: ProviderId) {
  return `${provider}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AdvancedConfigPanel({
  isOpen,
  providerProfiles,
  initialProvider,
  disableSave,
  onClose,
  onSave,
}: AdvancedConfigPanelProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(initialProvider);
  const [draft, setDraft] = useState(providerProfiles);
  const draftRef = useRef(draft);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedProvider(initialProvider);
    setDraft(providerProfiles);
  }, [initialProvider, isOpen, providerProfiles]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  if (!isOpen) {
    return null;
  }

  const providerGroup = draft.providers[selectedProvider];
  const activeProfile = getActiveProviderProfile(draft, selectedProvider);
  const activeProfileConfig = activeProfile.config as unknown as Record<string, string>;
  const fields = advancedFieldMap[selectedProvider];

  function updateDraft(
    updater: ProviderProfileStorageData | ((current: ProviderProfileStorageData) => ProviderProfileStorageData),
  ) {
    setDraft((current) => (typeof updater === 'function' ? updater(current) : updater));
  }

  function updateActiveProfileField(key: string, value: string) {
    updateDraft((current) => {
      const currentGroup = current.providers[selectedProvider];

      return {
        ...current,
        providers: {
          ...current.providers,
          [selectedProvider]: {
            ...currentGroup,
            profiles: currentGroup.profiles.map((profile) =>
              profile.id === currentGroup.activeProfileId
                ? {
                    ...profile,
                    ...(key === 'name'
                      ? { name: value }
                      : {
                          config: {
                            ...profile.config,
                            [key]: value,
                          },
                        }),
                  }
                : profile,
            ),
          },
        },
      };
    });
  }

  function createBlankProfile() {
    const profileId = createProfileId(selectedProvider);
    const nextProfile =
      selectedProvider === 'openai-compatible'
        ? {
            id: profileId,
            name: '新配置',
            config: {
              apiEndpoint: '',
              apiKey: '',
              model: '',
              disableThinking: '',
            },
          }
        : selectedProvider === 'claude-compatible'
          ? {
              id: profileId,
              name: '新配置',
              config: {
                apiEndpoint: '',
                apiKey: '',
                model: '',
              },
            }
          : {
              id: profileId,
              name: '新配置',
              config: {
                apiEndpoint: '',
                appId: '',
                apiKey: '',
                secretKey: '',
                modelType: 'llm',
                reference: '',
                punctuationPreprocessing: '',
              },
            };

    updateDraft((current) => {
      const currentGroup = current.providers[selectedProvider];

      return {
        ...current,
        providers: {
          ...current.providers,
          [selectedProvider]: {
            activeProfileId: profileId,
            profiles: [...currentGroup.profiles, nextProfile],
          },
        },
      };
    });
  }

  function duplicateProfile() {
    const profileId = createProfileId(selectedProvider);
    updateDraft((current) => {
      const currentActiveProfile = getActiveProviderProfile(current, selectedProvider);
      const currentGroup = current.providers[selectedProvider];

      return {
        ...current,
        providers: {
          ...current.providers,
          [selectedProvider]: {
            activeProfileId: profileId,
            profiles: [
              ...currentGroup.profiles,
              {
                ...currentActiveProfile,
                id: profileId,
                name: `${currentActiveProfile.name} 副本`,
                config: { ...currentActiveProfile.config },
              },
            ],
          },
        },
      };
    });
  }

  function deleteProfile() {
    if (providerGroup.profiles.length <= 1) {
      return;
    }

    const remainingProfiles = providerGroup.profiles.filter(
      (profile) => profile.id !== providerGroup.activeProfileId,
    );

    updateDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [selectedProvider]: {
          activeProfileId: remainingProfiles[0].id,
          profiles: remainingProfiles,
        },
      },
    }));
  }

  return (
    <div className="advanced-config-backdrop">
      <section className="advanced-config-panel" role="dialog" aria-label="高级配置" aria-modal="true">
        <header className="advanced-config-header">
          <div>
            <p className="section-kicker">Advanced Config</p>
            <h2>高级配置</h2>
            <p className="muted-text">保存后仅影响后续新发起的翻译或重试任务。</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="advanced-provider-tabs" role="tablist" aria-label="Provider 标签">
          {(['openai-compatible', 'claude-compatible', 'baidu'] as ProviderId[]).map((provider) => (
            <button
              key={provider}
              className={`advanced-provider-tab${provider === selectedProvider ? ' active' : ''}`}
              type="button"
              onClick={() => setSelectedProvider(provider)}
            >
              {provider === 'openai-compatible'
                ? 'OpenAI Compatible'
                : provider === 'claude-compatible'
                  ? 'Claude Compatible'
                  : '百度'}
            </button>
          ))}
        </div>

        <div className="advanced-profile-toolbar">
          <label className="field">
            <span>当前配置</span>
            <select
              value={providerGroup.activeProfileId}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  providers: {
                    ...current.providers,
                    [selectedProvider]: {
                      ...current.providers[selectedProvider],
                      activeProfileId: event.target.value,
                    },
                  },
                }))
              }
            >
              {providerGroup.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <div className="advanced-profile-actions">
            <button className="secondary-button" type="button" onClick={createBlankProfile}>
              新建
            </button>
            <button className="secondary-button" type="button" onClick={duplicateProfile}>
              复制
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={deleteProfile}
              disabled={providerGroup.profiles.length <= 1}
            >
              删除
            </button>
          </div>
        </div>

        <div className="field-stack advanced-field-stack">
          {fields.map((field) => {
            const value = field.key === 'name' ? activeProfile.name : activeProfileConfig[field.key] ?? '';

            if (field.type === 'select') {
              return (
                <label key={field.key} className="field">
                  <span>{field.label}</span>
                  <select
                    aria-label={field.label}
                    value={value}
                    onChange={(event) => updateActiveProfileField(field.key, event.target.value)}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            if (field.type === 'checkbox') {
              return (
                <label key={field.key} className="field field-checkbox">
                  <input
                    aria-label={field.label}
                    className="field-checkbox-input"
                    type="checkbox"
                    checked={value === 'true'}
                    onChange={(event) =>
                      updateActiveProfileField(field.key, event.target.checked ? 'true' : '')
                    }
                  />
                  <div className="field-checkbox-copy">
                    <span className="field-checkbox-title">{field.label}</span>
                  </div>
                </label>
              );
            }

            return (
              <label key={field.key} className="field">
                <span>{field.label}</span>
                <input
                  aria-label={field.label}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => updateActiveProfileField(field.key, event.target.value)}
                />
              </label>
            );
          })}
        </div>

        <footer className="advanced-config-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={disableSave}
            onClick={() => onSave(draftRef.current)}
          >
            保存配置
          </button>
        </footer>
      </section>
    </div>
  );
}
