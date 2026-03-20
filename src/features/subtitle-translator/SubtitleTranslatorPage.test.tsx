import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SubtitleTranslatorPage from './SubtitleTranslatorPage';

afterEach(() => {
  cleanup();
});

describe('SubtitleTranslatorPage', () => {
  it('shows product-style upload entry copy before import', () => {
    render(<SubtitleTranslatorPage />);

    expect(screen.getByText(/SRT Translate Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/上传字幕，生成可导出的中文字幕/i)).toBeInTheDocument();
    expect(screen.getByText(/拖放上传/i)).toBeInTheDocument();
    expect(screen.getByText(/多引擎切换/i)).toBeInTheDocument();
    expect(screen.getByText(/失败可重试/i)).toBeInTheDocument();
  });

  it('shows provider metadata-driven fields after file import', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/字幕翻译工作台/i)).toBeInTheDocument();
    expect(screen.getByText(/当前文件/i)).toBeInTheDocument();
    expect(screen.getByText(/工作阶段/i)).toBeInTheDocument();
    expect(screen.getByText(/总条目/i)).toBeInTheDocument();
    expect(await screen.findByText(/翻译引擎/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenAI \/ 兼容接口/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/模型名称/i)).toBeInTheDocument();
  });

  it('imports subtitle files through drag and drop', async () => {
    render(<SubtitleTranslatorPage />);

    const uploadCard = screen.getByText(/导入字幕文件/i).closest('label');
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nさようなら\n'],
      'drop.srt',
      { type: 'text/plain' },
    );

    expect(uploadCard).not.toBeNull();

    fireEvent.dragEnter(uploadCard!, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(uploadCard).toHaveClass('drag-active');

    fireEvent.drop(uploadCard!, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(await screen.findByText(/翻译引擎/i)).toBeInTheDocument();
  });
});
