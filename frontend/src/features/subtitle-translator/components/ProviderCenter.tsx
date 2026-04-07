import { useEffect, useState } from 'react';
import { useAsyncAction } from '../../../components/ui/feedback/useAsyncAction';
import { useToast } from '../../../components/ui/feedback/useToast';
import type { ProviderId } from '../../../lib/providers/types';
import type { ProviderCenterModel, ProviderCenterProfile, ProviderCenterStateData } from '../provider-center-api';
import { getModelSourceLabel, getProfileHealthLabel } from '../target-selection';
import { ModelManagerDialog } from './ModelManagerDialog';

interface ProviderCenterProps {
  isOpen: boolean;
  initialProvider: ProviderId;
  providerCenter: ProviderCenterStateData | null;
  disableSave: boolean;
  onClose: () => void;
  onSave: (draft: ProviderCenterStateData) => Promise<void> | void;
  onCheck: (family: ProviderId, profileId: string, profile: ProviderCenterProfile) => Promise<ProviderCenterProfile>;
  onLoadModelCatalog: (
    family: ProviderId,
    profileId: string,
    profile: ProviderCenterProfile,
  ) => Promise<{ profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string }>;
}

type ProviderTypeOption = 'OpenAI' | 'Anthropic' | 'Google' | 'New API' | 'Baidu';

interface SelectedProfileRef {
  family: ProviderId;
  profileId: string;
}

interface FlatProfileItem extends SelectedProfileRef {
  name: string;
  typeLabel: ProviderTypeOption;
  enabled: boolean;
  summary: string;
}

interface CreateProviderDraft {
  name: string;
  type: ProviderTypeOption;
}

interface RemoveProfileResult {
  state: ProviderCenterStateData;
  selected: SelectedProfileRef | null;
}

const providerTypeOptions: ProviderTypeOption[] = ['OpenAI', 'Anthropic', 'Google', 'New API', 'Baidu'];

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
        profiles: state.families[family].profiles.map((profile) => (profile.id === profileId ? updater(profile) : profile)),
      },
    },
  };
}

function getSelectedProfile(providerCenter: ProviderCenterStateData, selected: SelectedProfileRef): ProviderCenterProfile | null {
  const familyState = providerCenter.families[selected.family];
  if (!familyState) {
    return null;
  }
  return (
    familyState.profiles.find((profile) => profile.id === selected.profileId) ??
    familyState.profiles.find((profile) => profile.id === familyState.activeProfileId) ??
    familyState.profiles[0] ??
    null
  );
}

function findFirstAvailableProfile(providerCenter: ProviderCenterStateData): SelectedProfileRef | null {
  for (const family of Object.keys(providerCenter.families) as ProviderId[]) {
    const profile = providerCenter.families[family].profiles[0];
    if (profile) {
      return { family, profileId: profile.id };
    }
  }
  return null;
}

function profileTypeLabel(profile: ProviderCenterProfile): ProviderTypeOption {
  const override = profile.settings.providerLabel;
  if (override === 'OpenAI' || override === 'Anthropic' || override === 'Google' || override === 'New API' || override === 'Baidu') {
    return override;
  }
  switch (profile.family) {
    case 'openai-compatible':
      return 'OpenAI';
    case 'claude-compatible':
      return 'Anthropic';
    case 'google':
      return 'Google';
    case 'baidu':
      return 'Baidu';
    default:
      return 'OpenAI';
  }
}

function getInitialSelectedProfile(providerCenter: ProviderCenterStateData, initialProvider: ProviderId): SelectedProfileRef | null {
  const familyState = providerCenter.families[initialProvider];
  const preferred = familyState?.profiles.find((profile) => profile.id === familyState.activeProfileId) ?? familyState?.profiles[0];
  if (preferred) {
    return { family: initialProvider, profileId: preferred.id };
  }
  return findFirstAvailableProfile(providerCenter);
}

