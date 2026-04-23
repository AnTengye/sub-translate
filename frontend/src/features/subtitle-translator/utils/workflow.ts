function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

import type { WorkflowTemplate, WorkflowTemplateNode } from '../workflow-types';
import type { TranslationBatchMetadata } from '../../../lib/providers/types';

const failurePlaceholder = '[翻译失败]';

export type ErrorCategory = 
  | 'auth'
  | 'rate_limit'
  | 'concurrency'
  | 'invalid_format'
  | 'server'
  | 'network'
  | 'invalid_result';

export function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  
  // Auth errors (403/401) - should fail fast
  if (lower.includes('403') || lower.includes('401') || lower.includes('forbidden') || lower.includes('not assigned')) {
    return 'auth';
  }
  
  // Rate limit errors (429) - should retry with backoff
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('cooling down') || lower.includes('限流')) {
    return 'rate_limit';
  }
  
  // Concurrency errors - should retry with delay
  if (lower.includes('too many concurrent') || lower.includes('concurrent request')) {
    return 'concurrency';
  }
  
  // Invalid format errors - upstream returned unexpected format
  if (lower.includes('invalid character') || lower.includes('unexpected token') || lower.includes('invalid result')) {
    return 'invalid_format';
  }
  
  // Server errors (5xx)
  if (/\b5\d{2}\b/.test(message)) {
    return 'server';
  }
  
  return 'network';
}

export function isFatalError(error: unknown): boolean {
  const category = classifyError(error);
  return category === 'auth'; // Auth errors should fail fast, require manual intervention
}

export function shouldRetry(error: unknown): boolean {
  const category = classifyError(error);
  return category === 'rate_limit' || category === 'concurrency' || category === 'network' || category === 'server';
}

