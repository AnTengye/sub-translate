import { describe, expect, it, vi } from 'vitest';
import { executeWorkflowTemplate } from './workflow';
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
    const calls: Array<{ operation: string; label: string; texts: string[]; draftTexts?: string[] }> = [];
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
});
