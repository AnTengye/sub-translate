function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

import type { WorkflowTemplate, WorkflowTemplateNode } from '../workflow-types';

const failurePlaceholder = '[翻译失败]';

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

interface ExecuteWorkflowTemplateOptions {
  batchSize: number;
  contextLines: number;
  onLog: (message: string) => void;
  executeNode: (request: WorkflowNodeRequest) => Promise<WorkflowNodeResponse>;
}

export interface WorkflowExecutionResult {
  finalTexts: string[];
  candidateTracks: WorkflowCandidateTrack[];
  judgeDecisions: WorkflowJudgeDecision[];
  selectedTrackByEntry: string[];
}

function isFailed(text: string | undefined) {
  return !text || text === failurePlaceholder;
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

export async function executeWorkflowTemplate(
  entries: WorkflowSourceEntry[],
  template: WorkflowTemplate,
  options: ExecuteWorkflowTemplateOptions,
): Promise<WorkflowExecutionResult> {
  let currentTexts = entries.map(() => failurePlaceholder);
  let candidateTracks: WorkflowCandidateTrack[] = [];
  let judgeDecisions: WorkflowJudgeDecision[] = [];
  let selectedTrackByEntry = entries.map(() => '');

  for (const stage of template.stages) {
    const nodes = stage.nodes.filter((node) => node.enabled);
    if (nodes.length === 0) {
      continue;
    }

    if (stage.type === 'translate' && stage.execution === 'serial' && stage.strategy === 'fallback') {
      const nextTexts = currentTexts.slice();
      let pendingIndices = entries.map((_, index) => index);

      for (const node of nodes) {
        if (pendingIndices.length === 0) {
          break;
        }

        const startTime = Date.now();
        const batches = chunkArray(pendingIndices, options.batchSize);
        options.onLog(`📦 节点 [${node.label}] 串行翻译，共 ${batches.length} 批 (每批 ${options.batchSize} 条)`);
        
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batchIndices = batches[batchIdx];
          options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batchIndices[0] + 1}–${batchIndices[batchIndices.length - 1] + 1}`);
          
          const response = await options.executeNode({
            operation: 'translate',
            node,
            texts: batchIndices.map((index) => entries[index].text),
            contextTexts: [],
          });

          const translated = normalizeTranslations(response.translations, batchIndices.length);
          translated.forEach((text, index) => {
            nextTexts[batchIndices[index]] = text;
          });
          
          // Remove succeeded entries from pending
          pendingIndices = pendingIndices.filter((index) => isFailed(nextTexts[index]));
          if (pendingIndices.length === 0) break;
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
            const batch = batches[batchIdx];
            options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
            
            const response = await options.executeNode({
              operation: 'translate',
              node,
              texts: batch.map((entry) => entry.text),
              contextTexts: [],
            });
            allTranslations.push(...response.translations);
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
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
          
          const batchDrafts = batch.map((entry) => {
            const arrayIdx = entries.findIndex(e => e.idx === entry.idx);
            return arrayIdx >= 0 ? (currentTexts[arrayIdx] ?? '[翻译失败]') : '[翻译失败]';
          });
          const response = await options.executeNode({
            operation: 'review',
            node,
            texts: batch.map((entry) => entry.text),
            contextTexts: [],
            draftTexts: batchDrafts,
          });
          allTranslations.push(...response.translations);
        }
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          options.onLog(`  ⏳ 批次 ${batchIdx + 1}/${batches.length}: 条目 ${batch[0].idx + 1}–${batch[batch.length - 1].idx + 1}`);
          
          const batchDrafts = batch.map((entry) => currentTexts[entry.idx] ?? '[翻译失败]');
          const response = await options.executeNode({
            operation: 'review',
            node,
            texts: batch.map((entry) => entry.text),
            contextTexts: [],
            draftTexts: batchDrafts,
          });
          allTranslations.push(...response.translations);
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
  };
}
