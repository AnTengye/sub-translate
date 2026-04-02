import { describe, expect, it } from 'vitest';
import type { ProviderCenterStateData } from '../provider-center-api';
import type { WorkflowTemplateStateData } from '../workflow-types';
import { createInitialState, subtitleTranslatorReducer } from './reducer';

describe('subtitleTranslatorReducer', () => {
  const providerCenter: ProviderCenterStateData = {
    version: 1,
    defaultProvider: 'openai-compatible',
    families: {
      'openai-compatible': {
        id: 'openai-compatible',
        label: 'OpenAI Compatible',
        description: '',
        activeProfileId: 'openai-default',
        profiles: [
          {
            id: 'openai-default',
            family: 'openai-compatible',
            name: 'OpenAI Local',
            enabled: true,
            isDefault: true,
            connection: {
              apiEndpoint: 'https://openai.example.com/v1',
              apiKey: 'openai-key',
            },
            settings: {
              model: 'gpt-4o-mini',
            },
            capabilities: {},
            models: [
              { id: 'gpt-4o-mini', label: 'gpt-4o-mini', enabled: true, source: 'manual' },
              { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'manual' },
            ],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: true,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'success',
              summary: '可用',
              lastCheckedAt: null,
              error: null,
            },
          },
        ],
      },
      'claude-compatible': {
        id: 'claude-compatible',
        label: 'Claude Compatible',
        description: '',
        activeProfileId: 'claude-default',
        profiles: [
          {
            id: 'claude-default',
            family: 'claude-compatible',
            name: 'Claude Local',
            enabled: true,
            isDefault: false,
            connection: {
              apiEndpoint: 'https://claude.example.com/v1',
              apiKey: 'claude-key',
            },
            settings: {
              model: 'claude-sonnet',
              providerLabel: 'Anthropic',
            },
            capabilities: {},
            models: [
              { id: 'claude-sonnet', label: 'claude-sonnet', enabled: true, source: 'manual' },
            ],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: false,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'success',
              summary: '可用',
              lastCheckedAt: null,
              error: null,
            },
          },
        ],
      },
      baidu: {
        id: 'baidu',
        label: 'Baidu',
        description: '',
        activeProfileId: 'baidu-default',
        profiles: [
          {
            id: 'baidu-default',
            family: 'baidu',
            name: 'Baidu Local',
            enabled: true,
            isDefault: false,
            connection: {
              apiEndpoint: 'https://baidu.example.com',
              appId: 'app-id',
              apiKey: 'baidu-key',
              secretKey: 'baidu-secret',
            },
            settings: {
              modelType: 'llm',
            },
            capabilities: {},
            models: [{ id: 'llm', label: 'llm', enabled: true, source: 'manual' }],
            modelDiscovery: {
              sourceMode: 'manual',
              supportsModelDiscovery: false,
              lastCheckedAt: null,
              lastStatus: 'success',
              lastError: null,
            },
            health: {
              status: 'warning',
              summary: '未通过检测',
              lastCheckedAt: null,
              error: 'warning',
            },
          },
        ],
      },
    },
  };

  const workflowTemplates: WorkflowTemplateStateData = {
    version: 1,
    templates: [
      {
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
                target: null,
              },
            ],
          },
        ],
      },
      {
        id: 'compare',
        name: '双路比对',
        description: 'parallel compare',
        scenario: 'comparison',
        stages: [],
      },
    ],
  };

  it('moves to config when a valid file is loaded', () => {
    const state = createInitialState();
    const next = subtitleTranslatorReducer(state, {
      type: 'fileLoaded',
      fileName: 'demo.srt',
      entries: [
        {
          idx: 1,
          timecode: '00:00:01,000 --> 00:00:02,000',
          text: 'こんにちは',
          translated: null,
          status: 'pending',
        },
      ],
    });

    expect(next.step).toBe('config');
    expect(next.fileName).toBe('demo.srt');
    expect(next.display).toHaveLength(1);
  });

  it('hydrates provider center state without selecting a workflow target automatically', () => {
    const state = createInitialState();

    const next = subtitleTranslatorReducer(state, {
      type: 'hydrateProviderCenter',
      providerCenter,
    });

    expect(next.providerCenter).toEqual(providerCenter);
    expect(next.workflowDraft).toBeNull();
  });

  it('hydrates templates and selects the first one as active draft', () => {
    const state = createInitialState();

    const next = subtitleTranslatorReducer(state, {
      type: 'hydrateWorkflowTemplates',
      workflowTemplates,
    });

    expect(next.activeTemplateId).toBe('quality-first');
    expect(next.workflowDraft?.id).toBe('quality-first');
  });

  it('selects a different workflow template by id', () => {
    const hydrated = subtitleTranslatorReducer(createInitialState(), {
      type: 'hydrateWorkflowTemplates',
      workflowTemplates,
    });

    const next = subtitleTranslatorReducer(hydrated, {
      type: 'selectWorkflowTemplate',
      templateId: 'compare',
    });

    expect(next.activeTemplateId).toBe('compare');
    expect(next.workflowDraft?.name).toBe('双路比对');
  });

  it('updates a workflow node target inside the active draft', () => {
    const hydrated = subtitleTranslatorReducer(createInitialState(), {
      type: 'hydrateWorkflowTemplates',
      workflowTemplates,
    });

    const next = subtitleTranslatorReducer(hydrated, {
      type: 'setWorkflowNodeTarget',
      stageId: 'translate',
      nodeId: 'primary',
      target: {
        family: 'openai-compatible',
        profileId: 'openai-default',
        modelId: 'gpt-4o-mini',
      },
    });

    expect(next.workflowDraft?.stages[0].nodes[0].target).toEqual({
      family: 'openai-compatible',
      profileId: 'openai-default',
      modelId: 'gpt-4o-mini',
    });
  });
});
