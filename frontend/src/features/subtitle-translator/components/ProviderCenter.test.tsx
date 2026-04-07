import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../components/ui/feedback/ToastProvider';
import type { ProviderCenterStateData } from '../provider-center-api';
import { ProviderCenter } from './ProviderCenter';

const providerCenterState: ProviderCenterStateData = {
  version: 1,
  defaultProvider: 'google',
  limits: {
    globalRpmLimit: 0,
    globalRpdLimit: 0,
    rateLimitInterruptThreshold: 3,
  },
  families: {
    google: {
      id: 'google',
      label: 'Google',
      description: '',
      activeProfileId: 'google-profile',
      profiles: [
        {
          id: 'google-profile',
          family: 'google',
          name: 'google',
          enabled: true,
          isDefault: true,
          connection: {
            apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: 'AIza-test',
          },
          settings: {
            model: 'models/gemma-4-26b-a4b-it',
            providerLabel: 'Google',
            disableThinking: '',
          },
          capabilities: {
            supportsConnectionCheck: true,
            supportsManualModelManagement: true,
            supportsModelDiscovery: true,
            supportsThinkingToggle: true,
          },
          rpmLimit: 0,
          rpdLimit: 0,
          models: [
            {
              id: 'models/gemma-4-26b-a4b-it',
              label: 'models/gemma-4-26b-a4b-it',
              enabled: true,
              source: 'auto',
              rpmLimit: 0,
              rpdLimit: 0,
            },
          ],
          availableModels: [],
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
      activeProfileId: 'openai-profile',
      profiles: [],
    },
    'claude-compatible': {
      id: 'claude-compatible',
      label: 'Claude Compatible',
      description: '',
      activeProfileId: 'claude-profile',
      profiles: [],
    },
    baidu: {
      id: 'baidu',
      label: 'Baidu',
      description: '',
      activeProfileId: 'baidu-profile',
      profiles: [],
    },
  },
};

describe('ProviderCenter', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows and saves disableThinking for google profiles', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <ProviderCenter
          isOpen
          initialProvider="google"
          providerCenter={providerCenterState}
          disableSave={false}
          onClose={vi.fn()}
          onSave={onSave}
          onCheck={vi.fn()}
          onLoadModelCatalog={vi.fn()}
        />
      </ToastProvider>,
    );

    const checkbox = screen.getByLabelText('disableThinking');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getAllByRole('button', { name: '保存配置' }).at(-1)!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        families: expect.objectContaining({
          google: expect.objectContaining({
            profiles: [
              expect.objectContaining({
                settings: expect.objectContaining({
                  disableThinking: 'true',
                }),
              }),
            ],
          }),
        }),
      }),
    );
  });

  it('deletes the selected profile and falls back to the next profile in the same family on save', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ToastProvider>
        <ProviderCenter
          isOpen
          initialProvider="google"
          providerCenter={{
            ...providerCenterState,
            families: {
              ...providerCenterState.families,
              google: {
                ...providerCenterState.families.google,
                activeProfileId: 'google-profile',
                profiles: [
                  providerCenterState.families.google.profiles[0],
                  {
                    ...providerCenterState.families.google.profiles[0],
                    id: 'google-backup',
                    name: 'google-backup',
                    isDefault: false,
                  },
                ],
              },
            },
          }}
          disableSave={false}
          onClose={vi.fn()}
          onSave={onSave}
          onCheck={vi.fn()}
          onLoadModelCatalog={vi.fn()}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '删除当前配置' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: '保存配置' }).at(-1)!);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        families: expect.objectContaining({
          google: expect.objectContaining({
            activeProfileId: 'google-backup',
            profiles: [
              expect.objectContaining({
                id: 'google-backup',
              }),
            ],
          }),
        }),
      }),
    );
  });

  it('keeps provider center usable when deleting the last profile in a family', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ToastProvider>
        <ProviderCenter
          isOpen
          initialProvider="google"
          providerCenter={providerCenterState}
          disableSave={false}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onCheck={vi.fn()}
          onLoadModelCatalog={vi.fn()}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '删除当前配置' }).at(-1)!);

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('当前没有可编辑的配置')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ 添加' }).at(-1)).toBeInTheDocument();
  });

  it('saves layered global, profile, and model limits', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <ProviderCenter
          isOpen
          initialProvider="google"
          providerCenter={providerCenterState}
          disableSave={false}
          onClose={vi.fn()}
          onSave={onSave}
          onCheck={vi.fn()}
          onLoadModelCatalog={vi.fn()}
        />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText('全局 RPM 默认限制'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('全局 RPD 默认限制'), { target: { value: '2400' } });
    fireEvent.change(screen.getByLabelText('限流中断阈值'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Profile RPM 限制'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Profile RPD 限制'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('models/gemma-4-26b-a4b-it RPD 限制'), { target: { value: '200' } });
    fireEvent.click(screen.getAllByRole('button', { name: '保存配置' }).at(-1)!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        limits: {
          globalRpmLimit: 120,
          globalRpdLimit: 2400,
          rateLimitInterruptThreshold: 5,
        },
        families: expect.objectContaining({
          google: expect.objectContaining({
            profiles: [
              expect.objectContaining({
                rpmLimit: 60,
                rpdLimit: 1000,
                models: [
                  expect.objectContaining({
                    id: 'models/gemma-4-26b-a4b-it',
                    rpdLimit: 200,
                  }),
                ],
              }),
            ],
          }),
        }),
      }),
    );
  });
});
