import { useEffect, useState } from 'react';
import type { ProviderId } from '../../../lib/providers/types';
import type { ProviderCenterProfile, ProviderCenterStateData } from '../provider-center-api';

interface ProviderCenterProps {
  isOpen: boolean;
  initialProvider: ProviderId;
  providerCenter: ProviderCenterStateData | null;
  disableSave: boolean;
  onClose: () => void;
  onSave: (draft: ProviderCenterStateData) => Promise<void> | void;
  onCheck: (family: ProviderId, profileId: string) => Promise<ProviderCenterProfile>;
  onDiscoverModels: (family: ProviderId, profileId: string) => Promise<ProviderCenterProfile>;
}

function cloneProviderCenterState(providerCenter: ProviderCenterStateData) {
  return JSON.parse(JSON.stringify(providerCenter)) as ProviderCenterStateData;
}

function patchProfile(
  state: ProviderCenterStateData,
  family: ProviderId,
  profileId: string,
  updater: (profile: ProviderCenterProfile) => ProviderCenterProfile,
) {
  return {
    ...state,
    families: {
      ...state.families,
      [family]: {
        ...state.families[family],
        profiles: state.families[family].profiles.map((profile) =>
          profile.id === profileId ? updater(profile) : profile,
        ),
      },
    },
  };
}

function getSelectedProfile(
  providerCenter: ProviderCenterStateData,
  family: ProviderId,
): ProviderCenterProfile {
  const familyState = providerCenter.families[family];
  return (
    familyState.profiles.find((profile) => profile.id === familyState.activeProfileId) ??
    familyState.profiles[0]
  );
}

const fieldMap: Record<ProviderId, { connection: string[]; settings: string[] }> = {
  'openai-compatible': {
    connection: ['apiEndpoint', 'apiKey'],
    settings: ['model', 'disableThinking'],
  },
  'claude-compatible': {
    connection: ['apiEndpoint', 'apiKey'],
    settings: ['model'],
  },
  baidu: {
    connection: ['apiEndpoint', 'appId', 'apiKey', 'secretKey'],
    settings: ['modelType', 'reference', 'punctuationPreprocessing'],
  },
};

