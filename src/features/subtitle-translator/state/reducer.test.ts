import { describe, expect, it } from 'vitest';
import { createInitialState, subtitleTranslatorReducer } from './reducer';

describe('subtitleTranslatorReducer', () => {
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
});
