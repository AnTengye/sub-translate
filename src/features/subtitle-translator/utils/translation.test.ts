import { describe, expect, it, vi } from 'vitest';
import type { SubtitleEntry } from '../../../lib/subtitle/types';
import { runRetry, runTranslation } from './translation';

function createEntry(idx: number, text: string): SubtitleEntry {
  return {
    idx,
    timecode: `00:00:0${idx},000 --> 00:00:0${idx + 1},000`,
    text,
    translated: null,
    status: 'pending',
  };
}

describe('runTranslation', () => {
  it('translates entries in batches and marks failures', async () => {
    const dispatchTranslate = vi
      .fn()
      .mockResolvedValueOnce(['一', '二'])
      .mockRejectedValueOnce(new Error('boom'));

    const updates: number[] = [];

    const result = await runTranslation(
      [createEntry(1, '1'), createEntry(2, '2'), createEntry(3, '3')],
      {
        batchSize: 2,
        contextLines: 1,
        dispatchTranslate,
        onUpdate: (_entries, progress) => {
          if (progress !== null) {
            updates.push(progress);
          }
        },
        onLog: vi.fn(),
      },
    );

    expect(result[0].translated).toBe('一');
    expect(result[1].translated).toBe('二');
    expect(result[2].status).toBe('error');
    expect(updates.at(-1)).toBe(100);
  });
});

describe('runRetry', () => {
  it('retries failed entries using successful prior translations as context', async () => {
    const dispatchTranslate = vi.fn().mockResolvedValue(['补译']);
    const onUpdate = vi.fn();

    const entries: SubtitleEntry[] = [
      { ...createEntry(1, '1'), translated: '前文', status: 'done' },
      { ...createEntry(2, '2'), translated: null, status: 'error' },
    ];

    const result = await runRetry([1], entries, {
      batchSize: 1,
      contextLines: 1,
      dispatchTranslate,
      onUpdate,
      onLog: vi.fn(),
    });

    expect(dispatchTranslate).toHaveBeenCalledWith(['2'], ['前文']);
    expect(result[1].translated).toBe('补译');
    expect(result[1].status).toBe('done');
    expect(onUpdate).toHaveBeenCalled();
  });
});
