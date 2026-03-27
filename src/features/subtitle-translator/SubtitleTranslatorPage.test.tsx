import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubtitleTranslatorPage from './SubtitleTranslatorPage';

const providerCenterState = {
  version: 1,
  defaultProvider: 'openai-compatible',
  families: {
    'openai-compatible': {
      id: 'openai-compatible',
      label: 'OpenAI Compatible',
      description: '',
      activeProfileId: 'openai-compatible-default',
      profiles: [
        {
          id: 'openai-compatible-default',
          family: 'openai-compatible',
          name: 'Local OpenAI',
          enabled: true,
          isDefault: true,
          connection: {
            apiEndpoint: 'http://localhost:11434/v1',
            apiKey: 'openai-key',
          },
          settings: {
            model: 'qwen-local',
            disableThinking: '',
          },
          capabilities: {
            supportsModelDiscovery: true,
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsThinkingToggle: true,
          },
          models: [],
          modelDiscovery: {
            sourceMode: 'auto',
            supportsModelDiscovery: true,
            lastCheckedAt: null,
            lastStatus: 'idle',
            lastError: null,
          },
          health: {
            status: 'idle',
            summary: '未检查',
            lastCheckedAt: null,
            error: null,
          },
        },
      ],
    },
    'claude-compatible': {
      id: 'claude-compatible',
      label: 'Claude Compatible',
      description: '',
      activeProfileId: 'claude-compatible-default',
      profiles: [
        {
          id: 'claude-compatible-default',
          family: 'claude-compatible',
          name: 'Claude Local',
          enabled: true,
          isDefault: false,
          connection: {
            apiEndpoint: 'https://claude.example.com/v1',
            apiKey: 'claude-key',
          },
          settings: {
            model: 'claude-sonnet',
          },
          capabilities: {
            supportsModelDiscovery: false,
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsThinkingToggle: false,
          },
          models: [],
          modelDiscovery: {
            sourceMode: 'manual',
            supportsModelDiscovery: false,
            lastCheckedAt: null,
            lastStatus: 'idle',
            lastError: null,
          },
          health: {
            status: 'idle',
            summary: '未检查',
            lastCheckedAt: null,
            error: null,
          },
        },
      ],
    },
    baidu: {
      id: 'baidu',
      label: 'Baidu',
      description: '',
      activeProfileId: 'baidu-default',
      profiles: [
        {
          id: 'baidu-default',
          family: 'baidu',
          name: 'Baidu Local',
          enabled: true,
          isDefault: false,
          connection: {
            apiEndpoint: 'https://baidu.example.com',
            appId: 'baidu-app-id',
            apiKey: 'baidu-key',
            secretKey: 'baidu-secret',
          },
          settings: {
            modelType: 'llm',
            reference: '',
            punctuationPreprocessing: '',
          },
          capabilities: {
            supportsModelDiscovery: false,
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsThinkingToggle: false,
          },
          models: [],
          modelDiscovery: {
            sourceMode: 'manual',
            supportsModelDiscovery: false,
            lastCheckedAt: null,
            lastStatus: 'idle',
            lastError: null,
          },
          health: {
            status: 'idle',
            summary: '未检查',
            lastCheckedAt: null,
            error: null,
          },
        },
      ],
    },
  },
};

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/provider-center' && (!init || init.method === undefined)) {
      return new Response(JSON.stringify(providerCenterState), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/provider-center' && init?.method === 'PUT') {
      return new Response(init.body as string, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/provider-center/check') {
      return new Response(
        JSON.stringify({
          profile: {
            ...providerCenterState.families['openai-compatible'].profiles[0],
            health: {
              status: 'success',
              summary: '连接配置有效，可继续进行模型检查或翻译',
              lastCheckedAt: '2026-03-27T10:00:00.000Z',
              error: null,
            },
          },
          status: 'success',
          summary: '连接配置有效，可继续进行模型检查或翻译',
          error: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (url === '/api/provider-center/models/discover') {
      return new Response(
        JSON.stringify({
          profile: {
            ...providerCenterState.families['openai-compatible'].profiles[0],
            models: [{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'auto' }],
          },
          models: [{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'auto' }],
          summary: '发现 1 个模型',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', createFetchMock());
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
  });

  it('shows provider summary after file import and uses server-backed profile data', async () => {
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/翻译引擎/i)).toBeInTheDocument();
    expect(screen.getByText(/当前配置：Local OpenAI/i)).toBeInTheDocument();
    expect(screen.getByText(/服务端统一管理/i)).toBeInTheDocument();
  });

  it('opens Provider Center and saves changes through the server API', async () => {
    const user = userEvent.setup();
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    expect(dialog).toBeInTheDocument();

    const modelInput = within(dialog).getByLabelText(/model/i);
    fireEvent.change(modelInput, { target: { value: 'gpt-4.1-mini' } });
    await user.click(within(dialog).getByRole('button', { name: /保存配置/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Provider Center/i })).not.toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/provider-center',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
    expect(screen.getByText(/已保存，将用于后续新任务/i)).toBeInTheDocument();
  });

  it('runs connectivity checks and model discovery from Provider Center', async () => {
    const user = userEvent.setup();
    render(<SubtitleTranslatorPage />);

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getByRole('button', { name: /连通性检查/i }));
    await user.click(within(dialog).getByRole('button', { name: /自动发现模型/i }));

    await screen.findByText(/发现 1 个模型/i);
    expect(within(dialog).getByText(/gpt-4.1-mini/i)).toBeInTheDocument();
  });

  it('keeps checkbox fields out of full-width text input styling', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    expect(css).toContain(".field input:not([type='checkbox'])");
  });
});
