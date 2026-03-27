const providerFamilies = ['openai-compatible', 'claude-compatible', 'baidu'];

function createHealthState() {
  return {
    status: 'idle',
    summary: '未检查',
    lastCheckedAt: null,
    error: null,
  };
}

function createDiscoveryState(sourceMode, supportsModelDiscovery) {
  return {
    sourceMode,
    supportsModelDiscovery,
    lastCheckedAt: null,
    lastStatus: 'idle',
    lastError: null,
  };
}

function createProfileBase({ id, family, name, enabled, isDefault, connection, settings, capabilities }) {
  return {
    id,
    family,
    name,
    enabled,
    isDefault,
    connection,
    settings,
    capabilities,
    models: [],
    modelDiscovery: createDiscoveryState('auto', capabilities.supportsModelDiscovery),
    health: createHealthState(),
  };
}

export function createProviderCenterSeed(env = {}) {
  const defaultProvider = providerFamilies.includes(env.VITE_DEFAULT_PROVIDER)
    ? env.VITE_DEFAULT_PROVIDER
    : 'openai-compatible';

  return {
    version: 1,
    defaultProvider,
    families: {
      'openai-compatible': {
        id: 'openai-compatible',
        label: 'OpenAI Compatible',
        description: '适用于兼容 OpenAI 模型接口的服务。',
        activeProfileId: 'openai-compatible-default',
        profiles: [
          createProfileBase({
            id: 'openai-compatible-default',
            family: 'openai-compatible',
            name: 'Default OpenAI',
            enabled: true,
            isDefault: defaultProvider === 'openai-compatible',
            connection: {
              apiEndpoint: env.OPENAI_API_ENDPOINT || '',
              apiKey: env.OPENAI_API_KEY || '',
            },
            settings: {
              model: env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
              disableThinking: '',
            },
            capabilities: {
              supportsModelDiscovery: true,
              supportsConnectionCheck: true,
              supportsManualModelManagement: true,
              supportsThinkingToggle: true,
            },
          }),
        ],
      },
      'claude-compatible': {
        id: 'claude-compatible',
        label: 'Claude Compatible',
        description: '适用于兼容 Anthropic 模型接口的服务。',
        activeProfileId: 'claude-compatible-default',
        profiles: [
          createProfileBase({
            id: 'claude-compatible-default',
            family: 'claude-compatible',
            name: 'Default Claude',
            enabled: true,
            isDefault: defaultProvider === 'claude-compatible',
            connection: {
              apiEndpoint: env.CLAUDE_API_ENDPOINT || '',
              apiKey: env.CLAUDE_API_KEY || '',
            },
            settings: {
              model: env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-latest',
            },
            capabilities: {
              supportsModelDiscovery: false,
              supportsConnectionCheck: true,
              supportsManualModelManagement: true,
              supportsThinkingToggle: false,
            },
          }),
        ],
      },
      baidu: {
        id: 'baidu',
        label: 'Baidu',
        description: '百度大模型翻译服务。',
        activeProfileId: 'baidu-default',
        profiles: [
          createProfileBase({
            id: 'baidu-default',
            family: 'baidu',
            name: 'Default Baidu',
            enabled: true,
            isDefault: defaultProvider === 'baidu',
            connection: {
              apiEndpoint: env.BAIDU_API_ENDPOINT || '',
              appId: env.BAIDU_APP_ID || '',
              apiKey: env.BAIDU_API_KEY || '',
              secretKey: env.BAIDU_SECRET_KEY || '',
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
          }),
        ],
      },
    },
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isModel(value) {
  return isObject(value) && typeof value.id === 'string' && typeof value.label === 'string';
}

function isProfile(value) {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.family === 'string' &&
    typeof value.name === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.isDefault === 'boolean' &&
    isObject(value.connection) &&
    isObject(value.settings) &&
    isObject(value.capabilities) &&
    Array.isArray(value.models) &&
    value.models.every(isModel) &&
    (value.availableModels === undefined ||
      (Array.isArray(value.availableModels) && value.availableModels.every(isModel))) &&
    isObject(value.modelDiscovery) &&
    isObject(value.health)
  );
}

function isFamily(value) {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.description === 'string' &&
    typeof value.activeProfileId === 'string' &&
    Array.isArray(value.profiles) &&
    value.profiles.every(isProfile)
  );
}

export function isProviderCenterState(value) {
  return (
    isObject(value) &&
    value.version === 1 &&
    providerFamilies.includes(value.defaultProvider) &&
    isObject(value.families) &&
    providerFamilies.every((family) => isFamily(value.families[family]))
  );
}
