import { createHash } from 'node:crypto';

const punctuationTokenPairs = [
  ['。', '__SRT_PUNC_STOP__'],
  ['？', '__SRT_PUNC_FW_QUESTION__'],
  ['?', '__SRT_PUNC_QUESTION__'],
  ['！', '__SRT_PUNC_FW_EXCL__'],
  ['!', '__SRT_PUNC_EXCL__'],
  ['…', '__SRT_PUNC_ELLIPSIS__'],
  ['.', '__SRT_PUNC_DOT__'],
];

function md5(input) {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

function shouldPreprocessPunctuation(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function replaceWithTokens(text) {
  return punctuationTokenPairs.reduce(
    (current, [source, token]) => current.split(source).join(token),
    text,
  );
}

function restoreFromTokens(text) {
  return punctuationTokenPairs.reduce(
    (current, [source, token]) => current.split(token).join(source),
    text,
  );
}

function alignTranslationsWithSourceTexts(texts, transResult, restoreText) {
  const alignedTranslations = [];
  let cursor = 0;

  for (const expectedText of texts) {
    let combinedSource = '';
    let combinedTranslation = '';
    let matched = false;

    while (cursor < transResult.length) {
      const item = transResult[cursor];
      const source = typeof item?.src === 'string' ? item.src : '';
      const translation = typeof item?.dst === 'string' ? item.dst : '';

      combinedSource += source;
      combinedTranslation += translation;
      cursor += 1;

      if (combinedSource === expectedText) {
        alignedTranslations.push(restoreText(combinedTranslation));
        matched = true;
        break;
      }

      if (!expectedText.startsWith(combinedSource)) {
        throw new Error('百度翻译结果与原文条目无法对齐');
      }
    }

    if (!matched) {
      throw new Error('百度翻译结果与原文条目无法对齐');
    }
  }

  if (cursor !== transResult.length) {
    throw new Error('百度翻译结果与原文条目无法对齐');
  }

  return alignedTranslations;
}

export async function translateWithBaidu(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const endpoint = env.BAIDU_API_ENDPOINT || 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate';

  if (!env.BAIDU_APP_ID) {
    throw new Error('服务端未配置 BAIDU_APP_ID');
  }

  const punctuationPreprocessingEnabled = shouldPreprocessPunctuation(
    request.options.punctuationPreprocessing,
  );
  const normalizedTexts = punctuationPreprocessingEnabled
    ? request.texts.map(replaceWithTokens)
    : request.texts;
  const query = normalizedTexts.join('\n');
  const body = {
    appid: env.BAIDU_APP_ID,
    from: 'jp',
    to: 'zh',
    q: query,
  };

  if (request.options.modelType) {
    body.model_type = request.options.modelType;
  }
  if (request.options.reference) {
    body.reference = request.options.reference;
  }
  if (request.options.needIntervene !== undefined) {
    body.needIntervene = Number(request.options.needIntervene);
  }
  if (request.options.tagHandling !== undefined) {
    body.tag_handling = Number(request.options.tagHandling);
  }
  if (Array.isArray(request.options.ignoreTags) && request.options.ignoreTags.length > 0) {
    body.ignore_tags = request.options.ignoreTags;
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (env.BAIDU_API_KEY) {
    headers.Authorization = `Bearer ${env.BAIDU_API_KEY}`;
  } else if (env.BAIDU_SECRET_KEY) {
    const salt = String(now());
    body.salt = salt;
    body.sign = md5(`${env.BAIDU_APP_ID}${query}${salt}${env.BAIDU_SECRET_KEY}`);
  } else {
    throw new Error('服务端未配置 BAIDU_API_KEY 或 BAIDU_SECRET_KEY');
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`百度翻译 ${response.status}`);
  }

  const data = await response.json();
  if (data.error_code) {
    throw new Error(`百度翻译错误 ${data.error_code}: ${data.error_msg}`);
  }

  const transResult = Array.isArray(data.trans_result) ? data.trans_result : [];
  const translations = alignTranslationsWithSourceTexts(
    normalizedTexts,
    transResult,
    punctuationPreprocessingEnabled ? restoreFromTokens : (text) => text,
  );

  return {
    translations,
    debug: {
      request: {
        endpoint,
        headers: Object.fromEntries(
          Object.entries(headers).map(([key, value]) => [
            key,
            key.toLowerCase() === 'authorization' ? 'Bearer [REDACTED]' : value,
          ]),
        ),
        payload: body,
      },
      response: {
        status: response.status,
        rawText: JSON.stringify(data),
      },
    },
  };
}
