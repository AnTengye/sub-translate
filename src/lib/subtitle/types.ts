export type SubtitleStatus = 'pending' | 'done' | 'error' | 'retrying';

export interface SubtitleEntry {
  idx: number;
  timecode: string;
  text: string;
  translated: string | null;
  status: SubtitleStatus;
}
