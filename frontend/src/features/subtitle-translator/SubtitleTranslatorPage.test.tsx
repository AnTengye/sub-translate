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
          },
          capabilities: {
            supportsModelDiscovery: true,
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsThinkingToggle: true,
          },
          models: [
            { id: 'qwen-local', label: 'qwen-local', enabled: true, source: 'manual' },
            { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'manual' },
          ],
          modelDiscovery: {
            sourceMode: 'auto',
            supportsModelDiscovery: true,
            lastCheckedAt: null,
            lastStatus: 'success',
            lastError: null,
          },
          health: {
            status: 'success',
            summary: '连接配置有效，可继续进行模型检查或翻译',
            lastCheckedAt: null,
            error: null,
          },
        },
        {
          id: 'openai-compatible-newapi',
          family: 'openai-compatible',
          name: 'New API Mirror',
          enabled: true,
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
          models: [
            { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', enabled: true, source: 'manual' },
            { id: 'gpt-4.1', label: 'gpt-4.1', enabled: true, source: 'manual' },
          ],
          modelDiscovery: {
            sourceMode: 'auto',
            supportsModelDiscovery: true,
            lastCheckedAt: null,
            lastStatus: 'success',
            lastError: null,
          },
          health: {
            status: 'success',
            summary: 'New API 可用',
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
          models: [
            { id: 'claude-sonnet', label: 'claude-sonnet', enabled: true, source: 'manual' },
          ],
          modelDiscovery: {
            sourceMode: 'manual',
            supportsModelDiscovery: false,
            lastCheckedAt: null,
            lastStatus: 'success',
            lastError: null,
          },
          health: {
            status: 'success',
            summary: 'Claude 可用',
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
          models: [
            { id: 'llm', label: 'llm', enabled: true, source: 'manual' },
          ],
          modelDiscovery: {
            sourceMode: 'manual',
            supportsModelDiscovery: false,
            lastCheckedAt: null,
            lastStatus: 'warning',
            lastError: null,
          },
          health: {
            status: 'warning',
            summary: '未通过检测',
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
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.profileId === 'openai-compatible-default') {
        return new Response(JSON.stringify({ error: 'primary failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ translations: ['你好'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/translate/claude-compatible') {
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

async function importSubtitle() {
  const input = screen.getByLabelText(/选择文件/i);
  const file = new File(['1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n'], 'sample.srt', {
    type: 'text/plain',
  });

  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('button', { name: /开始翻译/i });
}

async function openProviderCenter(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: /(?:打开 Provider Center|管理 Providers)/i }),
  );
}

describe('SubtitleTranslatorPage', () => {
  it('shows product-style upload entry copy before import', () => {
    renderPage();

    expect(screen.getByText(/SubLingo Control Room/i)).toBeInTheDocument();
    expect(screen.getByText(/上传字幕，启动翻译控制台/i)).toBeInTheDocument();
    expect(screen.getByText(/统一 Provider 管理/i)).toBeInTheDocument();
  });

  it('shows explicit primary and fallback provider selectors after file import', async () => {
    renderPage();
    await importSubtitle();

    expect(screen.getByText(/^主 Provider$/i)).toBeInTheDocument();
    expect(screen.getByText(/失败备选/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/主 Provider 配置/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/主 Provider 模型/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/备选 Provider 配置/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/备选 Provider 模型/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /当前 Provider/i })).not.toBeInTheDocument();
  });

  it('keeps provider selection compact without duplicated sidebar summaries', async () => {
    renderPage();
    await importSubtitle();

    expect(document.querySelector('.provider-summary')).toBeNull();
  });

  it('filters sidebar provider choices to checked profiles with enabled models and supports independent selection', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();

    await user.click(screen.getByRole('button', { name: /主 Provider 配置/i }));
    expect(screen.queryByRole('option', { name: /Baidu Local/i })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 配置 选项/i })).getByRole('option', { name: /New API Mirror/i }));

    await user.click(screen.getByRole('button', { name: /主 Provider 模型/i }));
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 模型 选项/i })).getByRole('option', { name: /gpt-4\.1$/i }));

    await user.click(screen.getByRole('button', { name: /备选 Provider 配置/i }));
    await user.click(within(screen.getByRole('listbox', { name: /备选 Provider 配置 选项/i })).getByRole('option', { name: /Claude Local/i }));

    await user.click(screen.getByRole('button', { name: /备选 Provider 模型/i }));
    await user.click(within(screen.getByRole('listbox', { name: /备选 Provider 模型 选项/i })).getByRole('option', { name: /claude-sonnet/i }));

    expect(screen.getAllByText('New API Mirror').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-4.1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude Local').length).toBeGreaterThan(0);
  });

  it('keeps advanced parameters collapsed by default and opens them in a floating panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();

    expect(screen.queryByLabelText(/Temperature/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /高级参数/i }));

    expect(screen.getByRole('dialog', { name: /高级参数/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Temperature/i)).toBeInTheDocument();
  });

  it('opens Provider Center and saves changes through the server API', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();
    await openProviderCenter(user);

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
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
    await importSubtitle();
    await openProviderCenter(user);

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getAllByRole('button', { name: /检测/i })[0]);
    expect(await within(dialog).findByText('状态：有效')).toBeInTheDocument();
  });

  it('shows compact status copy in Provider Center after connectivity checks', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();
    await openProviderCenter(user);

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getAllByRole('button', { name: /检测/i })[0]);

    expect(await within(dialog).findByText('状态：有效')).toBeInTheDocument();
    expect(within(dialog).queryByText(/连接配置有效，可继续进行模型检查或翻译/i)).not.toBeInTheDocument();
  });

  it('sends the unsaved endpoint and api key when checking a provider profile', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();
    await openProviderCenter(user);

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.clear(within(dialog).getByLabelText(/apiEndpoint/i));
    await user.type(within(dialog).getByLabelText(/apiEndpoint/i), 'https://draft.example.com/v1');
    await user.clear(within(dialog).getByLabelText(/apiKey/i));
    await user.type(within(dialog).getByLabelText(/apiKey/i), 'draft-key');
    await user.click(within(await screen.findByRole('dialog', { name: /Provider Center/i })).getByRole('button', { name: /^检测$/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/provider-center/check',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"apiEndpoint":"https://draft.example.com/v1"'),
        }),
      );
    });

    const checkCall = vi
      .mocked(fetch)
      .mock.calls.find(([requestUrl]) => requestUrl === '/api/provider-center/check');
    const body = JSON.parse(String(checkCall?.[1]?.body ?? '{}'));
    expect(body.profile.connection.apiEndpoint).toBe('https://draft.example.com/v1');
    expect(body.profile.connection.apiKey).toBe('draft-key');
  });

  it('opens the add-provider modal and exposes supported provider types', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();
    await openProviderCenter(user);

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
    await importSubtitle();
    await openProviderCenter(user);

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
    await importSubtitle();
    await openProviderCenter(user);

    const dialog = await screen.findByRole('dialog', { name: /Provider Center/i });
    await user.click(within(dialog).getByRole('button', { name: /^管理$/ }));

    const modelDialog = await within(dialog).findByRole('dialog', { name: /模型管理/i });
    expect(await within(modelDialog).findByText(/发现 2 个模型/i)).toBeInTheDocument();
    expect(within(modelDialog).getByLabelText('gpt-4.1-mini')).toBeInTheDocument();
    expect(within(modelDialog).getByLabelText('gpt-4.1')).toBeInTheDocument();

    const gptMiniRow = within(modelDialog)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('gpt-4.1-mini'));
    expect(gptMiniRow?.textContent?.match(/gpt-4\.1-mini/g)).toHaveLength(1);
    expect(gptMiniRow?.textContent).not.toMatch(/\bauto\b/i);
  });

  it('renders the activity console as a collapsible panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();

    const toggle = screen.getByRole('button', { name: /展开日志/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: /收起日志/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses the selected primary target runtime when starting translation', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();

    await user.click(screen.getByRole('button', { name: /主 Provider 配置/i }));
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 配置 选项/i })).getByRole('option', { name: /New API Mirror/i }));
    await user.click(screen.getByRole('button', { name: /主 Provider 模型/i }));
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 模型 选项/i })).getByRole('option', { name: /gpt-4\.1-mini$/i }));
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
      .mock.calls.find(
        ([requestUrl, options]) =>
          requestUrl === '/api/translate/openai-compatible' &&
          String(options?.body ?? '').includes('"profileId":"openai-compatible-newapi"'),
      );
    const body = JSON.parse(String(translateCall?.[1]?.body ?? '{}'));
    expect(body.runtimeOverrides.apiEndpoint).toBe('https://newapi.example.com/v1');
    expect(body.runtimeOverrides.apiKey).toBe('newapi-key');
    expect(body.options.model).toBe('gpt-4.1-mini');
  });

  it('falls back to the secondary target when the primary target request fails', async () => {
    const user = userEvent.setup();
    renderPage();
    await importSubtitle();

    await user.click(screen.getByRole('button', { name: /主 Provider 配置/i }));
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 配置 选项/i })).getByRole('option', { name: /Local OpenAI/i }));
    await user.click(screen.getByRole('button', { name: /主 Provider 模型/i }));
    await user.click(within(screen.getByRole('listbox', { name: /主 Provider 模型 选项/i })).getByRole('option', { name: /qwen-local/i }));
    await user.click(screen.getByRole('button', { name: /备选 Provider 配置/i }));
    await user.click(within(screen.getByRole('listbox', { name: /备选 Provider 配置 选项/i })).getByRole('option', { name: /Claude Local/i }));
    await user.click(screen.getByRole('button', { name: /备选 Provider 模型/i }));
    await user.click(within(screen.getByRole('listbox', { name: /备选 Provider 模型 选项/i })).getByRole('option', { name: /claude-sonnet/i }));
    await user.click(screen.getByRole('button', { name: /开始翻译/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/translate/claude-compatible',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"profileId":"claude-compatible-default"'),
        }),
      );
    });
  });

  it('keeps checkbox fields out of full-width text input styling and includes floating panel styles', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    expect(css).toContain(".field input:not([type='checkbox'])");
    expect(css).toContain('.advanced-params-popover');
    expect(css).toContain('position: absolute');
  });
});
