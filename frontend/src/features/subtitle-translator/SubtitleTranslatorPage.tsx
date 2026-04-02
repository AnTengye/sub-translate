import { useEffect, useMemo, useReducer, useState } from 'react';
import { useToast } from '../../components/ui/feedback/useToast';
import { createTranslationRun, executeWorkflowNode, finalizeTranslationRun } from '../../lib/providers/registry';
import { serializeSrt } from '../../lib/subtitle/srt';
import type { SubtitleEntry } from '../../lib/subtitle/types';
import { ActivityConsole } from './components/ActivityConsole';
import { ProviderCenter } from './components/ProviderCenter';
import { UploadScreen } from './components/UploadScreen';
import { WorkflowTemplatePanel } from './components/WorkflowTemplatePanel';
import { useFileImport } from './hooks/useFileImport';
import {
  checkProviderProfile,
  fetchProviderCenterState,
  fetchProviderProfileModelCatalog,
  saveProviderCenterState,
} from './provider-center-api';
import { createInitialState, subtitleTranslatorReducer } from './state/reducer';
import { buildProviderRequestConfig, buildProviderTargetOptions, type ProviderTarget } from './target-selection';
import { executeWorkflowTemplate, type WorkflowCandidateTrack, type WorkflowJudgeDecision } from './utils/workflow';
import { fetchWorkflowTemplates, saveWorkflowTemplates } from './workflow-api';
import type { WorkflowTemplate } from './workflow-types';

function buildDisplay(entries: SubtitleEntry[], texts: string[]) {
  return entries.map((entry, index) => {
    const translated = texts[index] ?? '';
    return {
      ...entry,
      translated,
      status: translated && translated !== '[翻译失败]' ? ('done' as const) : ('error' as const),
    };
  });
}

function buildCandidateText(
  tracks: WorkflowCandidateTrack[],
  selectedTrackByEntry: string[],
  fallbackTexts: string[],
) {
  return fallbackTexts.map((fallback, index) => {
    const selectedKey = selectedTrackByEntry[index];
    const track = tracks.find((item) => item.key === selectedKey);
    return track?.texts[index] ?? fallback;
  });
}

function findTemplateWithDraft(
  templates: WorkflowTemplate[],
  activeTemplateId: string | null,
  draft: WorkflowTemplate | null,
) {
  if (!draft || !activeTemplateId) {
    return templates;
  }

  return templates.map((template) => (template.id === activeTemplateId ? draft : template));
}

function findFirstRunnableTarget(template: WorkflowTemplate | null): ProviderTarget | null {
  if (!template) {
    return null;
  }

  for (const stage of template.stages) {
    for (const node of stage.nodes) {
      if (node.enabled && node.target) {
        return node.target;
      }
    }
  }

  return null;
}

