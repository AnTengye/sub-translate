const providerOptionAllowlist = {
  claude: new Set(['model']),
  openai: new Set(['endpoint', 'model', 'temperature']),
  qwen: new Set(['qwenModel', 'temperature']),
  baidu: new Set(['modelType', 'reference', 'needIntervene', 'tagHandling', 'ignoreTags']),
};

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateTranslateRequest(provider, payload) {
  const allowedOptions = providerOptionAllowlist[provider];
  if (!allowedOptions) {
    throw new Error('不支持的翻译引擎');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('请求体格式无效');
  }

  const { texts, contextTexts = [], options = {} } = payload;

  if (!isStringArray(texts) || texts.length === 0) {
    throw new Error('至少提供一条待翻译字幕');
  }

  if (!isStringArray(contextTexts)) {
    throw new Error('上下文字幕格式无效');
  }

  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('配置项格式无效');
  }

  const invalidKeys = Object.keys(options).filter((key) => !allowedOptions.has(key));
  if (invalidKeys.length > 0) {
    throw new Error(`存在不允许的配置项: ${invalidKeys.join(', ')}`);
  }

  return {
    texts,
    contextTexts,
    options,
  };
}
