import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubtitleTranslatorPage from './SubtitleTranslatorPage';

const runtimeSeeds = {
  defaultProvider: 'openai-compatible',
  providers: {
    'openai-compatible': {
      profileName: 'Local OpenAI',
      apiEndpoint: 'http://localhost:11434/v1',
      apiKey: 'openai-key',
      model: 'qwen-local',
      disableThinking: '',
    },
    'claude-compatible': {
      profileName: 'Claude Local',
      apiEndpoint: 'https://claude.example.com/v1',
      apiKey: 'claude-key',
      model: 'claude-sonnet',
    },
    baidu: {
      profileName: 'Baidu Local',
      apiEndpoint: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
      appId: 'baidu-app-id',
      apiKey: 'baidu-key',
      secretKey: '',
      modelType: 'llm',
      reference: '',
      punctuationPreprocessing: '',
    },
  },
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(runtimeSeeds), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(screen.getByDisplayValue('qwen-local')).toBeInTheDocument();
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

  it('opens the advanced config panel from a gear action and syncs saved values back to the main panel', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: /高级配置/i }));

    const dialog = await screen.findByRole('dialog', { name: /高级配置/i });
    expect(dialog).toBeInTheDocument();

    const apiEndpoint = within(dialog).getByLabelText(/API 端点/i);
    const apiKey = within(dialog).getByLabelText(/^API Key$/i);
    const modelInput = within(dialog).getByLabelText(/模型名称/i);

    fireEvent.change(apiEndpoint, { target: { value: 'https://runtime.example/v1' } });
    fireEvent.change(apiKey, { target: { value: 'runtime-key' } });
    fireEvent.change(modelInput, { target: { value: 'gpt-4.1-mini' } });
    expect(apiEndpoint).toHaveValue('https://runtime.example/v1');
    expect(apiKey).toHaveValue('runtime-key');
    expect(modelInput).toHaveValue('gpt-4.1-mini');

    fireEvent.click(within(dialog).getByRole('button', { name: /保存配置/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /高级配置/i })).not.toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('gpt-4.1-mini')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('srt-translate.provider-profiles') || '{}'),
    ).toMatchObject({
      providers: {
        'openai-compatible': {
          profiles: [
            {
              config: {
                apiEndpoint: 'https://runtime.example/v1',
                apiKey: 'runtime-key',
                model: 'gpt-4.1-mini',
              },
            },
          ],
        },
      },
    });
  });

  it('restores saved advanced config profiles from local storage after rerender', async () => {
    window.localStorage.setItem(
      'srt-translate.provider-profiles',
      JSON.stringify({
        version: 1,
        defaultProvider: 'openai-compatible',
        providers: {
          'openai-compatible': {
            activeProfileId: 'openai-default',
            profiles: [
              {
                id: 'openai-default',
                name: 'Saved OpenAI',
                config: {
                  apiEndpoint: 'https://saved-openai.example/v1',
                  apiKey: 'saved-openai-key',
                  model: 'saved-openai-model',
                  disableThinking: 'true',
                },
              },
            ],
          },
          'claude-compatible': {
            activeProfileId: 'claude-default',
            profiles: [
              {
                id: 'claude-default',
                name: 'Saved Claude',
                config: {
                  apiEndpoint: 'https://saved-claude.example/v1',
                  apiKey: 'saved-claude-key',
                  model: 'saved-claude-model',
                },
              },
            ],
          },
          baidu: {
            activeProfileId: 'baidu-default',
            profiles: [
              {
                id: 'baidu-default',
                name: 'Saved Baidu',
                config: {
                  apiEndpoint: 'https://saved-baidu.example',
                  appId: 'saved-app-id',
                  apiKey: 'saved-baidu-key',
                  secretKey: '',
                  modelType: 'nmt',
                  reference: '',
                  punctuationPreprocessing: '',
                },
              },
            ],
          },
        },
      }),
    );

    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByDisplayValue('saved-openai-model')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
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