export default function SubtitleTranslatorPage() {
  const [state, dispatch] = useReducer(subtitleTranslatorReducer, undefined, createInitialState);
  const [busy, setBusy] = useState(false);
  const [candidateTracks, setCandidateTracks] = useState<WorkflowCandidateTrack[]>([]);
  const [judgeDecisions, setJudgeDecisions] = useState<WorkflowJudgeDecision[]>([]);
  const [selectedTrackByEntry, setSelectedTrackByEntry] = useState<string[]>([]);
  const [fallbackTexts, setFallbackTexts] = useState<string[]>([]);
  const [isProviderCenterOpen, setIsProviderCenterOpen] = useState(false);
  const toast = useToast();
  const { importFile } = useFileImport(dispatch);

  useEffect(() => {
    let active = true;

    Promise.all([fetchProviderCenterState(), fetchWorkflowTemplates()])
      .then(([providerCenter, workflowTemplates]) => {
        if (!active) {
          return;
        }

        dispatch({ type: 'hydrateProviderCenter', providerCenter });
        dispatch({ type: 'hydrateWorkflowTemplates', workflowTemplates });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        dispatch({
          type: 'fileLoadFailed',
          error: error instanceof Error ? error.message : '初始化工作台失败',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const providerOptions = useMemo(
    () => buildProviderTargetOptions(state.providerCenter),
    [state.providerCenter],
  );

  if (state.step === 'upload') {
    return <UploadScreen error={state.error} onFileSelected={importFile} />;
  }

  const doneCount = state.display.filter((entry) => entry.status === 'done').length;
  const errorCount = state.display.filter((entry) => entry.status === 'error').length;

  async function handleSaveWorkflowTemplate() {
    const nextState = {
      version: 1 as const,
      templates: findTemplateWithDraft(
        state.workflowTemplates.templates,
        state.activeTemplateId,
        state.workflowDraft,
      ),
    };

    const saved = await saveWorkflowTemplates(nextState);
    dispatch({ type: 'hydrateWorkflowTemplates', workflowTemplates: saved });
    if (state.activeTemplateId) {
      dispatch({ type: 'selectWorkflowTemplate', templateId: state.activeTemplateId });
    }
    toast.success('工作流模板已保存');
  }

  async function handleStartWorkflow() {
    if (!state.workflowDraft) {
      dispatch({ type: 'setError', error: '请先选择工作流模板' });
      return;
    }

    const target = findFirstRunnableTarget(state.workflowDraft);
    const primaryRequest = buildProviderRequestConfig(
      state.providerCenter,
      target,
      state.translationConfig.temperature,
    );
    if (!primaryRequest) {
      dispatch({ type: 'setError', error: '请先为工作流节点配置可用模型' });
      return;
    }

    setBusy(true);
    setCandidateTracks([]);
    setJudgeDecisions([]);
    setSelectedTrackByEntry([]);
    setFallbackTexts([]);
    dispatch({ type: 'startTranslation' });
    
    dispatch({
      type: 'appendLog',
      log: {
        t: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        msg: `▶️ 工作流启动，共 ${state.entries.length} 条字幕需要处理`,
      },
    });

    const controller = new AbortController();
    let runId: string | null = null;
    const workflowStartTime = Date.now();

    try {
      const run = await createTranslationRun(
        {
          fileName: state.fileName,
          provider: primaryRequest.provider,
          profileId: primaryRequest.profileId ?? undefined,
          totalEntries: state.entries.length,
          entries: state.entries.map((entry) => ({
            idx: entry.idx,
            timecode: entry.timecode,
            text: entry.text,
          })),
          providerConfig: primaryRequest.config,
          translationConfig: state.translationConfig,
          mode: 'translate',
        },
        controller.signal,
      );
      const activeRunId = run.runId;
      runId = activeRunId;

      const result = await executeWorkflowTemplate(state.entries, state.workflowDraft, {
        batchSize: state.translationConfig.batchSize,
        contextLines: state.translationConfig.contextLines,
        onLog: (message) =>
          dispatch({
            type: 'appendLog',
            log: {
              t: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
              msg: message,
            },
          }),
        executeNode: async (request) => {
          const targetConfig = buildProviderRequestConfig(
            state.providerCenter,
            request.node.target,
            state.translationConfig.temperature,
          );
          if (!targetConfig) {
            throw new Error(`节点 ${request.node.label} 未配置`);
          }

          return executeWorkflowNode(
            targetConfig.provider,
            {
              operation: request.operation,
              profileId: targetConfig.profileId,
              texts: request.texts,
              contextTexts: request.contextTexts,
              draftTexts: request.draftTexts,
              candidateSets: request.candidateSets,
              batch: {
                kind: 'translate',
                sequence: 1,
                startIndex: 0,
                endIndex: Math.max(request.texts.length - 1, 0),
                totalEntries: state.entries.length,
              },
              runId: activeRunId,
              config: {
                ...targetConfig.config,
                ...(request.node.prompt ? { prompt: request.node.prompt } : {}),
              },
              runtimeOverrides: targetConfig.runtimeOverrides,
            },
            controller.signal,
          );
        },
      });

      const nextFallbackTexts = result.finalTexts;
      const nextSelectedTracks =
        result.selectedTrackByEntry.length > 0
          ? result.selectedTrackByEntry
          : state.entries.map(() => 'current');
      const displayTexts =
        result.candidateTracks.length > 1
          ? buildCandidateText(result.candidateTracks, nextSelectedTracks, nextFallbackTexts)
          : nextFallbackTexts;

      setCandidateTracks(result.candidateTracks);
      setJudgeDecisions(result.judgeDecisions);
      setSelectedTrackByEntry(nextSelectedTracks);
      setFallbackTexts(nextFallbackTexts);
      dispatch({ type: 'translationDone', display: buildDisplay(state.entries, displayTexts) });

      const totalDuration = ((Date.now() - workflowStartTime) / 1000).toFixed(1);
      dispatch({
        type: 'appendLog',
        log: {
          t: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          msg: `🏁 工作流执行完毕，总耗时 ${totalDuration}s`,
        },
      });

      await finalizeTranslationRun(
        activeRunId,
        {
          status: 'completed',
          summary: {
            translatedCount: displayTexts.filter(Boolean).length,
          },
        },
        controller.signal,
      );
    } catch (error) {
      dispatch({
        type: 'translationFailed',
        error: error instanceof Error ? error.message : '工作流执行失败',
      });
      if (runId) {
        await finalizeTranslationRun(
          runId,
          {
            status: 'failed',
            error: {
              message: error instanceof Error ? error.message : '工作流执行失败',
            },
          },
          controller.signal,
        ).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleNodeTargetChange(stageId: string, nodeId: string, value: string) {
    const [family, profileId, modelId] = value.split('::');
    dispatch({
      type: 'setWorkflowNodeTarget',
      stageId,
      nodeId,
      target:
        family && profileId && modelId
          ? {
              family: family as ProviderTarget['family'],
              profileId,
              modelId,
            }
          : null,
    });
  }

  function handleCandidateOverride(index: number, nextKey: string) {
    const nextSelection = selectedTrackByEntry.slice();
    nextSelection[index] = nextKey;
    setSelectedTrackByEntry(nextSelection);
    dispatch({
      type: 'setDisplay',
      display: buildDisplay(
        state.entries,
        buildCandidateText(candidateTracks, nextSelection, fallbackTexts),
      ),
    });
  }

  function downloadResult() {
    const blob = new Blob([`\ufeff${serializeSrt(state.display)}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.fileName.replace(/\.[^.]+$/, '.zh.srt');
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="workspace-shell">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">
            Sub<span>Lingo</span>
          </span>
        </div>

        <div className="file-badge" aria-label="工作区概览">
          <strong>{state.fileName}</strong>
          <div className="dot" />
          <span>字幕总数</span>
          <strong>{state.display.length}</strong>
        </div>

        <div className="header-actions">
          <button className="provider-btn" type="button" onClick={() => setIsProviderCenterOpen(true)}>
            Provider 中心
          </button>
          <button className="provider-btn" type="button" onClick={() => dispatch({ type: 'reset' })}>
            重新上传
          </button>
          <button className="provider-btn" type="button" onClick={downloadResult}>
            导出字幕
          </button>
        </div>
      </header>

      <div className="main">
        <WorkflowTemplatePanel
          workflowTemplates={state.workflowTemplates}
          activeTemplateId={state.activeTemplateId}
          workflowDraft={state.workflowDraft}
          providerOptions={providerOptions}
          batchSize={state.translationConfig.batchSize}
          contextLines={state.translationConfig.contextLines}
          temperature={state.translationConfig.temperature}
          busy={busy}
          onTemplateChange={(templateId) => dispatch({ type: 'selectWorkflowTemplate', templateId })}
          onBatchSizeChange={(value) =>
            dispatch({ type: 'updateTranslationConfig', key: 'batchSize', value })
          }
          onContextLinesChange={(value) =>
            dispatch({ type: 'updateTranslationConfig', key: 'contextLines', value })
          }
          onTemperatureChange={(value) =>
            dispatch({ type: 'updateTranslationConfig', key: 'temperature', value })
          }
          onNodeTargetChange={handleNodeTargetChange}
          onSave={handleSaveWorkflowTemplate}
          onStart={handleStartWorkflow}
        />

        <section className="content workflow-content">
          <div className="stats-row" aria-label="结果摘要">
            <div className="stat-card completed">
              <div className="stat-label">已完成</div>
              <div className="stat-val">{doneCount}</div>
              <div className="stat-sub">已处理 {doneCount} 条</div>
            </div>
            <div className="stat-card pending">
              <div className="stat-label">待处理</div>
              <div className="stat-val">{Math.max(state.display.length - doneCount - errorCount, 0)}</div>
              <div className="stat-sub">工作流阶段推进中</div>
            </div>
            <div className="stat-card pending">
              <div className="stat-label">候选路径</div>
              <div className="stat-val">{candidateTracks.length || 1}</div>
              <div className="stat-sub">当前模板输出路径</div>
            </div>
            <div className="stat-card filtered">
              <div className="stat-label">评估建议</div>
              <div className="stat-val">{judgeDecisions.length}</div>
              <div className="stat-sub">judge 返回条目</div>
            </div>
          </div>

          {judgeDecisions.length > 0 ? (
            <section className="judge-summary-card">
              <div className="section-title">推荐结果</div>
              <div className="judge-summary-list">
                {judgeDecisions.map((decision, index) => (
                  <div key={`${decision.winner}-${index}`} className="judge-summary-item">
                    <strong>条目 {index + 1}</strong>
                    <span>{decision.reason}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {state.error ? <p className="error-banner">{state.error}</p> : null}

          <ActivityConsole logs={state.logs} />

          <div className="sub-list workflow-sub-list">
            {state.display.map((entry, index) => (
              <div key={`${entry.idx}-${entry.timecode}`} className="sub-card">
                <div className="sub-card-header">
                  <div className="sub-meta">
                    <span className="sub-index">#{entry.idx}</span>
                    <span className="sub-time">{entry.timecode}</span>
                  </div>
                  <span className={`sub-status ${entry.status === 'done' ? 'done' : 'failed'}`}>
                    {entry.status === 'done' ? '已完成' : '待处理'}
                  </span>
                </div>
                <div className="sub-body">
                  <div className="sub-col">
                    <div className="sub-col-label">
                      <span className="flag">JA</span> 原文
                    </div>
                    <div className="sub-text">{entry.text}</div>
                  </div>
                  <div className="sub-col">
                    <div className="sub-col-label">
                      <span className="flag">ZH</span> 译文
                    </div>
                    <div className="sub-text translated">{entry.translated || '待翻译…'}</div>
                    {candidateTracks.length > 1 ? (
                      <label className="candidate-switcher">
                        <span>候选选择</span>
                        <select
                          aria-label={`条目 ${entry.idx} 候选选择`}
                          className="workflow-select"
                          value={selectedTrackByEntry[index] ?? ''}
                          onChange={(event) => handleCandidateOverride(index, event.target.value)}
                        >
                          {candidateTracks.map((track) => (
                            <option key={track.key} value={track.key}>
                              {track.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ProviderCenter
        isOpen={isProviderCenterOpen}
        initialProvider={state.providerCenter?.defaultProvider ?? 'openai-compatible'}
        providerCenter={state.providerCenter}
        disableSave={false}
        onClose={() => setIsProviderCenterOpen(false)}
        onSave={async (draft) => {
          const saved = await saveProviderCenterState(draft);
          dispatch({ type: 'hydrateProviderCenter', providerCenter: saved });
          setIsProviderCenterOpen(false);
          toast.success('Provider 配置已保存');
        }}
        onCheck={async (family, profileId, profile) => {
          const result = await checkProviderProfile(family, profileId, profile);
          return result.profile;
        }}
        onLoadModelCatalog={async (family, profileId, profile) => {
          return fetchProviderProfileModelCatalog(family, profileId, profile);
        }}
      />
    </main>
  );
}
