export async function checkProfileHealth(profile) {
  if (profile.family === 'openai-compatible' || profile.family === 'claude-compatible') {
    if (!profile.connection.apiEndpoint || !profile.connection.apiKey) {
      return {
        status: 'warning',
        summary: '缺少 endpoint 或 API Key',
        error: null,
      };
    }

    return {
      status: 'success',
      summary: '连接配置有效，可继续进行模型检查或翻译',
      error: null,
    };
  }

  if (profile.family === 'baidu') {
    if (
      !profile.connection.apiEndpoint ||
      !profile.connection.appId ||
      !profile.connection.apiKey ||
      !profile.connection.secretKey
    ) {
      return {
        status: 'warning',
        summary: '百度配置未完成',
        error: null,
      };
    }

    return {
      status: 'success',
      summary: '百度配置有效，可发起翻译',
      error: null,
    };
  }

  return {
    status: 'failed',
    summary: '未知 provider',
    error: 'unknown-provider',
  };
}
