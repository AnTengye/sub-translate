import { listProviderDefinitions } from '../../../lib/providers/registry';
import type { ProviderId } from '../../../lib/providers/types';
import type { SubtitleTranslatorAction } from '../state/reducer';
import type { SubtitleTranslatorState } from '../types';

interface ProviderPanelProps {
  state: SubtitleTranslatorState;
  dispatch: React.Dispatch<SubtitleTranslatorAction>;
  onStart: () => void | Promise<void>;
  onCancelTranslation: () => void;
  onReset: () => void;
}

const providerDefinitions = listProviderDefinitions();

export function ProviderPanel({
  state,
  dispatch,
  onStart,
  onCancelTranslation,
  onReset,
}: ProviderPanelProps) {
  const activeProvider = providerDefinitions.find(
    (provider) => provider.id === state.provider,
  )!;

  const disableInputs = state.step === 'translating' || state.isRetrying || state.retryingIndex !== null;

  return (
    <aside className="sidebar">
      <section className="panel-card panel-card-emphasis">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Workspace</div>
            <div className="section-title">文件信息</div>
          </div>
        </div>
        <div className="file-meta">
          <strong>{state.fileName}</strong>
          <span>{state.entries.length} 条字幕待处理</span>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Provider</div>
            <div className="section-title">翻译引擎</div>
          </div>
        </div>
        <div className="provider-grid">
          {providerDefinitions.map((provider) => (
            <button
              key={provider.id}
              className={`provider-button${provider.id === state.provider ? ' active' : ''}`}
              type="button"
              disabled={disableInputs}
              onClick={() =>
                dispatch({ type: 'setProvider', provider: provider.id as ProviderId })
              }
            >
              <span
                className="provider-swatch"
                style={{ backgroundColor: provider.color }}
                aria-hidden="true"
              />
              <span className="provider-copy">
                <strong>{provider.label}</strong>
                <span>{provider.id.toUpperCase()}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="muted-text">{activeProvider.desc}</p>
        {activeProvider.corsNote ? <p className="warn-text">{activeProvider.corsNote}</p> : null}

        <div className="field-stack">
          {activeProvider.fields.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select
                  value={state.providerConfig[field.key] ?? activeProvider.defaults[field.key] ?? ''}
                  disabled={disableInputs}
                  onChange={(event) =>
                    dispatch({
                      type: 'updateProviderConfig',
                      key: field.key,
                      value: event.target.value,
                    })
                  }
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={field.label}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={state.providerConfig[field.key] ?? activeProvider.defaults[field.key] ?? ''}
                  disabled={disableInputs}
                  onChange={(event) =>
                    dispatch({
                      type: 'updateProviderConfig',
                      key: field.key,
                      value: event.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Tuning</div>
            <div className="section-title">翻译参数</div>
          </div>
        </div>
        <label className="field">
          <span>每批字幕数量</span>
          <input
            type="range"
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
          <strong className="field-value">{state.translationConfig.batchSize}</strong>
        </label>

        <label className="field">
          <span>上下文条数</span>
          <input
            type="range"
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
          <strong className="field-value">{state.translationConfig.contextLines}</strong>
        </label>

        {state.provider !== 'baidu' ? (
          <label className="field">
            <span>Temperature</span>
            <input
              type="range"
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
            <strong className="field-value">{state.translationConfig.temperature.toFixed(2)}</strong>
          </label>
        ) : null}
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Actions</div>
            <div className="section-title">操作</div>
          </div>
        </div>
        <div className="button-stack">
          {state.step === 'config' ? (
            <button className="primary-button" type="button" onClick={onStart}>
              开始翻译
            </button>
          ) : null}

          {state.step === 'translating' ? (
            <button className="secondary-button" type="button" onClick={onCancelTranslation}>
              取消翻译
            </button>
          ) : null}

          <button className="ghost-button" type="button" onClick={onReset}>
            重新上传
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">Activity</div>
            <div className="section-title">日志</div>
          </div>
        </div>
        <div className="log-list">
          {state.logs.length === 0 ? (
            <span className="muted-text">暂无日志</span>
          ) : (
            state.logs.slice(-8).map((log) => (
              <div key={`${log.t}-${log.msg}`} className="log-item">
                <span>{log.t}</span>
                <span>{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
