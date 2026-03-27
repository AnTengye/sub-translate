import { describe, expect, it } from 'vitest';
import type { ProviderProfileStorageData } from '../config-storage';
import { createInitialState, subtitleTranslatorReducer } from './reducer';

describe('subtitleTranslatorReducer', () => {
  const persistedProfiles: ProviderProfileStorageData = {
    version: 1,
    defaultProvider: 'claude-compatible',
    providers: {
      'openai-compatible': {
        activeProfileId: 'openai-default',
        profiles: [
          {
            id: 'openai-default',
            name: 'OpenAI Local',
            config: {
              apiEndpoint: 'http://localhost:11434/v1',
              apiKey: 'openai-key',
              model: 'qwen-local',
              disableThinking: '',
            },
          },
        ],
      },
      'claude-compatible': {
        activeProfileId: 'claude-default',
        profiles: [
          {
            id: 'claude-default',
            name: 'Claude Local',
            config: {
              apiEndpoint: 'https://claude.example.com/v1',
              apiKey: 'claude-key',
              model: 'claude-sonnet',
            },
          },
        ],
      },
      baidu: {
        activeProfileId: 'baidu-default',
        profiles: [
          {
            id: 'baidu-default',
            name: 'Baidu Local',
            config: {
              apiEndpoint: 'https://baidu.example.com',
              appId: 'app-id',
              apiKey: 'baidu-key',
              secretKey: '',
              modelType: 'nmt',
              reference: 'keep names stable',
              punctuationPreprocessing: 'true',
            },
          },
        ],
      },
    },
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

  it('initializes provider and visible provider config from persisted active profiles', () => {
    const state = createInitialState(persistedProfiles);

    expect(state.provider).toBe('claude-compatible');
    expect(state.providerConfig).toEqual({
      apiEndpoint: 'https://claude.example.com/v1',
      apiKey: 'claude-key',
      model: 'claude-sonnet',
    });
    expect(state.providerProfiles).toEqual(persistedProfiles);
  });

  it('switches to the selected provider active profile instead of static defaults', () => {
    const state = createInitialState(persistedProfiles);

    const next = subtitleTranslatorReducer(state, {
      type: 'setProvider',
      provider: 'baidu',
    });

    expect(next.provider).toBe('baidu');
    expect(next.providerConfig).toEqual({
      apiEndpoint: 'https://baidu.example.com',
      appId: 'app-id',
      apiKey: 'baidu-key',
      secretKey: '',
      modelType: 'nmt',
      reference: 'keep names stable',
      punctuationPreprocessing: 'true',
    });
  });
});
