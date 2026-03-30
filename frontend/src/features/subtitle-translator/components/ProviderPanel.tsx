import { useEffect, useRef, useState, type Dispatch } from 'react';
import { buildProviderTargetOptions, getProfileByTarget, getEnabledModels, type ProviderTarget } from '../target-selection';
import type { SubtitleTranslatorAction } from '../state/reducer';
import type { SubtitleTranslatorState } from '../types';

interface ProviderPanelProps {
  state: SubtitleTranslatorState;
  dispatch: Dispatch<SubtitleTranslatorAction>;
  onStart: () => void | Promise<void>;
}

function selectedProfileValue(target: ProviderTarget | null) {
  return target?.profileId ?? '';
}

function selectedModelValue(target: ProviderTarget | null) {
  return target?.modelId ?? '';
}

interface SelectorOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectorProps {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder: string;
  options: SelectorOption[];
  onSelect: (value: string) => void;
}

function Selector({ label, value, disabled, placeholder, options, onSelect }: SelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="selector" ref={rootRef}>
      <span className="selector-label">{label}</span>
      <button
        type="button"
        className="selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="selector-trigger-copy">
          <strong>{selected?.label ?? placeholder}</strong>
          {selected?.description ? <span>{selected.description}</span> : null}
        </span>
        <span className="selector-trigger-icon">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div className="selector-menu" role="listbox" aria-label={`${label} 选项`}>
          {options.length === 0 ? (
            <div className="selector-empty">{placeholder}</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`selector-option${option.value === value ? ' active' : ''}`}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                <strong>{option.label}</strong>
                {option.description ? <span>{option.description}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ProviderPanel({ state, dispatch, onStart }: ProviderPanelProps) {
  const disableInputs = state.step === 'translating' || state.isRetrying || state.retryingIndex !== null;
  const primaryProfile = getProfileByTarget(state.providerCenter, state.primaryTarget);
  const fallbackProfile = getProfileByTarget(state.providerCenter, state.fallbackTarget);
  const targetOptions = buildProviderTargetOptions(state.providerCenter);

  const uniqueProfiles = Array.from(
    new Map(
      targetOptions.map((option) => [
        option.profileId,
        {
          family: option.family,
          profileId: option.profileId,
        },
      ]),
    ).values(),
  );
  const fallbackProfiles = uniqueProfiles.filter(
    (profileRef) =>
      !state.primaryTarget ||
      !(profileRef.family === state.primaryTarget.family && profileRef.profileId === state.primaryTarget.profileId),
  );

  const primaryModels = primaryProfile ? getEnabledModels(primaryProfile) : [];
  const fallbackModels = fallbackProfile ? getEnabledModels(fallbackProfile) : [];
  const primaryProfileOptions = uniqueProfiles
    .map((profileRef) => {
      const profile = state.providerCenter?.families[profileRef.family].profiles.find(
        (item) => item.id === profileRef.profileId,
      );
      if (!profile) {
        return null;
      }

      return {
        value: profile.id,
        label: profile.name,
        description: `${profile.settings.providerLabel || profile.family} · ${profile.health.summary}`,
      };
    })
    .filter(Boolean) as SelectorOption[];
  const fallbackProfileOptions = fallbackProfiles
    .map((profileRef) => {
      const profile = state.providerCenter?.families[profileRef.family].profiles.find(
        (item) => item.id === profileRef.profileId,
      );
      if (!profile) {
        return null;
      }

      return {
        value: profile.id,
        label: profile.name,
        description: `${profile.settings.providerLabel || profile.family} · ${profile.health.summary}`,
      };
    })
    .filter(Boolean) as SelectorOption[];
  const primaryModelOptions = primaryModels.map((model) => ({
    value: model.id,
    label: model.label,
    description: model.source,
  }));
  const fallbackModelOptions = fallbackModels.map((model) => ({
    value: model.id,
    label: model.label,
    description: model.source,
  }));

  function updateTarget(kind: 'primary' | 'fallback', profileId: string) {
    const option = targetOptions.find((item) => item.profileId === profileId);
    const actionType = kind === 'primary' ? 'setPrimaryTarget' : 'setFallbackTarget';
    dispatch({
      type: actionType,
      target: option
        ? {
            family: option.family,
            profileId: option.profileId,
            modelId: option.modelId,
          }
        : null,
    });
  }

  function updateModel(kind: 'primary' | 'fallback', modelId: string) {
    const currentTarget = kind === 'primary' ? state.primaryTarget : state.fallbackTarget;
    const actionType = kind === 'primary' ? 'setPrimaryTarget' : 'setFallbackTarget';
    if (!currentTarget) {
      return;
    }

    dispatch({
      type: actionType,
      target: {
        ...currentTarget,
        modelId,
      },
    });
  }

  return (
    <aside className="sidebar" aria-label="配置侧栏">
      <div className="sidebar-section sidebar-card">
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

        <div className="advanced-params-anchor">
          <button
            className="advanced-params-button"
            type="button"
            disabled={disableInputs}
            aria-haspopup="dialog"
            aria-expanded={state.advancedParamsOpen}
            onClick={() => dispatch({ type: 'toggleAdvancedParams' })}
          >
            高级参数
          </button>

          {state.advancedParamsOpen ? (
            <section className="advanced-params-popover" role="dialog" aria-label="高级参数">
              <div className="advanced-params-header">
                <strong>高级参数</strong>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => dispatch({ type: 'toggleAdvancedParams', open: false })}
                >
                  关闭
                </button>
              </div>

              <label className="config-item config-item-popover">
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
            </section>
          ) : null}
        </div>
      </div>

      <div className="sidebar-section sidebar-card">
        <div className="sidebar-label">主 Provider</div>
        <Selector
          label="主 Provider 配置"
          disabled={disableInputs || primaryProfileOptions.length === 0}
          value={selectedProfileValue(state.primaryTarget)}
          placeholder="暂无可用配置"
          options={primaryProfileOptions}
          onSelect={(value) => updateTarget('primary', value)}
        />
        <Selector
          label="主 Provider 模型"
          disabled={disableInputs || primaryModelOptions.length === 0}
          value={selectedModelValue(state.primaryTarget)}
          placeholder="请选择模型"
          options={primaryModelOptions}
          onSelect={(value) => updateModel('primary', value)}
        />
        <div className="provider-summary">
          <strong>{primaryProfile?.name ?? '未配置'}</strong>
          <span>{state.primaryTarget?.modelId ?? '请选择模型'}</span>
        </div>
      </div>

      <div className="sidebar-section sidebar-card">
        <div className="sidebar-label">失败备选</div>
        <Selector
          label="备选 Provider 配置"
          disabled={disableInputs || fallbackProfileOptions.length === 0}
          value={selectedProfileValue(state.fallbackTarget)}
          placeholder="暂无可用备选"
          options={fallbackProfileOptions}
          onSelect={(value) => updateTarget('fallback', value)}
        />
        <Selector
          label="备选 Provider 模型"
          disabled={disableInputs || fallbackModelOptions.length === 0}
          value={selectedModelValue(state.fallbackTarget)}
          placeholder="暂无可用备选"
          options={fallbackModelOptions}
          onSelect={(value) => updateModel('fallback', value)}
        />
        <div className="provider-summary">
          <strong>{fallbackProfile?.name ?? '暂无可用备选'}</strong>
          <span>{state.fallbackTarget?.modelId ?? '请先在 Provider Center 完成检测并添加模型'}</span>
        </div>
      </div>

      {state.step === 'config' ? (
        <button className="start-btn" type="button" onClick={onStart} disabled={!state.primaryTarget}>
          开始翻译
        </button>
      ) : null}
    </aside>
  );
}
