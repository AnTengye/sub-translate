import type { SubtitleEntry } from './types';

export function parseSrt(content: string): SubtitleEntry[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  return normalized.split(/\n{2,}/).flatMap((block, blockIndex) => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) {
      return [];
    }

    const timecode = lines[1]?.trim() ?? '';
    if (!timecode.includes('-->')) {
      return [];
    }

    const parsedIndex = Number.parseInt(lines[0]?.trim() ?? '', 10);
    const text = lines
      .slice(2)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!text) {
      return [];
    }

    return [
      {
        idx: Number.isNaN(parsedIndex) ? blockIndex + 1 : parsedIndex,
        timecode,
        text,
        translated: null,
        status: 'pending',
      },
    ];
  });
}

export function serializeSrt(entries: SubtitleEntry[]): string {
  return `${entries
    .map(
      (entry, index) => `${index + 1}\n${entry.timecode}\n${entry.translated ?? entry.text}`,
    )
    .join('\n\n')}\n`;
}
