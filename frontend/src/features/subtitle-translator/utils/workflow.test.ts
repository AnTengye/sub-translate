import { describe, expect, it, vi } from 'vitest';
import { executeWorkflowTemplate, isWorkflowPausedError } from './workflow';
import type { WorkflowTemplate } from '../workflow-types';

const entries = [
  {
    idx: 1,
    timecode: '00:00:01,000 --> 00:00:02,000',
    text: 'こんにちは',
  },
  {
    idx: 2,
    timecode: '00:00:03,000 --> 00:00:04,000',
    text: '世界',
  },
];

describe('executeWorkflowTemplate', () => {
  it('runs serial fallback translate stage and then review stage', async () => {
    const calls: Array<{
      operation: string;
      label: string;
      texts: string[];
      draftTexts?: string[];
      contextTexts?: string[];
    }> = [];
    const template: WorkflowTemplate = {
      id: 'quality-first',
      name: '质量优先',
      description: 'seed',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
            {
              id: 'fallback',
              label: '补偿翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'claude-compatible', profileId: 'p2', modelId: 'm2' },
            },
          ],
        },
        {
          id: 'review',
          name: '校对',
          type: 'review',
          execution: 'serial',
          strategy: 'replace-current',
          nodes: [
            {
              id: 'reviewer',
              label: '校对',
              type: 'review',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p3', modelId: 'm3' },
            },
          ],
        },
      ],
    };

    const result = await executeWorkflowTemplate(entries, template, {
      batchSize: 20,
      contextLines: 2,
      onLog: vi.fn(),
      executeNode: async (request) => {
        calls.push({
          operation: request.operation,
          label: request.node.label,
          texts: request.texts,
          draftTexts: request.draftTexts,
          contextTexts: request.contextTexts,
        });

        if (request.node.id === 'primary') {
          return {
            translations: ['你好', '[翻译失败]'],
          };
        }

        if (request.node.id === 'fallback') {
          return {
            translations: ['世界'],
          };
        }

        return {
          translations: ['你好呀', '世界呀'],
        };
      },
    });

    expect(calls[1]).toMatchObject({
      operation: 'translate',
      label: '补偿翻译',
      texts: ['世界'],
    });
    expect(calls[2]).toMatchObject({
      operation: 'review',
      draftTexts: ['你好', '世界'],
    });
    expect(result.finalTexts).toEqual(['你好呀', '世界呀']);
  });

  it('passes prior translated subtitles as context for later translate batches', async () => {
    const contextCalls: string[][] = [];
    const batchEntries = [
      ...entries,
      {
        idx: 3,
        timecode: '00:00:05,000 --> 00:00:06,000',
        text: 'またね',
      },
    ];
    const template: WorkflowTemplate = {
      id: 'quality-first',
      name: '质量优先',
      description: 'seed',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
          ],
        },
      ],
    };

    await executeWorkflowTemplate(batchEntries, template, {
      batchSize: 2,
      contextLines: 1,
      onLog: vi.fn(),
      executeNode: async (request) => {
        contextCalls.push(request.contextTexts);
        return {
          translations: request.texts.map((text) => `译:${text}`),
        };
      },
    });

    expect(contextCalls).toEqual([[], ['译:世界']]);
  });

  it('keeps parallel candidate tracks and applies judge recommendations', async () => {
    const template: WorkflowTemplate = {
      id: 'compare',
      name: '双路比对',
      description: 'parallel compare',
      scenario: 'comparison',
      stages: [
        {
          id: 'translate',
          name: '候选翻译',
          type: 'translate',
          execution: 'parallel',
          strategy: 'keep-all',
          nodes: [
            {
              id: 'candidate-a',
              label: '候选 A',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
            {
              id: 'candidate-b',
              label: '候选 B',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'claude-compatible', profileId: 'p2', modelId: 'm2' },
            },
          ],
        },
        {
          id: 'judge',
          name: '评估推荐',
          type: 'judge',
          execution: 'serial',
          strategy: 'manual-review',
          nodes: [
            {
              id: 'judge',
              label: '评估',
              type: 'judge',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p3', modelId: 'm3' },
            },
          ],
        },
      ],
    };

    const result = await executeWorkflowTemplate(entries, template, {
      batchSize: 20,
      contextLines: 0,
      onLog: vi.fn(),
      executeNode: async (request) => {
        if (request.node.id === 'candidate-a') {
          return {
            translations: ['你好', '世界'],
          };
        }
        if (request.node.id === 'candidate-b') {
          return {
            translations: ['您好', '世间'],
          };
        }
        return {
          translations: ['你好', '世间'],
          metadata: {
            decisions: [
              { winner: 'candidate-a', reason: '更自然' },
              { winner: 'candidate-b', reason: '更准确' },
            ],
          },
        };
      },
    });

    expect(result.candidateTracks).toHaveLength(2);
    expect(result.selectedTrackByEntry).toEqual(['candidate-a', 'candidate-b']);
    expect(result.judgeDecisions[1].reason).toBe('更准确');
    expect(result.finalTexts).toEqual(['你好', '世间']);
  });

  it('runs adversarial judges, computes confidence, and tiebreaks disputed entries', async () => {
    const calls: Array<{ nodeId: string; texts: string[] }> = [];
    const template: WorkflowTemplate = {
      id: 'compare-and-judge',
      name: '双路对比',
      description: 'adversarial compare',
      scenario: 'comparison',
      stages: [
        {
          id: 'translate',
          name: '候选翻译',
          type: 'translate',
          execution: 'parallel',
          strategy: 'keep-all',
          nodes: [
            {
              id: 'candidate-a',
              label: '候选 A',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
            {
              id: 'candidate-b',
              label: '候选 B',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'claude-compatible', profileId: 'p2', modelId: 'm2' },
            },
          ],
        },
        {
          id: 'judge',
          name: '对抗评审',
          type: 'judge',
          execution: 'parallel',
          strategy: 'adversarial',
          nodes: [
            {
              id: 'judge-accuracy',
              label: '准确性评审',
              type: 'judge',
              enabled: true,
              prompt: '',
              judgeDimension: 'accuracy',
              target: { family: 'openai-compatible', profileId: 'p3', modelId: 'm3' },
            },
            {
              id: 'judge-fluency',
              label: '流畅性评审',
              type: 'judge',
              enabled: true,
              prompt: '',
              judgeDimension: 'fluency',
              target: { family: 'claude-compatible', profileId: 'p4', modelId: 'm4' },
            },
          ],
        },
        {
          id: 'debate',
          name: '争议仲裁',
          type: 'judge',
          execution: 'serial',
          strategy: 'tiebreak',
          nodes: [
            {
              id: 'judge-tiebreak',
              label: '仲裁节点',
              type: 'judge',
              enabled: true,
              prompt: '',
              judgeDimension: 'tiebreak',
              target: { family: 'openai-compatible', profileId: 'p5', modelId: 'm5' },
            },
          ],
        },
      ],
    };

    const result = await executeWorkflowTemplate(entries, template, {
      batchSize: 20,
      contextLines: 0,
      onLog: vi.fn(),
      executeNode: async (request) => {
        calls.push({ nodeId: request.node.id, texts: request.texts });
        if (request.node.id === 'candidate-a') {
          return { translations: ['你好', '你这混蛋'] };
        }
        if (request.node.id === 'candidate-b') {
          return { translations: ['你好', '笨蛋！'] };
        }
        if (request.node.id === 'judge-accuracy') {
          return {
            translations: [],
            metadata: {
              decisions: [
                { winner: 'candidate-a', score: 92, reason: '语义准确', dimension: 'accuracy' },
                { winner: 'candidate-a', score: 70, reason: '更接近原文语气', dimension: 'accuracy' },
              ],
            },
          };
        }
        if (request.node.id === 'judge-fluency') {
          return {
            translations: [],
            metadata: {
              decisions: [
                { winner: 'candidate-a', score: 80, reason: '字幕更简洁', dimension: 'fluency' },
                { winner: 'candidate-b', score: 75, reason: '口语化更自然', dimension: 'fluency' },
              ],
            },
          };
        }
        return {
          translations: [],
          metadata: {
            decisions: [
              { winner: 'candidate-b', reason: '综合场景语气选择更口语的表达' },
            ],
          },
        };
      },
    });

    expect(calls.map((call) => call.nodeId)).toEqual([
      'candidate-a',
      'candidate-b',
      'judge-accuracy',
      'judge-fluency',
      'judge-tiebreak',
    ]);
    expect(calls.at(-1)?.texts).toEqual(['世界']);
    expect(result.judgeDecisions[0]).toMatchObject({
      winner: 'candidate-a',
      isDisputed: false,
    });
    expect(result.judgeDecisions[0].confidence).toBeGreaterThan(0.8);
    expect(result.judgeDecisions[0].dimensionScores).toHaveLength(2);
    expect(result.judgeDecisions[1]).toMatchObject({
      winner: 'candidate-b',
      isDisputed: true,
      debateReason: '综合场景语气选择更口语的表达',
    });
    expect(result.finalTexts).toEqual(['你好', '笨蛋！']);
    expect(result.selectedTrackByEntry).toEqual(['candidate-a', 'candidate-b']);
  });

  it('resumes judge batches from a paused adversarial snapshot', async () => {
    const judgeCalls: string[] = [];
    const template: WorkflowTemplate = {
      id: 'compare-and-judge',
      name: '双路对比',
      description: 'adversarial compare',
      scenario: 'comparison',
      stages: [
        {
          id: 'translate',
          name: '候选翻译',
          type: 'translate',
          execution: 'parallel',
          strategy: 'keep-all',
          nodes: [
            {
              id: 'candidate-a',
              label: '候选 A',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
            {
              id: 'candidate-b',
              label: '候选 B',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'claude-compatible', profileId: 'p2', modelId: 'm2' },
            },
          ],
        },
        {
          id: 'judge',
          name: '对抗评审',
          type: 'judge',
          execution: 'parallel',
          strategy: 'adversarial',
          nodes: [
            {
              id: 'judge-accuracy',
              label: '准确性评审',
              type: 'judge',
              enabled: true,
              prompt: '',
              judgeDimension: 'accuracy',
              target: { family: 'openai-compatible', profileId: 'p3', modelId: 'm3' },
            },
            {
              id: 'judge-fluency',
              label: '流畅性评审',
              type: 'judge',
              enabled: true,
              prompt: '',
              judgeDimension: 'fluency',
              target: { family: 'claude-compatible', profileId: 'p4', modelId: 'm4' },
            },
          ],
        },
      ],
    };

    let pausedSnapshot: Awaited<ReturnType<typeof executeWorkflowTemplate>>['snapshot'] | null = null;

    try {
      await executeWorkflowTemplate(entries, template, {
        batchSize: 1,
        contextLines: 0,
        onLog: vi.fn(),
        shouldPause: (snapshot) => snapshot.stageIndex === 1 && snapshot.completedBatches >= 1,
        executeNode: async (request) => {
          if (request.operation === 'translate') {
            return {
              translations: request.node.id === 'candidate-a' ? ['你好'] : ['您好'],
            };
          }
          judgeCalls.push(`${request.node.id}:${request.texts.join('|')}:${request.batch.sequence}`);
          return {
            translations: [],
            metadata: {
              decisions: [{ winner: 'candidate-a', score: 90, reason: '一致', dimension: request.node.judgeDimension }],
            },
          };
        },
      });
    } catch (error) {
      expect(isWorkflowPausedError(error)).toBe(true);
      pausedSnapshot = isWorkflowPausedError(error) ? error.snapshot : null;
    }

    expect(pausedSnapshot?.stageIndex).toBe(1);
    expect(judgeCalls).toEqual([
      'judge-accuracy:こんにちは:1',
      'judge-fluency:こんにちは:1',
    ]);

    const resumed = await executeWorkflowTemplate(entries, template, {
      batchSize: 1,
      contextLines: 0,
      onLog: vi.fn(),
      initialSnapshot: pausedSnapshot ?? undefined,
      executeNode: async (request) => {
        if (request.operation === 'translate') {
          throw new Error('translate stage should not rerun after resume');
        }
        judgeCalls.push(`${request.node.id}:${request.texts.join('|')}:${request.batch.sequence}`);
        return {
          translations: [],
          metadata: {
            decisions: [{ winner: 'candidate-a', score: 90, reason: '一致', dimension: request.node.judgeDimension }],
          },
        };
      },
    });

    expect(judgeCalls).toEqual([
      'judge-accuracy:こんにちは:1',
      'judge-fluency:こんにちは:1',
      'judge-accuracy:世界:2',
      'judge-fluency:世界:2',
    ]);
    expect(resumed.finalTexts).toEqual(['你好', '你好']);
  });

  it('can resume from a paused batch boundary without rerunning finished batches', async () => {
    const calls: string[] = [];
    const template: WorkflowTemplate = {
      id: 'quality-first',
      name: '质量优先',
      description: 'seed',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
          ],
        },
      ],
    };
    const batchEntries = [
      ...entries,
      {
        idx: 3,
        timecode: '00:00:05,000 --> 00:00:06,000',
        text: 'またね',
      },
    ];

    let pausedSnapshot: Awaited<ReturnType<typeof executeWorkflowTemplate>>['snapshot'] | null = null;

    try {
      await executeWorkflowTemplate(batchEntries, template, {
        batchSize: 2,
        contextLines: 0,
        onLog: vi.fn(),
        shouldPause: (snapshot) => snapshot.completedBatches >= 1,
        executeNode: async (request) => {
          calls.push(request.texts.join('|'));
          return {
            translations: request.texts.map((text) => `译:${text}`),
          };
        },
      });
    } catch (error) {
      expect(isWorkflowPausedError(error)).toBe(true);
      pausedSnapshot = isWorkflowPausedError(error) ? error.snapshot : null;
    }

    expect(pausedSnapshot?.completedBatches).toBe(1);
    expect(calls).toEqual(['こんにちは|世界']);

    const resumed = await executeWorkflowTemplate(batchEntries, template, {
      batchSize: 2,
      contextLines: 0,
      onLog: vi.fn(),
      initialSnapshot: pausedSnapshot ?? undefined,
      executeNode: async (request) => {
        calls.push(request.texts.join('|'));
        return {
          translations: request.texts.map((text) => `译:${text}`),
        };
      },
    });

    expect(calls).toEqual(['こんにちは|世界', 'またね']);
    expect(resumed.finalTexts).toEqual(['译:こんにちは', '译:世界', '译:またね']);
  });

  it('reports the real batch metadata when resuming from a paused snapshot', async () => {
    const batches: Array<{ sequence: number; startIndex: number; endIndex: number; texts: string[] }> = [];
    const template: WorkflowTemplate = {
      id: 'quality-first',
      name: '质量优先',
      description: 'seed',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
          ],
        },
      ],
    };
    const batchEntries = [
      ...entries,
      {
        idx: 3,
        timecode: '00:00:05,000 --> 00:00:06,000',
        text: 'またね',
      },
    ];

    const resumed = await executeWorkflowTemplate(batchEntries, template, {
      batchSize: 2,
      contextLines: 0,
      onLog: vi.fn(),
      initialSnapshot: {
        version: 1,
        stageIndex: 0,
        nodeIndex: 0,
        batchIndex: 1,
        completedBatches: 1,
        pauseReason: 'user',
        currentTexts: ['译:こんにちは', '译:世界', '[翻译失败]'],
        candidateTracks: [],
        judgeDecisions: [],
        selectedTrackByEntry: [],
        nodeRuntime: {},
      },
      executeNode: async (request) => {
        batches.push({
          sequence: request.batch.sequence,
          startIndex: request.batch.startIndex,
          endIndex: request.batch.endIndex,
          texts: request.texts,
        });
        return {
          translations: request.texts.map((text) => `译:${text}`),
        };
      },
    });

    expect(batches).toEqual([
      {
        sequence: 2,
        startIndex: 2,
        endIndex: 2,
        texts: ['またね'],
      },
    ]);
    expect(resumed.finalTexts).toEqual(['译:こんにちは', '译:世界', '译:またね']);
  });

  it('interrupts the current node after repeated rate-limit hits', async () => {
    const logs: string[] = [];
    const template: WorkflowTemplate = {
      id: 'quality-first',
      name: '质量优先',
      description: 'seed',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: { family: 'openai-compatible', profileId: 'p1', modelId: 'm1' },
            },
          ],
        },
      ],
    };
    const batchEntries = [
      ...entries,
      {
        idx: 3,
        timecode: '00:00:05,000 --> 00:00:06,000',
        text: 'またね',
      },
    ];

    let interruptedSnapshot: Awaited<ReturnType<typeof executeWorkflowTemplate>>['snapshot'] | null = null;

    try {
      await executeWorkflowTemplate(batchEntries, template, {
        batchSize: 1,
        contextLines: 0,
        onLog: (message) => logs.push(message),
        rateLimitInterruptThreshold: 2,
        executeNode: async () => {
          throw new Error('429 rate limit exceeded');
        },
      });
    } catch (error) {
      expect(isWorkflowPausedError(error)).toBe(true);
      interruptedSnapshot = isWorkflowPausedError(error) ? error.snapshot : null;
    }

    expect(interruptedSnapshot?.pauseReason).toBe('interrupted');
    expect(interruptedSnapshot?.nodeRuntime['translate::primary']?.consecutiveRateLimitHits).toBe(2);
    expect(logs.some((message) => message.includes('限流命中'))).toBe(true);
    expect(logs.some((message) => message.includes('已中断'))).toBe(true);
  });
});
