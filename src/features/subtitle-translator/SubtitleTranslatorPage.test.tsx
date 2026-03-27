import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/feedback/ToastProvider';
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
        {
          id: 'openai-compatible-newapi',
          family: 'openai-compatible',
          name: 'New API Mirror',
          enabled: false,
          isDefault: false,
          connection: {
            apiEndpoint: 'https://newapi.example.com/v1',
            apiKey: 'newapi-key',
          },
          settings: {
            model: 'gpt-4.1-mini',
            providerLabel: 'New API',
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
            status: 'warning',
            summary: '已停用',
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
            providerLabel: 'Anthropic',
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
            models: [],
            availableModels: [
              { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'auto' },
              { id: 'gpt-4.1', label: 'gpt-4.1', enabled: true, source: 'auto' },
            ],
          },
          models: [
            { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'auto' },
            { id: 'gpt-4.1', label: 'gpt-4.1', enabled: true, source: 'auto' },
          ],
          summary: '发现 2 个模型',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (url === '/api/translation-runs') {
      return new Response(JSON.stringify({ runId: 'run-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/translation-runs/run-1/finalize') {
      return new Response(JSON.stringify({ runId: 'run-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/translate/openai-compatible') {
      return new Response(JSON.stringify({ translations: ['你好'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

function renderPage() {
  return render(
    <ToastProvider>
      <SubtitleTranslatorPage />
    </ToastProvider>,
  );
}

describe('SubtitleTranslatorPage', () => {
  it('shows product-style upload entry copy before import', () => {
    renderPage();

    expect(screen.getByText(/SRT Translate Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/上传字幕，生成可导出的中文字幕/i)).toBeInTheDocument();
  });

  it('shows provider summary after file import and uses server-backed profile data', async () => {
    renderPage();

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
    renderPage();

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

    expect(within(dialog).getByRole('button', { name: /Local OpenAI/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /New API Mirror/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Claude Local/i })).toBeInTheDocument();

    const modelInput = within(dialog).getByLabelText(/默认模型/i);
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
    renderPage();

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getByRole('button', { name: /检测/i }));
    expect(await screen.findAllByText(/连接配置有效，可继续进行模型检查或翻译/i)).not.toHaveLength(0);
  });

  it('opens the add-provider modal and exposes supported provider types', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getByRole('button', { name: /\+ 添加/i }));

    expect(within(dialog).getByRole('dialog', { name: /添加提供商/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'OpenAI' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'Anthropic' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'New API' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'Baidu' })).toBeInTheDocument();
  });

  it('removes OpenAI runtime toggles from provider center while retaining Baidu-specific fields', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    expect(within(dialog).queryByLabelText(/disableThinking/i)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Baidu Local/i }));
    expect(within(dialog).getByLabelText(/modelType/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/reference/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/punctuationPreprocessing/i)).toBeInTheDocument();
  });

  it('opens model manager from 管理, fetches remote catalog, and saves only selected models', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    expect(within(dialog).queryByRole('button', { name: /^搜索$/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /自动发现模型/i })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^管理$/ }));

    const modelDialog = await within(dialog).findByRole('dialog', { name: /模型管理/i });
    expect(await within(modelDialog).findByText(/发现 2 个模型/i)).toBeInTheDocument();
    expect(within(modelDialog).getByLabelText('gpt-4.1-mini')).toBeInTheDocument();
    expect(within(modelDialog).getByLabelText('gpt-4.1')).toBeInTheDocument();

    await user.click(within(modelDialog).getByLabelText('gpt-4.1-mini'));
    await user.click(within(modelDialog).getByRole('button', { name: /添加到当前配置/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/1 个已添加模型/i)).toBeInTheDocument();
    });
    const modelBoard = dialog.querySelector('.provider-center-model-board');
    expect(modelBoard).not.toBeNull();
    const modelNames = Array.from(modelBoard?.querySelectorAll('strong') ?? []).map((element) => element.textContent);
    expect(modelNames).toEqual(['gpt-4.1-mini']);
  });

  it('uses the selected New API profile runtime when starting translation', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText(/选择文件/i);
    const file = new File(
      ['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'],
      'sample.srt',
      { type: 'text/plain' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: /管理 Providers/i }));

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getByRole('button', { name: /New API Mirror/i }));
    await user.click(within(dialog).getByRole('button', { name: /保存配置/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Provider Center/i })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /开始翻译/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/translate/openai-compatible',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"profileId":"openai-compatible-newapi"'),
        }),
      );
    });

    const translateCall = vi
      .mocked(fetch)
      .mock.calls.find(([requestUrl]) => requestUrl === '/api/translate/openai-compatible');
    expect(translateCall).toBeTruthy();
    const body = JSON.parse(String(translateCall?.[1]?.body ?? '{}'));
    expect(body.runtimeOverrides.apiEndpoint).toBe('https://newapi.example.com/v1');
    expect(body.runtimeOverrides.apiKey).toBe('newapi-key');
    expect(body.options.model).toBe('gpt-4.1-mini');
  });

  it('keeps checkbox fields out of full-width text input styling', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    expect(css).toContain(".field input:not([type='checkbox'])");
  });
});