function removeProfile(state: ProviderCenterStateData, selected: SelectedProfileRef): RemoveProfileResult {
  const familyState = state.families[selected.family];
  const index = familyState.profiles.findIndex((profile) => profile.id === selected.profileId);
  if (index === -1) {
    return { state, selected };
  }
  const nextProfiles = familyState.profiles.filter((profile) => profile.id !== selected.profileId);
  const fallbackInFamily = nextProfiles[index] ?? nextProfiles[index - 1] ?? null;
  const nextState = {
    ...state,
    families: {
      ...state.families,
      [selected.family]: {
        ...familyState,
        activeProfileId: fallbackInFamily?.id ?? '',
        profiles: nextProfiles,
      },
    },
  };
  return {
    state: nextState,
    selected: fallbackInFamily ? { family: selected.family, profileId: fallbackInFamily.id } : findFirstAvailableProfile(nextState),
  };
}

function buildFlatProfiles(providerCenter: ProviderCenterStateData): FlatProfileItem[] {
  return (Object.keys(providerCenter.families) as ProviderId[]).flatMap((family) =>
    providerCenter.families[family].profiles.map((profile) => ({
      family,
      profileId: profile.id,
      name: profile.name,
      typeLabel: profileTypeLabel(profile),
      enabled: profile.enabled,
      summary: getProfileHealthLabel(profile),
    })),
  );
}

function providerIcon(label: ProviderTypeOption) {
  switch (label) {
    case 'OpenAI':
      return 'O';
    case 'Anthropic':
      return 'A';
    case 'Google':
      return 'G';
    case 'New API':
      return 'N';
    case 'Baidu':
      return 'B';
    default:
      return 'P';
  }
}

function buildProfileTemplate(type: ProviderTypeOption, profileId: string, name: string): ProviderCenterProfile {
  if (type === 'Anthropic') {
    return { id: profileId, family: 'claude-compatible', name, enabled: true, isDefault: false, connection: { apiEndpoint: '', apiKey: '' }, settings: { model: '', providerLabel: 'Anthropic' }, capabilities: { supportsModelDiscovery: false, supportsConnectionCheck: true, supportsManualModelManagement: true, supportsThinkingToggle: false }, models: [], modelDiscovery: { sourceMode: 'manual', supportsModelDiscovery: false, lastCheckedAt: null, lastStatus: 'idle', lastError: null }, health: { status: 'idle', summary: '未检查', lastCheckedAt: null, error: null } };
  }
  if (type === 'Baidu') {
    return { id: profileId, family: 'baidu', name, enabled: true, isDefault: false, connection: { apiEndpoint: '', appId: '', apiKey: '', secretKey: '' }, settings: { modelType: '', reference: '', punctuationPreprocessing: '', providerLabel: 'Baidu' }, capabilities: { supportsModelDiscovery: false, supportsConnectionCheck: true, supportsManualModelManagement: true, supportsThinkingToggle: false }, models: [], modelDiscovery: { sourceMode: 'manual', supportsModelDiscovery: false, lastCheckedAt: null, lastStatus: 'idle', lastError: null }, health: { status: 'idle', summary: '未检查', lastCheckedAt: null, error: null } };
  }
  if (type === 'Google') {
    return { id: profileId, family: 'google', name, enabled: true, isDefault: false, connection: { apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '' }, settings: { model: '', disableThinking: '', providerLabel: 'Google' }, capabilities: { supportsModelDiscovery: true, supportsConnectionCheck: true, supportsManualModelManagement: true, supportsThinkingToggle: true }, models: [], modelDiscovery: { sourceMode: 'auto', supportsModelDiscovery: true, lastCheckedAt: null, lastStatus: 'idle', lastError: null }, health: { status: 'idle', summary: '未检查', lastCheckedAt: null, error: null } };
  }
  return { id: profileId, family: 'openai-compatible', name, enabled: true, isDefault: false, connection: { apiEndpoint: '', apiKey: '' }, settings: { model: '', disableThinking: '', providerLabel: type }, capabilities: { supportsModelDiscovery: true, supportsConnectionCheck: true, supportsManualModelManagement: true, supportsThinkingToggle: true }, models: [], modelDiscovery: { sourceMode: 'auto', supportsModelDiscovery: true, lastCheckedAt: null, lastStatus: 'idle', lastError: null }, health: { status: 'idle', summary: '未检查', lastCheckedAt: null, error: null } };
}

