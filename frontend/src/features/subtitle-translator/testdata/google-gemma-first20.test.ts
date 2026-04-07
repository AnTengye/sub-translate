import fixture from './google-gemma-first20.json';
import { describe, expect, it } from 'vitest';

describe('google gemma first20 fixture', () => {
  it('contains the first 20 subtitle entries from the latest regression sample', () => {
    expect(fixture.sourceRunId).toBe('299745281598042112');
    expect(fixture.entries).toHaveLength(20);
    expect(fixture.entries[0]).toEqual({
      idx: 1,
      timecode: '00:00:12,086 --> 00:00:12,166',
      text: 'はい。',
    });
    expect(fixture.entries[19]).toEqual({
      idx: 20,
      timecode: '00:02:28,789 --> 00:02:31,050',
      text: '僕 は勉強が苦手 で',
    });
  });
});
