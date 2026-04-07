import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/feedback/ToastProvider';
import SubtitleTranslatorPage from './SubtitleTranslatorPage';

const providerCenterState = {
  version: 1,
  defaultProvider: 'openai-compatible',
  families: {
    google: {
      id: 'google',
      label: 'Google',
      description: '',
      activeProfileId: 'google-default',
      profiles: [
        {
          id: 'google-default',
          family: 'google',
          name: 'Google Local',
          enabled: true,
          isDefault: false,
          connection: {
            apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: 'google-key',
          },
          settings: {
            model: 'models/gemini-2.5-flash',
            providerLabel: 'Google',
            disableThinking: '',
          },
          capabilities: {
            supportsModelDiscovery: true,
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsThinkingToggle: true,
          },
          models: [{ id: 'models/gemini-2.5-flash', label: 'models/gemini-2.5-flash', enabled: true, source: 'manual' }],
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
      ],
    },
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
          models: [{ id: 'claude-sonnet', label: 'claude-sonnet', enabled: true, source: 'manual' }],
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
          models: [{ id: 'llm', label: 'llm', enabled: true, source: 'manual' }],
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

const workflowTemplates = {
  version: 1,
  templates: [
    {
      id: 'quality-first',
      name: '质量优先',
      description: '主翻译失败后补偿，再校对。',
      scenario: 'translation',
      stages: [
        {
          id: 'translate',
          name: '主翻译与补偿',
          type: 'translate',
          execution: 'serial',
          strategy: 'fallback',
          nodes: [
            {
              id: 'primary',
              label: '主翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: {
                family: 'openai-compatible',
                profileId: 'openai-compatible-default',
                modelId: 'gpt-4.1-mini',
              },
            },
            {
              id: 'fallback',
              label: '补偿翻译',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: {
                family: 'claude-compatible',
                profileId: 'claude-compatible-default',
                modelId: 'claude-sonnet',
              },
            },
          ],
        },
        {
          id: 'review',
          name: '校对',
          type: 'review',
          execution: 'serial',
          strategy: 'replace-current',
          nodes: [
            {
              id: 'reviewer',
              label: '校对',
              type: 'review',
              enabled: true,
              prompt: '',
              target: {
                family: 'openai-compatible',
                profileId: 'openai-compatible-default',
                modelId: 'gpt-4.1-mini',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'compare',
      name: '双路比对',
      description: '并行候选 + judge',
      scenario: 'comparison',
      stages: [
        {
          id: 'translate',
          name: '候选翻译',
          type: 'translate',
          execution: 'parallel',
          strategy: 'keep-all',
          nodes: [
            {
              id: 'candidate-a',
              label: '候选 A',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: {
                family: 'openai-compatible',
                profileId: 'openai-compatible-default',
                modelId: 'gpt-4.1-mini',
              },
            },
            {
              id: 'candidate-b',
              label: '候选 B',
              type: 'translate',
              enabled: true,
              prompt: '',
              target: {
                family: 'claude-compatible',
                profileId: 'claude-compatible-default',
                modelId: 'claude-sonnet',
              },
            },
          ],
        },
        {
          id: 'judge',
          name: '评估推荐',
          type: 'judge',
          execution: 'serial',
          strategy: 'manual-review',
          nodes: [
            {
              id: 'judge',
              label: '评估',
              type: 'judge',
              enabled: true,
              prompt: '',
              target: {
                family: 'openai-compatible',
                profileId: 'openai-compatible-default',
                modelId: 'gpt-4.1-mini',
              },
            },
          ],
        },
      ],
    },
  ],
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

    if (url === '/api/workflow-templates' && (!init || init.method === undefined)) {
      return new Response(JSON.stringify(workflowTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/workflow-templates' && init?.method === 'PUT') {
      return new Response(String(init.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

      if (body.operation === 'judge') {
        return new Response(
          JSON.stringify({
            translations: ['你好', '世间'],
            metadata: {
              decisions: [
                { winner: 'candidate-a', reason: '更自然' },
                { winner: 'candidate-b', reason: '更准确' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (body.operation === 'review') {
        return new Response(JSON.stringify({ translations: ['你好呀', '世界呀'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.profileId === 'openai-compatible-default' && body.options.model === 'qwen-local') {
        return new Response(JSON.stringify({ translations: ['你好', '[翻译失败]'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ translations: ['你好', '世界'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/translate/claude-compatible') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.operation === 'translate' && Array.isArray(body.texts) && body.texts.length === 1) {
        return new Response(JSON.stringify({ translations: ['世界'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ translations: ['您好', '世间'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function createAbortError() {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
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
  const file = new File(
    [
      '1\n00:00:01,000 --> 00:00:02,000\nこんにちは\n\n2\n00:00:03,000 --> 00:00:04,000\n世界\n',
    ],
    'sample.srt',
    {
      type: 'text/plain',
    },
  );

  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('button', { name: /开始工作流/i });
}

describe('SubtitleTranslatorPage workflow mode', () => {
  it('loads workflow templates and switches active template', async () => {
    renderPage();
    await importSubtitle();

    const selector = await screen.findByLabelText(/工作流模板/i);
    expect(selector).toHaveValue('quality-first');
    expect(screen.getByText(/主翻译与补偿/i)).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'compare' } });

    expect(screen.getByText(/候选翻译/i)).toBeInTheDocument();
    expect(screen.getByText(/评估推荐/i)).toBeInTheDocument();
  });

  it('saves edited workflow template targets back to the backend', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof createFetchMock>;
    renderPage();
    await importSubtitle();

    fireEvent.change(await screen.findByLabelText(/主翻译 模型/i), {
      target: { value: 'openai-compatible::openai-compatible-default::gpt-4.1-mini' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存工作流模板/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/workflow-templates',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('gpt-4.1-mini'),
        }),
      ),
    );
  });

  it('executes compare workflow and allows manual candidate override', async () => {
    renderPage();
    await importSubtitle();

    fireEvent.change(await screen.findByLabelText(/工作流模板/i), { target: { value: 'compare' } });
    fireEvent.click(screen.getByRole('button', { name: /开始工作流/i }));

    expect(await screen.findByText(/推荐结果/i)).toBeInTheDocument();
    expect(screen.getByText(/更自然/i)).toBeInTheDocument();
    expect(screen.getByText(/更准确/i)).toBeInTheDocument();

    const secondSelector = screen.getByLabelText(/条目 2 候选选择/i);
    expect(secondSelector).toHaveValue('candidate-b');

    fireEvent.change(secondSelector, { target: { value: 'candidate-a' } });

    expect(secondSelector).toHaveValue('candidate-a');
    const secondCard = secondSelector.closest('.sub-card');
    expect(secondCard).not.toBeNull();
    expect(within(secondCard as HTMLElement).getByText('世界', { selector: '.sub-text.translated' })).toBeInTheDocument();
  });

  it('shows a stop control during workflow execution and finalizes the run as cancelled', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/provider-center' && (!init || init.method === undefined)) {
        return Promise.resolve(
          new Response(JSON.stringify(providerCenterState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url === '/api/workflow-templates' && (!init || init.method === undefined)) {
        return Promise.resolve(
          new Response(JSON.stringify(workflowTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url === '/api/translation-runs') {
        return Promise.resolve(
          new Response(JSON.stringify({ runId: 'run-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url === '/api/translation-runs/run-1/finalize') {
        return Promise.resolve(
          new Response(JSON.stringify({ runId: 'run-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url === '/api/translate/openai-compatible') {
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(createAbortError());
            return;
          }
          signal?.addEventListener('abort', () => reject(createAbortError()), { once: true });
        });
      }

      if (url === '/api/translate/claude-compatible') {
        return Promise.resolve(
          new Response(JSON.stringify({ translations: ['您好', '世间'] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await importSubtitle();
    fireEvent.click(screen.getByRole('button', { name: /开始工作流/i }));

    expect(await screen.findByRole('button', { name: /终止工作流/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /终止工作流/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/translation-runs/run-1/finalize',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"status":"cancelled"'),
        }),
      ),
    );
  });
});