function maybeDelay(delayMs: number | undefined) {
  if (!delayMs || delayMs <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

// NEW: Calculate adaptive delay based on recent failures
function calculateAdaptiveDelay(
  recentFailures: number,
  baseDelay: number,
): number {
  if (recentFailures >= 3) return baseDelay * 3;
  if (recentFailures >= 2) return baseDelay * 2;
  return baseDelay;
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
  batch: TranslationBatchMetadata;
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

export class SilentFailureError extends Error {
  batchIndex: number;
  batchSize: number;
  
  constructor(message: string, batchIndex: number, batchSize: number) {
    super(message);
    this.name = 'SilentFailureError';
    this.batchIndex = batchIndex;
    this.batchSize = batchSize;
  }
}

export function isSilentFailureError(error: unknown): error is SilentFailureError {
  return error instanceof SilentFailureError;
}

export class StageGateError extends Error {
  validation: StageValidationResult;
  
  constructor(message: string, validation: StageValidationResult) {
    super(message);
    this.name = 'StageGateError';
    this.validation = validation;
  }
}

export interface StageValidationResult {
  canProceed: boolean;
  successfulCount: number;
  failedCount: number;
  silentFailureCount: number;
  failedIndices: number[];
  blockers: string[];
}

export interface SilentFailureBatch {
  batchIndex: number;
  totalCount: number;
  successCount: number;
  errorCategory?: ErrorCategory;
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
  const category = classifyError(error);
  return category === 'rate_limit' || category === 'concurrency';
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
  
  // NEW: Track batch results for adaptive behavior
  const batchResults: Array<{successCount: number; totalCount: number; hasError: boolean; category?: ErrorCategory}> = [];
  let recentFailureCount = 0;

  for (let stageIndex = initialSnapshot?.stageIndex ?? 0; stageIndex < template.stages.length; stageIndex++) {
    const stage = template.stages[stageIndex];
    ensureNotAborted(options.signal);
    const nodes = stage.nodes.filter((node) => node.enabled);
    if (nodes.length === 0) {
      continue;
    }

    if (stage.type === 'translate' && stage.execution === 'serial' && stage.strategy === 'fallback') {
      const nextTexts = currentTexts.slice();
      const hasRecoveredTexts = nextTexts.some((text) => !isFailed(text));
      let pendingIndices = hasRecoveredTexts
        ? entries.flatMap((_, index) => (isFailed(nextTexts[index]) ? [index] : []))
        : entries.map((_, index) => index);

      for (let nodeIndex = stageIndex === (initialSnapshot?.stageIndex ?? -1) ? initialSnapshot?.nodeIndex ?? 0 : 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        if (pendingIndices.length === 0) {
          break;
        }

        const startTime = Date.now();
        const batches = chunkArray(pendingIndices, options.batchSize);
        options.onLog(`📦 节点 [${node.label}] 串行翻译，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
        
        let hasFailure = false;
        const startBatchIndex =
          hasRecoveredTexts
            ? 0
            : stageIndex === (initialSnapshot?.stageIndex ?? -1) && nodeIndex === (initialSnapshot?.nodeIndex ?? -1)
              ? initialSnapshot?.batchIndex ?? 0
              : 0;
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
              batch: {
                kind: 'translate',
                sequence: Math.floor((batchIndices[0] ?? 0) / options.batchSize) + 1,
                startIndex: batchIndices[0] ?? 0,
                endIndex: batchIndices[batchIndices.length - 1] ?? 0,
                totalEntries: entries.length,
              },
            });

            const translated = normalizeTranslations(response.translations, batchIndices.length);
            
            // NEW: Detect silent failure (HTTP 200 but 0 successful translations)
            const successCount = translated.filter(t => !isFailed(t)).length;
            if (successCount === 0 && translated.length > 0) {
              const silentError = new SilentFailureError(
                `批次 ${batchIdx + 1}: HTTP 200 但 0/${translated.length} 成功`,
                batchIdx,
                translated.length
              );
              options.onLog(`  ⚠️ 批次 ${batchIdx + 1} 静默失败: 0/${translated.length} 成功`);
              hasFailure = true;
              nodeRuntime[runtimeKey].lastError = silentError.message;
              // Don't count as completed batch, treat as failure
              continue;
            }
            
            translated.forEach((text, index) => {
              nextTexts[batchIndices[index]] = text;
            });
            nodeRuntime[runtimeKey] = {
              consecutiveRateLimitHits: 0,
              lastError: null,
              status: 'idle',
            };
            
            // Track successful batch
            batchResults.push({
              successCount,
              totalCount: batchIndices.length,
              hasError: false,
            });
            recentFailureCount = Math.max(0, recentFailureCount - 1); // Decay failure count
          } catch (batchError) {
            hasFailure = true;
            recentFailureCount++;
            const errorMessage = batchError instanceof Error ? batchError.message : '未知错误';
            const errorCategory = classifyError(batchError);
            
            options.onLog(`  ❌ 批次 ${batchIdx + 1} 失败 [${errorCategory}]: ${errorMessage}`);
            
            if (isRateLimitError(batchError)) {
              nodeRuntime[runtimeKey].consecutiveRateLimitHits += 1;
              nodeRuntime[runtimeKey].lastError = errorMessage;
              options.onLog(`  ⚠️ 限流命中 ${nodeRuntime[runtimeKey].consecutiveRateLimitHits}/${interruptThreshold}`);
              if (nodeRuntime[runtimeKey].consecutiveRateLimitHits >= interruptThreshold) {
                nodeRuntime[runtimeKey].status = 'interrupted';
                const snapshot = buildSnapshot(stageIndex, nodeIndex, batchIdx, completedBatches, 'interrupted', nextTexts, candidateTracks, judgeDecisions, selectedTrackByEntry, nodeRuntime);
                options.onLog(`⛔ 节点 [${node.label}] 已中断，等待恢复后继续`);
                throw new WorkflowPausedError(snapshot);
              }
            } else {
              nodeRuntime[runtimeKey].lastError = errorMessage;
            }
            
            // Track batch result
            batchResults.push({
              successCount: 0,
              totalCount: batchIndices.length,
              hasError: true,
              category: errorCategory,
            });
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
            // NEW: Use adaptive delay based on recent failures
            const adaptiveDelay = calculateAdaptiveDelay(recentFailureCount, options.delayMs ?? 0);
            await maybeDelay(adaptiveDelay);
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
      
      // NEW: Validate stage completion before proceeding to next stage
      const successfulCount = currentTexts.filter(t => !isFailed(t)).length;
      const failedCount = currentTexts.filter(t => isFailed(t)).length;
      
      if (failedCount > 0 && failedCount > entries.length / 2) {
        options.onLog(`⚠️ 翻译阶段失败率过高: ${failedCount}/${entries.length} 失败`);
        options.onLog(`🛑 停留在翻译阶段，不进入后续阶段`);
        throw new StageGateError(
          `翻译阶段未完成: ${successfulCount}/${entries.length} 成功`,
          {
            canProceed: false,
            successfulCount,
            failedCount,
            silentFailureCount: 0,
            failedIndices: currentTexts.reduce<number[]>((indices, text, idx) => {
              if (isFailed(text)) indices.push(idx);
              return indices;
            }, []),
            blockers: [`失败率过高: ${failedCount}/${entries.length}`],
          }
        );
      }
      
      continue;
    }

    if (stage.type === 'translate' && stage.execution === 'parallel' && stage.strategy === 'keep-all') {
      options.onLog(`🚀 开始并行翻译阶段: ${nodes.map(n => n.label).join(', ')}`);
      const trackResponses = await Promise.all(
        nodes.map(async (node) => {
          const startTime = Date.now();
          const batches = chunkArray(entries, options.batchSize);
          options.onLog(`📦 [${node.label}] 共 ${batches.length} 批 (每批最多 ${options.batchSize} 条)`);
          
          const allTranslations: string[] = [];
          for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            ensureNotAborted(options.signal);
            const batch = batches[batchIdx];
            const batchStartTime = Date.now();
            const startEntry = batchIdx * options.batchSize + 1;
            const endEntry = batchIdx * options.batchSize + batch.length;
            options.onLog(`  ⏳ [${node.label}] 批次 ${batchIdx + 1}/${batches.length}: 条目 ${startEntry}–${endEntry}`);
             
            try {
              const response = await options.executeNode({
                operation: 'translate',
                node,
                texts: batch.map((entry) => entry.text),
                contextTexts: getContextBefore(allTranslations, batchIdx * options.batchSize, options.contextLines),
                batch: {
                  kind: 'translate',
                  sequence: batchIdx + 1,
                  startIndex: batchIdx * options.batchSize,
                  endIndex: batchIdx * options.batchSize + batch.length - 1,
                  totalEntries: entries.length,
                },
              });
              allTranslations.push(...response.translations);
              const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
              const successCount = response.translations.filter(t => !isFailed(t)).length;
              options.onLog(`  ✓ [${node.label}] 批次 ${batchIdx + 1} 完成: ${successCount}/${batch.length} 成功 (${batchDuration}s)`);
            } catch (batchError) {
              const errorMsg = batchError instanceof Error ? batchError.message : '未知错误';
              const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
              options.onLog(`  ❌ [${node.label}] 批次 ${batchIdx + 1} 翻译失败 (${batchDuration}s): ${errorMsg}`);
              // Push placeholders so indices stay aligned
              for (let i = 0; i < batch.length; i++) allTranslations.push(failurePlaceholder);
            }
            options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
            if (batchIdx < batches.length - 1) {
              await maybeDelay(options.delayMs);
            }
          }
          
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          const translated = normalizeTranslations(allTranslations, entries.length);
          const successCount = translated.filter(t => !isFailed(t)).length;
          options.onLog(`✅ [${node.label}] 翻译完成: ${successCount}/${entries.length} 成功, 耗时 ${duration}s`);

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
      options.onLog(`📦 [${node.label}] 共 ${batches.length} 批 (每批最多 ${options.batchSize} 条)`);
      
      const allDecisions: WorkflowJudgeDecision[] = [];
      const allTranslations: string[] = [];
      let judgeSuccess = true;
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        ensureNotAborted(options.signal);
        const batch = batches[batchIdx];
        const batchStartTime = Date.now();
        const startEntry = batchIdx * options.batchSize + 1;
        const endEntry = batchIdx * options.batchSize + batch.length;
        options.onLog(`  ⏳ [${node.label}] 批次 ${batchIdx + 1}/${batches.length}: 条目 ${startEntry}–${endEntry}`);

        try {
          const response = await options.executeNode({
            operation: 'judge',
            node,
            texts: batch.map((entry) => entry.text),
            contextTexts: [],
            batch: {
              kind: 'translate',
              sequence: batchIdx + 1,
              startIndex: batchIdx * options.batchSize,
              endIndex: batchIdx * options.batchSize + batch.length - 1,
              totalEntries: entries.length,
            },
            candidateSets: candidateTracks,
          });
          
          const decisions = parseJudgeDecisions(response.metadata);
          allDecisions.push(...decisions);
          allTranslations.push(...response.translations);
          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
          options.onLog(`  ✓ [${node.label}] 批次 ${batchIdx + 1} 评估完成 (${batchDuration}s)`);
        } catch (batchError) {
          const errorMsg = batchError instanceof Error ? batchError.message : '未知错误';
          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
          options.onLog(`  ❌ [${node.label}] 批次 ${batchIdx + 1} 评估失败 (${batchDuration}s): ${errorMsg}`);
          judgeSuccess = false;
          // Push placeholders to keep alignment; use first candidate as fallback
          for (let i = 0; i < batch.length; i++) allTranslations.push(failurePlaceholder);
        }
        options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
        if (batchIdx < batches.length - 1) {
          await maybeDelay(options.delayMs);
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      judgeDecisions = allDecisions;
      // For failed judge batches, fall back to first candidate track
      const fallbackTexts = candidateTracks[0]?.texts ?? currentTexts;
      currentTexts = normalizeTranslations(
        allTranslations.map((t, i) => (isFailed(t) ? (fallbackTexts[i] ?? failurePlaceholder) : t)),
        entries.length,
      );
      selectedTrackByEntry = judgeDecisions.length > 0
        ? judgeDecisions.map((decision) => decision.winner)
        : entries.map(() => candidateTracks[0]?.key ?? '');
      if (judgeSuccess) {
        options.onLog(`✅ 评估完成, 耗时 ${duration}s`);
      } else {
        options.onLog(`⚠️ 评估阶段部分批次失败, 已用首选候选兜底, 耗时 ${duration}s`);
      }
      continue;
    }

    if (stage.type === 'review') {
      for (const node of nodes) {
        options.onLog(`🔍 开始审校阶段: 节点 [${node.label}]`);
        const startTime = Date.now();
        
        const batches = chunkArray(entries, options.batchSize);
        options.onLog(`📦 [${node.label}] 共 ${batches.length} 批 (每批最多 ${options.batchSize} 条)`);
        
        const allTranslations: string[] = [];
        let processedCount = 0;
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          ensureNotAborted(options.signal);
          const batch = batches[batchIdx];
          const batchStartTime = Date.now();
          const startEntry = batchIdx * options.batchSize + 1;
          const endEntry = batchIdx * options.batchSize + batch.length;
          options.onLog(`  ⏳ [${node.label}] 批次 ${batchIdx + 1}/${batches.length}: 条目 ${startEntry}–${endEntry}`);
          
          const batchDrafts = batch.map((_, index) => {
            return currentTexts[processedCount + index] ?? '[翻译失败]';
          });

          try {
            const response = await options.executeNode({
              operation: 'review',
              node,
              texts: batch.map((entry) => entry.text),
              contextTexts: [],
              batch: {
                kind: 'translate',
                sequence: batchIdx + 1,
                startIndex: batchIdx * options.batchSize,
                endIndex: batchIdx * options.batchSize + batch.length - 1,
                totalEntries: entries.length,
              },
              draftTexts: batchDrafts,
            });
            allTranslations.push(...response.translations);
            const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
            const successCount = response.translations.filter(t => !isFailed(t)).length;
            options.onLog(`  ✓ [${node.label}] 批次 ${batchIdx + 1} 完成: ${successCount}/${batch.length} 成功 (${batchDuration}s)`);
          } catch (batchError) {
            const errorMsg = batchError instanceof Error ? batchError.message : '未知错误';
            const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
            options.onLog(`  ❌ [${node.label}] 批次 ${batchIdx + 1} 审校失败 (${batchDuration}s): ${errorMsg}`);
            // Fall back to draft texts on error
            allTranslations.push(...batchDrafts);
          }
          processedCount += batch.length;
          options.onProgress?.(normalizeTranslations(allTranslations, entries.length));
          if (batchIdx < batches.length - 1) {
            await maybeDelay(options.delayMs);
          }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        currentTexts = normalizeTranslations(allTranslations, entries.length);
        const successCount = currentTexts.filter(t => !isFailed(t)).length;
        options.onLog(`✅ [${node.label}] 审校完成: ${successCount}/${entries.length} 成功, 耗时 ${duration}s`);
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
