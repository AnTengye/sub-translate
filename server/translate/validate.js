const providerOptionAllowlist = {
  'claude-compatible': new Set(['model']),
  'openai-compatible': new Set(['model', 'temperature', 'maxTokens', 'disableThinking']),
  baidu: new Set([
    'modelType',
    'reference',
    'needIntervene',
    'tagHandling',
    'ignoreTags',
    'punctuationPreprocessing',
  ]),
};

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidBatchMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return (
    (value.kind === 'translate' || value.kind === 'retry') &&
    Number.isInteger(value.sequence) &&
    Number.isInteger(value.startIndex) &&
    Number.isInteger(value.endIndex) &&
    Number.isInteger(value.totalEntries) &&
    value.sequence >= 1 &&
    value.startIndex >= 0 &&
    value.endIndex >= value.startIndex &&
    value.totalEntries >= value.endIndex + 1
  );
}

export function validateTranslateRequest(provider, payload) {
  const allowedOptions = providerOptionAllowlist[provider];
  if (!allowedOptions) {
    throw new Error('不支持的翻译引擎');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('请求体格式无效');
  }

  const { runId, texts, contextTexts = [], batch, options = {} } = payload;

  if (!isStringArray(texts) || texts.length === 0) {
    throw new Error('至少提供一条待翻译字幕');
  }

  if (runId !== undefined && typeof runId !== 'string') {
    throw new Error('运行标识格式无效');
  }

  if (!isStringArray(contextTexts)) {
    throw new Error('上下文字幕格式无效');
  }

  if (batch !== undefined && !isValidBatchMetadata(batch)) {
    throw new Error('批次元信息格式无效');
  }

  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('配置项格式无效');
  }

  const invalidKeys = Object.keys(options).filter((key) => !allowedOptions.has(key));
  if (invalidKeys.length > 0) {
    throw new Error(`存在不允许的配置项: ${invalidKeys.join(', ')}`);
  }

  return {
    runId,
    texts,
    contextTexts,
    batch,
    options,
  };
}