export function ProviderCenter({
  isOpen,
  initialProvider,
  providerCenter,
  disableSave,
  onClose,
  onSave,
  onCheck,
  onDiscoverModels,
}: ProviderCenterProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(initialProvider);
  const [draft, setDraft] = useState<ProviderCenterStateData | null>(providerCenter);
  const [manualModelName, setManualModelName] = useState('');

  useEffect(() => {
    if (!isOpen || !providerCenter) {
      return;
    }

    setSelectedProvider(initialProvider);
    setDraft(cloneProviderCenterState(providerCenter));
    setManualModelName('');
  }, [initialProvider, isOpen, providerCenter]);

  if (!isOpen || !draft) {
    return null;
  }

  const familyState = draft.families[selectedProvider];
  const activeProfile = getSelectedProfile(draft, selectedProvider);
  const fields = fieldMap[selectedProvider];

  function updateProfile(mutator: (profile: ProviderCenterProfile) => ProviderCenterProfile) {
    setDraft((current) =>
      current ? patchProfile(current, selectedProvider, familyState.activeProfileId, mutator) : current,
    );
  }

  function createProfile() {
    const profileId = `${selectedProvider}-${Math.random().toString(36).slice(2, 10)}`;
    const nextProfile: ProviderCenterProfile = {
      ...JSON.parse(JSON.stringify(activeProfile)),
      id: profileId,
      name: `${activeProfile.name} Copy`,
      isDefault: false,
      models: activeProfile.models.map((model) => ({ ...model })),
    };

    setDraft((current) =>
      current
        ? {
            ...current,
            families: {
              ...current.families,
              [selectedProvider]: {
                ...familyState,
                activeProfileId: profileId,
                profiles: [...familyState.profiles, nextProfile],
              },
            },
          }
        : current,
    );
  }

  async function handleCheck() {
    const updated = await onCheck(selectedProvider, activeProfile.id);
    updateProfile(() => updated);
  }

  async function handleDiscover() {
    const updated = await onDiscoverModels(selectedProvider, activeProfile.id);
    updateProfile(() => updated);
  }

  function addManualModel() {
    const modelId = manualModelName.trim();
    if (!modelId) {
      return;
    }

    updateProfile((profile) => ({
      ...profile,
      models: [
        ...profile.models,
        {
          id: modelId,
          label: modelId,
          enabled: true,
          source: 'manual',
        },
      ],
    }));
    setManualModelName('');
  }

  return (
    <div className="advanced-config-backdrop">
      <section className="provider-center-panel" role="dialog" aria-label="Provider Center" aria-modal="true">
        <header className="advanced-config-header">
          <div>
            <p className="section-kicker">Provider Center</p>
            <h2>Provider Center</h2>
            <p className="muted-text">服务端是唯一真源，保存后后续任务立即使用新配置。</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="provider-center-layout">
          <aside className="provider-center-sidebar">
            {(['openai-compatible', 'claude-compatible', 'baidu'] as ProviderId[]).map((family) => {
              const familyProfile = getSelectedProfile(draft, family);
              return (
                <button
                  key={family}
                  type="button"
                  className={`provider-center-family${family === selectedProvider ? ' active' : ''}`}
                  onClick={() => setSelectedProvider(family)}
                >
                  <strong>{draft.families[family].label}</strong>
                  <span>{familyProfile.name}</span>
                  <span>{familyProfile.health.summary}</span>
                </button>
              );
            })}
          </aside>

          <div className="provider-center-content">
            <div className="provider-center-toolbar">
              <label className="field">
                <span>当前配置</span>
                <select
                  value={familyState.activeProfileId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            families: {
                              ...current.families,
                              [selectedProvider]: {
                                ...familyState,
                                activeProfileId: event.target.value,
                              },
                            },
                          }
                        : current
                    )
                  }
                >
                  {familyState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="advanced-profile-actions">
                <button className="secondary-button" type="button" onClick={createProfile}>
                  复制配置
                </button>
                <button className="secondary-button" type="button" onClick={handleCheck}>
                  连通性检查
                </button>
                <button className="secondary-button" type="button" onClick={handleDiscover}>
                  自动发现模型
                </button>
              </div>
            </div>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Overview</div>
                  <div className="section-title">{activeProfile.name}</div>
                </div>
              </div>
              <p className="muted-text">状态：{activeProfile.enabled ? '已启用' : '已停用'}</p>
              <p className="muted-text">检查：{activeProfile.health.summary}</p>
              <label className="field field-checkbox">
                <input
                  aria-label="启用配置"
                  className="field-checkbox-input"
                  type="checkbox"
                  checked={activeProfile.enabled}
                  onChange={(event) =>
                    updateProfile((profile) => ({
                      ...profile,
                      enabled: event.target.checked,
                    }))
                  }
                />
                <div className="field-checkbox-copy">
                  <span className="field-checkbox-title">启用当前配置</span>
                </div>
              </label>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Connection</div>
                  <div className="section-title">连接配置</div>
                </div>
              </div>
              <div className="field-stack advanced-field-stack">
                {fields.connection.map((key) => (
                  <label key={key} className="field">
                    <span>{key}</span>
                    <input
                      aria-label={key}
                      type={key.toLowerCase().includes('key') ? 'password' : 'text'}
                      value={activeProfile.connection[key] ?? ''}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          connection: {
                            ...profile.connection,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Behavior</div>
                  <div className="section-title">模型与行为</div>
                </div>
              </div>
              <div className="field-stack advanced-field-stack">
                {fields.settings.map((key) => (
                  <label
                    key={key}
                    className={key.toLowerCase().includes('thinking') || key.toLowerCase().includes('punctuation') ? 'field field-checkbox' : 'field'}
                  >
                    {key.toLowerCase().includes('thinking') || key.toLowerCase().includes('punctuation') ? (
                      <>
                        <input
                          aria-label={key}
                          className="field-checkbox-input"
                          type="checkbox"
                          checked={activeProfile.settings[key] === 'true'}
                          onChange={(event) =>
                            updateProfile((profile) => ({
                              ...profile,
                              settings: {
                                ...profile.settings,
                                [key]: event.target.checked ? 'true' : '',
                              },
                            }))
                          }
                        />
                        <div className="field-checkbox-copy">
                          <span className="field-checkbox-title">{key}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>{key}</span>
                        <input
                          aria-label={key}
                          type="text"
                          value={activeProfile.settings[key] ?? ''}
                          onChange={(event) =>
                            updateProfile((profile) => ({
                              ...profile,
                              settings: {
                                ...profile.settings,
                                [key]: event.target.value,
                              },
                            }))
                          }
                        />
                      </>
                    )}
                  </label>
                ))}
              </div>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Models</div>
                  <div className="section-title">模型列表</div>
                </div>
              </div>
              <div className="provider-center-model-list">
                {activeProfile.models.length === 0 ? (
                  <span className="muted-text">暂无模型，可自动发现或手动添加。</span>
                ) : (
                  activeProfile.models.map((model) => (
                    <div key={model.id} className="provider-center-model-item">
                      <span>{model.label}</span>
                      <span>{model.source}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="provider-center-model-actions">
                <input
                  aria-label="手动模型"
                  className="provider-center-model-input"
                  value={manualModelName}
                  onChange={(event) => setManualModelName(event.target.value)}
                  placeholder="手动添加模型名"
                />
                <button className="secondary-button" type="button" onClick={addManualModel}>
                  添加模型
                </button>
              </div>
            </section>
          </div>
        </div>

        <footer className="advanced-config-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" type="button" disabled={disableSave} onClick={() => onSave(draft)}>
            保存配置
          </button>
        </footer>
      </section>
    </div>
  );
}
