import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SubtitleTranslatorPage from './SubtitleTranslatorPage';

describe('SubtitleTranslatorPage', () => {
  it('shows provider metadata-driven fields after file import', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/翻译引擎/i)).toBeInTheDocument();
    expect(screen.getByText(/OpenAI/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/模型名称/i)).toBeInTheDocument();
  });

  it('imports subtitle files through drag and drop', async () => {
    render(<SubtitleTranslatorPage />);

    const uploadCard = screen.getByText(/选择字幕文件/i).closest('label');
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
