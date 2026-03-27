import type { Dispatch } from 'react';
import { parseSrt } from '../../../lib/subtitle/srt';
import type { SubtitleTranslatorAction } from '../state/reducer';

export function useFileImport(dispatch: Dispatch<SubtitleTranslatorAction>) {
  async function readFileContent(file: File) {
    if (typeof file.text === 'function') {
      return file.text();
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
      reader.readAsText(file, 'utf-8');
    });
  }

  async function importFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    try {
      const content = await readFileContent(file);
      const parsed = parseSrt(content);
      if (parsed.length === 0) {
        dispatch({ type: 'fileLoadFailed', error: '解析失败，请确认为有效的字幕格式' });
        return;
      }

      dispatch({
        type: 'fileLoaded',
        fileName: file.name,
        entries: parsed,
      });
    } catch (error) {
      dispatch({
        type: 'fileLoadFailed',
        error: error instanceof Error ? error.message : '文件读取失败',
      });
    }
  }

  return {
    importFile,
  };
}
