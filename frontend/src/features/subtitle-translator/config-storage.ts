import type { ProviderId } from '../../lib/providers/types';

export const providerProfilesStorageKey = 'srt-translate.provider-profiles';

export interface OpenAiProfileConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  disableThinking: string;
}

export interface ClaudeProfileConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
}

export interface BaiduProfileConfig {
  apiEndpoint: string;
  appId: string;
  apiKey: string;
  secretKey: string;
  modelType: string;
  reference: string;
  punctuationPreprocessing: string;
}

export interface ProviderProfileConfigMap {
  'openai-compatible': OpenAiProfileConfig;
  'claude-compatible': ClaudeProfileConfig;
  baidu: BaiduProfileConfig;
}

export interface ProviderProfile<P extends ProviderId = ProviderId> {
  id: string;
  name: string;
  config: ProviderProfileConfigMap[P];
}

export interface ProviderProfileGroup<P extends ProviderId = ProviderId> {
  activeProfileId: string;
  profiles: Array<ProviderProfile<P>>;
}

export interface ProviderProfileStorageData {
  version: 1;
  defaultProvider: ProviderId;
  providers: {
    'openai-compatible': ProviderProfileGroup<'openai-compatible'>;
    'claude-compatible': ProviderProfileGroup<'claude-compatible'>;
    baidu: ProviderProfileGroup<'baidu'>;
  };
}

export interface ProviderRuntimeSeeds {
  defaultProvider: ProviderId;
  providers: {
    'openai-compatible': OpenAiProfileConfig & { profileName: string };
    'claude-compatible': ClaudeProfileConfig & { profileName: string };
    baidu: BaiduProfileConfig & { profileName: string };
  };
}

export function getActiveProviderProfile<P extends ProviderId>(
  data: ProviderProfileStorageData,
  provider: P,
): ProviderProfile<P> {
  const group = data.providers[provider];
  return (
    group.profiles.find((profile) => profile.id === group.activeProfileId) ??
    group.profiles[0]
  ) as ProviderProfile<P>;
}

export function updateActiveProviderProfileConfig(
  data: ProviderProfileStorageData,
  provider: ProviderId,
  config: Record<string, string>,
): ProviderProfileStorageData {
  const group = data.providers[provider];

  return {
    ...data,
    providers: {
      ...data.providers,
      [provider]: {
        ...group,
        profiles: group.profiles.map((profile) =>
          profile.id === group.activeProfileId
            ? {
                ...profile,
                config: {
                  ...profile.config,
                  ...config,
                },
              }
            : profile,
        ),
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProfile(value: unknown): value is ProviderProfile {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isObject(value.config)
  );
}

function isProfileGroup(value: unknown): value is ProviderProfileGroup {
  return (
    isObject(value) &&
    typeof value.activeProfileId === 'string' &&
    Array.isArray(value.profiles) &&
    value.profiles.every(isProfile)
  );
}

function isProviderProfileStorageData(value: unknown): value is ProviderProfileStorageData {
  return (
    isObject(value) &&
    value.version === 1 &&
    (value.defaultProvider === 'openai-compatible' ||
      value.defaultProvider === 'claude-compatible' ||
      value.defaultProvider === 'baidu') &&
    isObject(value.providers) &&
    isProfileGroup(value.providers['openai-compatible']) &&
    isProfileGroup(value.providers['claude-compatible']) &&
    isProfileGroup(value.providers.baidu)
  );
}

export function createDefaultProviderProfiles(
  seeds: ProviderRuntimeSeeds,
): ProviderProfileStorageData {
  return {
    version: 1,
    defaultProvider: seeds.defaultProvider,
    providers: {
      'openai-compatible': {
        activeProfileId: 'openai-compatible-default',
        profiles: [
          {
            id: 'openai-compatible-default',
            name: seeds.providers['openai-compatible'].profileName,
            config: {
              apiEndpoint: seeds.providers['openai-compatible'].apiEndpoint,
              apiKey: seeds.providers['openai-compatible'].apiKey,
              model: seeds.providers['openai-compatible'].model,
              disableThinking: seeds.providers['openai-compatible'].disableThinking,
            },
          },
        ],
      },
      'claude-compatible': {
        activeProfileId: 'claude-compatible-default',
        profiles: [
          {
            id: 'claude-compatible-default',
            name: seeds.providers['claude-compatible'].profileName,
            config: {
              apiEndpoint: seeds.providers['claude-compatible'].apiEndpoint,
              apiKey: seeds.providers['claude-compatible'].apiKey,
              model: seeds.providers['claude-compatible'].model,
            },
          },
        ],
      },
      baidu: {
        activeProfileId: 'baidu-default',
        profiles: [
          {
            id: 'baidu-default',
            name: seeds.providers.baidu.profileName,
            config: {
              apiEndpoint: seeds.providers.baidu.apiEndpoint,
              appId: seeds.providers.baidu.appId,
              apiKey: seeds.providers.baidu.apiKey,
              secretKey: seeds.providers.baidu.secretKey,
              modelType: seeds.providers.baidu.modelType,
              reference: seeds.providers.baidu.reference,
              punctuationPreprocessing: seeds.providers.baidu.punctuationPreprocessing,
            },
          },
        ],
      },
    },
  };
}

export function saveProviderProfiles(data: ProviderProfileStorageData) {
  window.localStorage.setItem(providerProfilesStorageKey, JSON.stringify(data));
}

export function loadProviderProfiles(seeds: ProviderRuntimeSeeds): ProviderProfileStorageData {
  const raw = window.localStorage.getItem(providerProfilesStorageKey);
  if (!raw) {
    return createDefaultProviderProfiles(seeds);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isProviderProfileStorageData(parsed)) {
      return parsed;
    }
  } catch {
    // Fall back to seeded defaults.
  }

  return createDefaultProviderProfiles(seeds);
}