function nextProfileId(type: ProviderTypeOption) {
  const family = type === 'Anthropic' ? 'claude-compatible' : type === 'Google' ? 'google' : type === 'Baidu' ? 'baidu' : 'openai-compatible';
  return `${family}-${Math.random().toString(36).slice(2, 10)}`;
}

function previewApiUrl(profile: ProviderCenterProfile) {
  const endpoint = (profile.connection.apiEndpoint ?? '').trim();
  if (!endpoint) {
    return '预览：请先填写 API 地址';
  }
  if (profile.family === 'openai-compatible') {
    return `预览：${endpoint.replace(/\/$/, '')}/chat/completions`;
  }
  if (profile.family === 'google') {
    return `预览：${endpoint.replace(/\/$/, '')}/models/{model}:generateContent`;
  }
  return `预览：${endpoint}`;
}

export function ProviderCenter(props: ProviderCenterProps) {
  const { isOpen, initialProvider, providerCenter, disableSave, onClose, onSave, onCheck, onLoadModelCatalog } = props;
  const [draft, setDraft] = useState<ProviderCenterStateData | null>(providerCenter);
  const [selected, setSelected] = useState<SelectedProfileRef | null>(providerCenter ? getInitialSelectedProfile(providerCenter, initialProvider) : null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modelManagerOpen, setModelManagerOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProviderDraft>({ name: '', type: 'OpenAI' });
  const saveAction = useAsyncAction();
  const checkAction = useAsyncAction();
  const toast = useToast();

  useEffect(() => {
    if (!isOpen || !providerCenter) {
      return;
    }
    setDraft(cloneProviderCenterState(providerCenter));
    setSelected(getInitialSelectedProfile(providerCenter, initialProvider));
    setShowApiKey(false);
    setCreateModalOpen(false);
    setModelManagerOpen(false);
    setCreateDraft({ name: '', type: 'OpenAI' });
  }, [initialProvider, isOpen, providerCenter]);

  if (!isOpen || !draft) {
    return null;
  }

  const selectedRef = selected;
  const flatProfiles = buildFlatProfiles(draft);
  const activeProfile = selectedRef ? getSelectedProfile(draft, selectedRef) : null;
  const activeTypeLabel = activeProfile ? profileTypeLabel(activeProfile) : null;
  const isBaidu = activeProfile?.family === 'baidu';
  const selectedModels = activeProfile?.models ?? [];
  const defaultModelValue = activeProfile ? (isBaidu ? activeProfile.settings.modelType ?? '' : activeProfile.settings.model ?? '') : '';

  function updateProfile(mutator: (profile: ProviderCenterProfile) => ProviderCenterProfile) {
    if (!selectedRef) {
      return;
    }
    setDraft((current) => (current ? patchProfile(current, selectedRef.family, selectedRef.profileId, mutator) : current));
  }

  function chooseProfile(next: SelectedProfileRef) {
    setSelected(next);
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, families: { ...current.families, [next.family]: { ...current.families[next.family], activeProfileId: next.profileId } } };
    });
    setShowApiKey(false);
    setModelManagerOpen(false);
  }

  async function handleCheck() {
    if (!selectedRef || !activeProfile) {
      return;
    }
    try {
      const updated = await checkAction.run(() => onCheck(selectedRef.family, activeProfile.id, activeProfile));
      updateProfile(() => updated);
      toast.success(`状态：${getProfileHealthLabel(updated)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '检测失败');
    }
  }

  function createProviderProfile() {
    const name = createDraft.name.trim();
    if (!name) {
      return;
    }
    const profileId = nextProfileId(createDraft.type);
    const nextProfile = buildProfileTemplate(createDraft.type, profileId, name);
    const family = nextProfile.family;
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, families: { ...current.families, [family]: { ...current.families[family], activeProfileId: profileId, profiles: [...current.families[family].profiles, nextProfile] } } };
    });
    setSelected({ family, profileId });
    setCreateModalOpen(false);
    setCreateDraft({ name: '', type: 'OpenAI' });
  }

  function handleDeleteProfile() {
    if (!selectedRef || !activeProfile) {
      return;
    }
    if (!window.confirm(`确认删除配置“${activeProfile.name}”吗？`)) {
      return;
    }
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const result = removeProfile(current, selectedRef);
      setSelected(result.selected);
      return result.state;
    });
    setShowApiKey(false);
    setModelManagerOpen(false);
  }

  return (
    <div className="advanced-config-backdrop">
      <section className="provider-center-shell" role="dialog" aria-label="Provider Center" aria-modal="true">
        <header className="provider-center-header">
          <div>
            <p className="section-kicker">Provider Center</p>
            <h2>Provider Center</h2>
            <p className="muted-text">管理配置，保存后用于新任务。</p>
          </div>
          <button className="provider-close-button" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="provider-center-layout">
          <aside className="provider-center-saved-list" aria-label="已保存的配置">
            <div className="provider-center-saved-scroll">
              {flatProfiles.map((item) => (
                <button
                  key={item.profileId}
                  type="button"
                  className={`provider-center-saved-item${
                    item.family === selectedRef?.family && item.profileId === selectedRef?.profileId ? ' active' : ''
                  }`}
                  onClick={() => chooseProfile({ family: item.family, profileId: item.profileId })}
                >
                  <span className={`provider-center-provider-icon type-${item.typeLabel.replace(/\s+/g, '-').toLowerCase()}`}>
                    {providerIcon(item.typeLabel)}
                  </span>
                  <span className="provider-center-saved-copy">
                    <span className="provider-center-saved-name">{item.name}</span>
                    <span className="provider-center-saved-meta">
                      <span className="provider-center-type-tag">{item.typeLabel}</span>
                      <span>{item.enabled ? '已启用' : '已停用'}</span>
                    </span>
                    <span className="provider-center-saved-status">{item.summary}</span>
                  </span>
                </button>
              ))}
            </div>

            <button className="provider-center-add-button" type="button" onClick={() => setCreateModalOpen(true)}>
              + 添加
            </button>
          </aside>

          <div className="provider-center-editor">
            {activeProfile ? (
              <>
                <section className="provider-center-editor-header">
                  <div className="provider-center-editor-heading">
                    <div className="provider-center-editor-title-row">
                      <h3>{activeProfile.name}</h3>
                      <span className="provider-center-type-badge">{activeTypeLabel}</span>
                    </div>
                    <p className="muted-text">状态：{getProfileHealthLabel(activeProfile)}</p>
                  </div>

                  <div className="provider-center-inline-actions">
                    <button className="provider-inline-button" type="button" onClick={handleDeleteProfile}>
                      删除当前配置
                    </button>
                    <label className="provider-center-toggle">
                      <input
                        aria-label="启用配置"
                        type="checkbox"
                        checked={activeProfile.enabled}
                        onChange={(event) =>
                          updateProfile((profile) => ({
                            ...profile,
                            enabled: event.target.checked,
                          }))
                        }
                      />
                      <span />
                    </label>
                  </div>
                </section>

                <section className="provider-center-section">
                  <div className="provider-center-section-heading">
                    <div>
                      <h4>API 密钥</h4>
                    </div>
                    <div className="provider-center-inline-actions">
                      <button className="provider-inline-button" type="button" onClick={() => setShowApiKey((value) => !value)}>
                        {showApiKey ? '隐藏' : '显示'}
                      </button>
                      <button
                        className="provider-inline-button provider-inline-button-primary"
                        type="button"
                        disabled={checkAction.isPending}
                        onClick={() => void handleCheck()}
                      >
                        {checkAction.isPending ? '检测中…' : '检测'}
                      </button>
                    </div>
                  </div>
                  <input
                    aria-label="apiKey"
                    className="provider-center-input"
                    type={showApiKey ? 'text' : 'password'}
                    value={activeProfile.connection.apiKey ?? ''}
                    onChange={(event) =>
                      updateProfile((profile) => ({
                        ...profile,
                        connection: {
                          ...profile.connection,
                          apiKey: event.target.value,
                        },
                      }))
                    }
                  />
                  <p className="provider-center-field-note">多个密钥可使用逗号分隔。</p>
                </section>

                <section className="provider-center-section">
                  <div className="provider-center-section-heading">
                    <div>
                      <h4>API 地址</h4>
                    </div>
                  </div>
                  <input
                    aria-label="apiEndpoint"
                    className="provider-center-input"
                    type="text"
                    value={activeProfile.connection.apiEndpoint ?? ''}
                    onChange={(event) =>
                      updateProfile((profile) => ({
                        ...profile,
                        connection: {
                          ...profile.connection,
                          apiEndpoint: event.target.value,
                        },
                      }))
                    }
                  />
                  <p className="provider-center-field-note">{previewApiUrl(activeProfile)}</p>
                </section>
              </>
            ) : (
              <section className="provider-center-section">
                <div className="provider-center-section-heading">
                  <div>
                    <h4>当前没有可编辑的配置</h4>
                    <p className="muted-text">这个 provider family 已删空。可以直接点击左下角“+ 添加”创建新配置。</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {activeProfile ? (
          <>
            {isBaidu ? (
              <section className="provider-center-section">
                <div className="provider-center-section-heading">
                  <div>
                    <h4>连接凭证</h4>
                  </div>
                </div>
                <div className="provider-center-grid">
                  <label className="field">
                    <span>appId</span>
                    <input
                      aria-label="appId"
                      type="text"
                      value={activeProfile.connection.appId ?? ''}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          connection: {
                            ...profile.connection,
                            appId: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>secretKey</span>
                    <input
                      aria-label="secretKey"
                      type="password"
                      value={activeProfile.connection.secretKey ?? ''}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          connection: {
                            ...profile.connection,
                            secretKey: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section className="provider-center-section">
              <div className="provider-center-section-heading">
                <div>
                  <h4>模型</h4>
                  <p className="provider-center-caption">{selectedModels.length} 个已添加模型</p>
                </div>
              </div>

              {activeProfile.family === 'openai-compatible' || activeProfile.family === 'google' ? (
                <label className="field field-checkbox provider-center-checkbox-row">
                  <input
                    aria-label="disableThinking"
                    className="field-checkbox-input"
                    type="checkbox"
                    checked={activeProfile.settings.disableThinking === 'true'}
                    onChange={(event) =>
                      updateProfile((profile) => ({
                        ...profile,
                        settings: {
                          ...profile.settings,
                          disableThinking: event.target.checked ? 'true' : '',
                        },
                      }))
                    }
                  />
                  <div className="field-checkbox-copy">
                    <span className="field-checkbox-title">disableThinking</span>
                    <span className="provider-center-field-note">关闭模型思维链，优先返回直接结果。</span>
                  </div>
                </label>
              ) : null}

              <label className="field provider-center-model-field">
                <span>默认模型</span>
                <select
                  aria-label="默认模型"
                  value={defaultModelValue}
                  onChange={(event) =>
                    updateProfile((profile) => ({
                      ...profile,
                      settings: {
                        ...profile.settings,
                        [isBaidu ? 'modelType' : 'model']: event.target.value,
                      },
                    }))
                  }
                >
                  {!selectedModels.some((model) => model.id === defaultModelValue) && defaultModelValue ? (
                    <option value={defaultModelValue}>{defaultModelValue}</option>
                  ) : null}
                  {selectedModels.length === 0 ? <option value="">请先在管理中添加模型</option> : null}
                  {selectedModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="provider-center-model-board">
                {selectedModels.length === 0 ? (
                  <span className="muted-text">暂无已添加模型。点击"管理"后从远端模型池中选择。</span>
                ) : (
                  selectedModels.map((model) => (
                    <div key={model.id} className="provider-center-model-row">
                      <div className="provider-center-model-copy">
                        <strong>{model.label}</strong>
                        <span>{getModelSourceLabel(model.source)}</span>
                      </div>
                      <label className="provider-center-model-rpm">
                        <span>RPM</span>
                        <input
                          aria-label={`${model.label} RPM 限制`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={model.rpmLimit || ''}
                          onChange={(event) => {
                            const value = Math.max(0, Math.floor(Number(event.target.value) || 0));
                            updateProfile((profile) => ({
                              ...profile,
                              models: profile.models.map((m) => (m.id === model.id ? { ...m, rpmLimit: value } : m)),
                            }));
                          }}
                        />
                      </label>
                      <div className="provider-center-model-status">{model.enabled ? '可用' : '停用'}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="provider-center-model-footer">
                <button
                  className="provider-inline-button provider-inline-button-primary"
                  type="button"
                  onClick={() => setModelManagerOpen(true)}
                >
                  管理
                </button>
              </div>
            </section>

            {isBaidu ? (
              <section className="provider-center-section">
                <div className="provider-center-section-heading">
                  <div>
                    <h4>Baidu 专属配置</h4>
                  </div>
                </div>
                <div className="provider-center-grid">
                  <label className="field">
                    <span>modelType</span>
                    <input
                      aria-label="modelType"
                      type="text"
                      value={activeProfile.settings.modelType ?? ''}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          settings: {
                            ...profile.settings,
                            modelType: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>reference</span>
                    <input
                      aria-label="reference"
                      type="text"
                      value={activeProfile.settings.reference ?? ''}
                      onChange={(event) =>
                        updateProfile((profile) => ({
                          ...profile,
                          settings: {
                            ...profile.settings,
                            reference: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="field field-checkbox provider-center-checkbox-row">
                  <input
                    aria-label="punctuationPreprocessing"
                    className="field-checkbox-input"
                    type="checkbox"
                    checked={activeProfile.settings.punctuationPreprocessing === 'true'}
                    onChange={(event) =>
                      updateProfile((profile) => ({
                        ...profile,
                        settings: {
                          ...profile.settings,
                          punctuationPreprocessing: event.target.checked ? 'true' : '',
                        },
                      }))
                    }
                  />
                  <div className="field-checkbox-copy">
                    <span className="field-checkbox-title">punctuationPreprocessing</span>
                  </div>
                </label>
              </section>
            ) : null}
          </>
        ) : null}

        <footer className="provider-center-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={disableSave || saveAction.isPending}
            onClick={() =>
              void saveAction.run(async () => {
                await onSave(draft);
              }).catch((error) => {
                toast.error(error instanceof Error ? error.message : '保存失败');
              })
            }
          >
            {saveAction.isPending ? '保存中…' : '保存配置'}
          </button>
        </footer>

        {selectedRef && activeProfile ? (
          <ModelManagerDialog
            isOpen={modelManagerOpen}
            family={selectedRef.family}
            profile={activeProfile}
            onClose={() => setModelManagerOpen(false)}
            onLoadCatalog={async (family, profileId) => {
              const result = await onLoadModelCatalog(family, profileId, activeProfile);
              updateProfile(() => result.profile);
              toast.info(result.summary);
              return result;
            }}
            onApply={(models) => {
              updateProfile((profile) => ({
                ...profile,
                models,
                settings: {
                  ...profile.settings,
                  ...(models.some((model) => model.id === defaultModelValue)
                    ? {}
                    : {
                        [isBaidu ? 'modelType' : 'model']: models[0]?.id ?? '',
                      }),
                },
              }));
            }}
          />
        ) : null}

        {createModalOpen ? (
          <div className="provider-center-create-backdrop">
            <section className="provider-center-create-modal" role="dialog" aria-label="添加提供商" aria-modal="true">
              <div className="provider-center-create-header">
                <h3>添加提供商</h3>
              </div>

              <div className="provider-center-create-body">
                <div className="provider-center-create-avatar">{providerIcon(createDraft.type)}</div>
                <label className="field">
                  <span>提供商名称</span>
                  <input
                    aria-label="提供商名称"
                    type="text"
                    placeholder="例如 OpenAI"
                    value={createDraft.name}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>提供商类型</span>
                  <select
                    aria-label="提供商类型"
                    value={createDraft.type}
                    onChange={(event) =>
                      setCreateDraft((current) => ({
                        ...current,
                        type: event.target.value as ProviderTypeOption,
                      }))
                    }
                  >
                    {providerTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <footer className="provider-center-create-footer">
                <button className="ghost-button" type="button" onClick={() => setCreateModalOpen(false)}>
                  取消
                </button>
                <button className="primary-button" type="button" onClick={createProviderProfile}>
                  创建
                </button>
              </footer>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
