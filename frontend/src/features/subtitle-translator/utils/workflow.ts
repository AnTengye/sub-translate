function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

import type { WorkflowTemplate, WorkflowTemplateNode } from '../workflow-types';

const failurePlaceholder = '[翻译失败]';

function maybeDelay(delayMs: number | undefined) {
  if (!delayMs || delayMs <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

interface WorkflowSourceEntry {
  idx: number;
  timecode: string;
  text: string;
}

export interface WorkflowCandidateTrack {
  key: string;
  label: string;
  texts: string[];
}

export interface WorkflowJudgeDecision {
  winner: string;
  reason: string;
  scores?: Record<string, number>;
}

export interface WorkflowNodeRequest {
  operation: 'translate' | 'review' | 'judge';
  node: WorkflowTemplateNode;
  texts: string[];
  contextTexts: string[];
  draftTexts?: string[];
  candidateSets?: WorkflowCandidateTrack[];
}

export interface WorkflowNodeResponse {
  translations: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionSnapshot {
  version: 1;
  stageIndex: number;
  nodeIndex: number;
  batchIndex: number;
  completedBatches: number;
  pauseReason?: 'user' | 'interrupted';
  currentTexts: string[];
  candidateTracks: WorkflowCandidateTrack[];
  judgeDecisions: WorkflowJudgeDecision[];
  selectedTrackByEntry: string[];
  nodeRuntime: Record<string, { consecutiveRateLimitHits: number; lastError: string | null; status: 'idle' | 'running' | 'interrupted' }>;
}

export class WorkflowPausedError extends Error {
  snapshot: WorkflowExecutionSnapshot;

  constructor(snapshot: WorkflowExecutionSnapshot) {
    super('workflow paused');
    this.name = 'WorkflowPausedError';
    this.snapshot = snapshot;
  }
}

export function isWorkflowPausedError(error: unknown): error is WorkflowPausedError {
  return error instanceof WorkflowPausedError;
}

interface ExecuteWorkflowTemplateOptions {
  batchSize: number;
  contextLines: number;
  delayMs?: number;
  onLog: (message: string) => void;
  onProgress?: (texts: string[]) => void;
  signal?: AbortSignal;
  initialSnapshot?: WorkflowExecutionSnapshot;
  shouldPause?: (snapshot: WorkflowExecutionSnapshot) => boolean;
  rateLimitInterruptThreshold?: number;
  executeNode: (request: WorkflowNodeRequest) => Promise<WorkflowNodeResponse>;
}

export interface WorkflowExecutionResult {
  finalTexts: string[];
  candidateTracks: WorkflowCandidateTrack[];
  judgeDecisions: WorkflowJudgeDecision[];
  selectedTrackByEntry: string[];
  snapshot: WorkflowExecutionSnapshot;
}

function isFailed(text: string | undefined) {
  return !text || text === failurePlaceholder;
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('cancelled');
  }
}

function getContextBefore(texts: string[], beforeIndex: number, count: number) {
  if (count <= 0) {
    return [];
  }

  const context: string[] = [];
  for (let index = beforeIndex - 1; index >= 0 && context.length < count; index -= 1) {
    const value = texts[index];
    if (!isFailed(value)) {
      context.unshift(value);
    }
  }

  return context;
}

function normalizeTranslations(values: string[], count: number) {
  return Array.from({ length: count }, (_, index) => values[index] ?? failurePlaceholder);
}

function parseJudgeDecisions(metadata: Record<string, unknown> | undefined): WorkflowJudgeDecision[] {
  const raw = metadata?.decisions;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const object = (item ?? {}) as Record<string, unknown>;
    return {
      winner: String(object.winner ?? ''),
      reason: String(object.reason ?? ''),
      scores:
        object.scores && typeof object.scores === 'object'
          ? (object.scores as Record<string, number>)
          : undefined,
    };
  });
}

