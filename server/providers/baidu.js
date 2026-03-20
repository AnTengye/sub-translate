import { createHash } from 'node:crypto';

function md5(input) {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

export async function translateWithBaidu(request, signal, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;

  if (!env.BAIDU_APP_ID) {
    throw new Error('服务端未配置 BAIDU_APP_ID');
  }

  const query = request.texts.join('\n');
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

  const response = await fetchImpl('https://fanyi-api.baidu.com/ait/api/aiTextTranslate', {
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

  return {
    translations: (data.trans_result ?? []).map((item) => item.dst),
    debug: {
      request: {
        endpoint: 'https://fanyi-api.baidu.com/ait/api/aiTextTranslate',
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
