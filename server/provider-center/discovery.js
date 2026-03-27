function normalizeOpenAiModels(payload) {
  if (!payload || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      label: item.id,
      enabled: true,
      source: 'auto',
    }));
}

function normalizeOpenAiEndpoint(endpoint, providerLabel) {
  const trimmed = String(endpoint || '').trim().replace(/\/$/, '');
  if (!trimmed) {
    return trimmed;
  }

  if (providerLabel === 'New API' && !/\/v\d+$/i.test(trimmed)) {
    return `${trimmed}/v1`;
  }

  return trimmed;
}

export async function discoverModelsForProfile(profile) {
  if (!profile.capabilities?.supportsModelDiscovery) {
    return {
      models: profile.models ?? [],
      summary: '当前 provider 不支持自动发现模型',
      supportsModelDiscovery: false,
    };
  }

  if (profile.family === 'openai-compatible') {
    const endpoint = normalizeOpenAiEndpoint(
      profile.connection.apiEndpoint,
      profile.settings?.providerLabel,
    );
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${profile.connection.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`模型发现失败 ${response.status}`);
    }

    const data = await response.json();
    const models = normalizeOpenAiModels(data);
    return {
      models,
      summary: `发现 ${models.length} 个模型`,
      supportsModelDiscovery: true,
    };
  }

  return {
    models: profile.models ?? [],
    summary: '当前 provider 仅支持手动模型管理',
    supportsModelDiscovery: false,
  };
}