function buildSnapshot(
  stageIndex: number,
  nodeIndex: number,
  batchIndex: number,
  completedBatches: number,
  pauseReason: WorkflowExecutionSnapshot['pauseReason'],
  currentTexts: string[],
  candidateTracks: WorkflowCandidateTrack[],
  judgeDecisions: WorkflowJudgeDecision[],
  selectedTrackByEntry: string[],
  nodeRuntime: WorkflowExecutionSnapshot['nodeRuntime'],
): WorkflowExecutionSnapshot {
  return {
    version: 1,
    stageIndex,
    nodeIndex,
    batchIndex,
    completedBatches,
    pauseReason,
    currentTexts: currentTexts.slice(),
    candidateTracks: candidateTracks.map((track) => ({ ...track, texts: track.texts.slice() })),
    judgeDecisions: judgeDecisions.map((decision) => ({ ...decision, scores: decision.scores ? { ...decision.scores } : undefined })),
    selectedTrackByEntry: selectedTrackByEntry.slice(),
    nodeRuntime: Object.fromEntries(
      Object.entries(nodeRuntime).map(([key, value]) => [key, { ...value }]),
    ),
  };
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('rate limit') || message.includes('429') || message.includes('rpm') || message.includes('rpd') || message.includes('限流');
}

export async function executeWorkflowTemplate(
  entries: WorkflowSourceEntry[],
  template: WorkflowTemplate,
  options: ExecuteWorkflowTemplateOptions,
): Promise<WorkflowExecutionResult> {
  const initialSnapshot = options.initialSnapshot;
  let currentTexts = initialSnapshot?.currentTexts.slice() ?? entries.map(() => failurePlaceholder);
  let candidateTracks: WorkflowCandidateTrack[] = initialSnapshot?.candidateTracks.map((track) => ({ ...track, texts: track.texts.slice() })) ?? [];
  let judgeDecisions: WorkflowJudgeDecision[] = initialSnapshot?.judgeDecisions.map((decision) => ({ ...decision, scores: decision.scores ? { ...decision.scores } : undefined })) ?? [];
  let selectedTrackByEntry = initialSnapshot?.selectedTrackByEntry.slice() ?? entries.map(() => '');
  let completedBatches = initialSnapshot?.completedBatches ?? 0;
  let nodeRuntime = Object.fromEntries(
    Object.entries(initialSnapshot?.nodeRuntime ?? {}).map(([key, value]) => [key, { ...value }]),
  ) as WorkflowExecutionSnapshot['nodeRuntime'];
  const interruptThreshold = options.rateLimitInterruptThreshold ?? 3;

  for (let stageIndex = initialSnapshot?.stageIndex ?? 0; stageIndex < template.stages.length; stageIndex++) {
    const stage = template.stages[stageIndex];
    ensureNotAborted(options.signal);
    const nodes = stage.nodes.filter((node) => node.enabled);
    if (nodes.length === 0) {
      continue;
    }

    if (stage.type === 'translate' && stage.execution === 'serial' && stage.strategy === 'fallback') {
      const nextTexts = currentTexts.slice();
      let pendingIndices = entries.map((_, index) => index);

      for (let nodeIndex = stageIndex === (initialSnapshot?.stageIndex ?? -1) ? initialSnapshot?.nodeIndex ?? 0 : 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        if (pendingIndices.length === 0) {
          break;
        }

        const startTime = Date.now();
        const batches = chunkArray(pendingIndices, options.batchSize);
        options.onLog(`📦 节点 [${node.label}] 串行翻译，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
        
        let hasFailure = false;
        const startBatchIndex = stageIndex === (initialSnapshot?.stageIndex ?? -1) && nodeIndex === (initialSnapshot?.nodeIndex ?? -1) ? initialSnapshot?.batchIndex ?? 0 : 0;
        for (let batchIdx = startBatchIndex; batchIdx < batches.length; batchIdx++) {
          ensureNotAborted(options.signal);
          const batchIndices = batches[batchIdx];
          const runtimeKey = `${stage.id}::${node.id}`;
          nodeRuntime[runtimeKey] = nodeRuntime[runtimeKey] ?? {
            consecutiveRateLimitHits: 0,
            lastError: null,
            status: 'idle',
          };
          nodeRuntime[runtimeKey].status = 'running';
          options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batchIndices[0] + 1}–${batchIndices[batchIndices.length - 1] + 1}`);
          
          try {
            const response = await options.executeNode({
              operation: 'translate',
              node,
              texts: batchIndices.map((index) => entries[index].text),
              contextTexts: getContextBefore(nextTexts, batchIndices[0] ?? 0, options.contextLines),
            });

            const translated = normalizeTranslations(response.translations, batchIndices.length);
            translated.forEach((text, index) => {
              nextTexts[batchIndices[index]] = text;
            });
            nodeRuntime[runtimeKey] = {
              consecutiveRateLimitHits: 0,
              lastError: null,
              status: 'idle',
            };
          } catch (batchError) {
            hasFailure = true;
            options.onLog(`  ❌ 批次 ${batchIdx + 1} 失败: ${batchError instanceof Error ? batchError.message : '未知错误'}`);
            if (isRateLimitError(batchError)) {
              nodeRuntime[runtimeKey].consecutiveRateLimitHits += 1;
              nodeRuntime[runtimeKey].lastError = batchError instanceof Error ? batchError.message : 'rate limit';
              options.onLog(`  ⚠️ 限流命中 ${nodeRuntime[runtimeKey].consecutiveRateLimitHits}/${interruptThreshold}`);
              if (nodeRuntime[runtimeKey].consecutiveRateLimitHits >= interruptThreshold) {
                nodeRuntime[runtimeKey].status = 'interrupted';
                const snapshot = buildSnapshot(stageIndex, nodeIndex, batchIdx, completedBatches, 'interrupted', nextTexts, candidateTracks, judgeDecisions, selectedTrackByEntry, nodeRuntime);
                options.onLog(`⛔ 节点 [${node.label}] 已中断，等待恢复后继续`);
                throw new WorkflowPausedError(snapshot);
              }
            } else {
              nodeRuntime[runtimeKey].lastError = batchError instanceof Error ? batchError.message : '未知错误';
            }
          }
          
          pendingIndices = pendingIndices.filter((index) => isFailed(nextTexts[index]));
          options.onProgress?.(nextTexts);
          completedBatches += 1;
          const snapshot = buildSnapshot(stageIndex, nodeIndex, batchIdx + 1, completedBatches, 'user', nextTexts, candidateTracks, judgeDecisions, selectedTrackByEntry, nodeRuntime);
          if (options.shouldPause?.(snapshot)) {
            throw new WorkflowPausedError(snapshot);
          }
          if (pendingIndices.length === 0) break;
          if (batchIdx < batches.length - 1) {
            await maybeDelay(options.delayMs);
          }
        }

        if (hasFailure && pendingIndices.length > 0 && nodes.indexOf(node) < nodes.length - 1) {
          options.onLog(`⚠️ 节点 [${node.label}] 存在失败批次，提前切换备选节点处理剩余 ${pendingIndices.length} 条`);
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const successCount = nextTexts.filter(t => !isFailed(t)).length;
        options.onLog(`✅ 节点 [${node.label}] 串行翻译完成 (${successCount}/${nextTexts.length} 成功, 耗时 ${duration}s)`);
      }

      currentTexts = nextTexts;
      candidateTracks = [
        {
          key: 'current',
          label: '当前结果',
          texts: currentTexts,
        },
      ];
      selectedTrackByEntry = entries.map(() => 'current');
      continue;
    }

    if (stage.type === 'translate' && stage.execution === 'parallel' && stage.strategy === 'keep-all') {
      options.onLog(`🚀 开始并行翻译阶段: ${nodes.map(n => n.label).join(', ')}`);
      const trackResponses = await Promise.all(
        nodes.map(async (node) => {
          const startTime = Date.now();
          const batches = chunkArray(entries, options.batchSize);
          options.onLog(`📦 节点 [${node.label}] 并行翻译，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
          
          const allTranslations: string[] = [];
          for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            ensureNotAborted(options.signal);
            const batch = batches[batchIdx];
            options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
             
            const response = await options.executeNode({
              operation: 'translate',
              node,
              texts: batch.map((entry) => entry.text),
              contextTexts: getContextBefore(allTranslations, batchIdx * options.batchSize, options.contextLines),
            });
            allTranslations.push(...response.translations);
            options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
            if (batchIdx < batches.length - 1) {
              await maybeDelay(options.delayMs);
            }
          }
          
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          const translated = normalizeTranslations(allTranslations, entries.length);
          const successCount = translated.filter(t => !isFailed(t)).length;
          options.onLog(`✅ 节点 [${node.label}] 并行翻译完成 (${successCount}/${entries.length} 成功, 耗时 ${duration}s)`);

          return {
            key: node.id,
            label: node.label,
            texts: translated,
          } satisfies WorkflowCandidateTrack;
        }),
      );

      candidateTracks = trackResponses;
      if (trackResponses[0]) {
        currentTexts = trackResponses[0].texts.slice();
        selectedTrackByEntry = entries.map(() => trackResponses[0].key);
      }
      continue;
    }

    if (stage.type === 'judge') {
      const node = nodes[0];
      options.onLog(`⚖️ 开始评估阶段: 节点 [${node.label}]`);
      const startTime = Date.now();
      
      const batches = chunkArray(entries, options.batchSize);
      options.onLog(`📦 评估，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
      
      const allDecisions: WorkflowJudgeDecision[] = [];
      const allTranslations: string[] = [];
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        ensureNotAborted(options.signal);
        const batch = batches[batchIdx];
        options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
        
        const response = await options.executeNode({
          operation: 'judge',
          node,
          texts: batch.map((entry) => entry.text),
          contextTexts: [],
          candidateSets: candidateTracks,
        });
        
        const decisions = parseJudgeDecisions(response.metadata);
        allDecisions.push(...decisions);
        allTranslations.push(...response.translations);
        options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
        if (batchIdx < batches.length - 1) {
          await maybeDelay(options.delayMs);
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      judgeDecisions = allDecisions;
      currentTexts = normalizeTranslations(allTranslations, entries.length);
      selectedTrackByEntry = judgeDecisions.map((decision) => decision.winner);
      options.onLog(`✅ 评估完成 (耗时 ${duration}s)`);
      continue;
    }

    if (stage.type === 'review') {
      for (const node of nodes) {
        options.onLog(`🔍 开始审校阶段: 节点 [${node.label}]`);
        const startTime = Date.now();
        
        const batches = chunkArray(entries, options.batchSize);
        options.onLog(`📦 审校，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
        
        const allTranslations: string[] = [];
        let processedCount = 0;
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          ensureNotAborted(options.signal);
          const batch = batches[batchIdx];
          options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
          
          const batchDrafts = batch.map((_, index) => {
            return currentTexts[processedCount + index] ?? '[翻译失败]';
          });
          const response = await options.executeNode({
            operation: 'review',
            node,
            texts: batch.map((entry) => entry.text),
            contextTexts: [],
            draftTexts: batchDrafts,
          });
          allTranslations.push(...response.translations);
          processedCount += batch.length;
          options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
          if (batchIdx < batches.length - 1) {
            await maybeDelay(options.delayMs);
          }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        currentTexts = normalizeTranslations(allTranslations, entries.length);
        options.onLog(`✅ 审校完成 (耗时 ${duration}s)`);
      }

      candidateTracks = [
        {
          key: 'current',
          label: '当前结果',
          texts: currentTexts,
        },
      ];
      selectedTrackByEntry = entries.map(() => 'current');
    }
  }

  return {
    finalTexts: currentTexts,
    candidateTracks,
    judgeDecisions,
    selectedTrackByEntry,
    snapshot: buildSnapshot(template.stages.length, 0, 0, completedBatches, undefined, currentTexts, candidateTracks, judgeDecisions, selectedTrackByEntry, nodeRuntime),
  };
}
