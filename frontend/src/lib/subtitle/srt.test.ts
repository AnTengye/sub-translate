import { describe, expect, it } from 'vitest';
import { parseSrt, serializeSrt } from './srt';

describe('parseSrt', () => {
  it('parses numbered subtitle blocks into entries', () => {
    const input = `1
00:00:01,000 --> 00:00:03,000
<i>こんにちは</i>

2
00:00:04,000 --> 00:00:06,000
世界`;

    expect(parseSrt(input)).toEqual([
      {
        idx: 1,
        timecode: '00:00:01,000 --> 00:00:03,000',
        text: 'こんにちは',
        translated: null,
        status: 'pending',
      },
      {
        idx: 2,
        timecode: '00:00:04,000 --> 00:00:06,000',
        text: '世界',
        translated: null,
        status: 'pending',
      },
    ]);
  });
});

describe('serializeSrt', () => {
  it('serializes translated text in valid srt order', () => {
    const output = serializeSrt([
      {
        idx: 9,
        timecode: '00:00:01,000 --> 00:00:03,000',
        text: 'こんにちは',
        translated: '你好',
        status: 'done',
      },
    ]);

    expect(output).toBe(`1
00:00:01,000 --> 00:00:03,000
你好
`);
  });
});
