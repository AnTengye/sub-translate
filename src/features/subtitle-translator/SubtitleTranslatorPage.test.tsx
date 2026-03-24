import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    expect(screen.getByRole('button', { name: /OpenAI Compatible/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/模型名称/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/关闭 Thinking/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/API 端点/i)).not.toBeInTheDocument();
  });

  it('shows the OpenAI disable thinking toggle and keeps it off by default', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    const toggle = await screen.findByLabelText(/关闭 Thinking/i);
    expect(toggle.closest('.field-checkbox')).not.toBeNull();
    expect(toggle.closest('.field-toggle')).toBeNull();
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('shows the Baidu punctuation preprocessing toggle and keeps it off by default', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: /百度大模型翻译 api/i }));

    const toggle = await screen.findByLabelText(/标点预处理（实验性）/i);
    expect(toggle.closest('.field-checkbox')).not.toBeNull();
    expect(toggle.closest('.field-toggle')).toBeNull();
    expect(screen.getByText(/减少模型按句拆分导致的错位风险/i)).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('does not apply full-width field input styling to checkbox controls', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(css).toContain(".field input:not([type='checkbox'])");
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
