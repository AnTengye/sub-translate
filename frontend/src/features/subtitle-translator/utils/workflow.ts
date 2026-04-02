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
        const response = await options.executeNode({
          operation: 'translate',
          node,
          texts: pendingIndices.map((index) => entries[index].text),
          contextTexts: [],
        });
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        const translated = normalizeTranslations(response.translations, pendingIndices.length);
        let successCount = 0;
        translated.forEach((text, index) => {
          nextTexts[pendingIndices[index]] = text;
          if (!isFailed(text)) successCount++;
        });
        pendingIndices = pendingIndices.filter((index) => isFailed(nextTexts[index]));
        options.onLog(`✅ 节点 [${node.label}] 串行翻译完成 (${successCount}/${translated.length} 成功, 耗时 ${duration}s)`);
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
          const response = await options.executeNode({
            operation: 'translate',
            node,
            texts: entries.map((entry) => entry.text),
            contextTexts: [],
          });
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          
          const translated = normalizeTranslations(response.translations, entries.length);
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
      const response = await options.executeNode({
        operation: 'judge',
        node,
        texts: entries.map((entry) => entry.text),
        contextTexts: [],
        candidateSets: candidateTracks,
      });
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      judgeDecisions = parseJudgeDecisions(response.metadata);
      currentTexts = normalizeTranslations(response.translations, entries.length);
      selectedTrackByEntry = judgeDecisions.map((decision) => decision.winner);
      options.onLog(`✅ 评估完成 (耗时 ${duration}s)`);
      continue;
    }

    if (stage.type === 'review') {
      for (const node of nodes) {
        options.onLog(`🔍 开始审校阶段: 节点 [${node.label}]`);
        const startTime = Date.now();
        const response = await options.executeNode({
          operation: 'review',
          node,
          texts: entries.map((entry) => entry.text),
          contextTexts: [],
          draftTexts: currentTexts,
        });
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        currentTexts = normalizeTranslations(response.translations, entries.length);
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
