function md5(input: string) {
  function rotateLeft(value: number, shift: number) {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(left: number, right: number) {
    const leftHigh = left & 0x80000000;
    const rightHigh = right & 0x80000000;
    const leftMid = left & 0x40000000;
    const rightMid = right & 0x40000000;
    const result = (left & 0x3fffffff) + (right & 0x3fffffff);

    if (leftMid && rightMid) {
      return result ^ 0x80000000 ^ leftHigh ^ rightHigh;
    }

    if (leftMid || rightMid) {
      if (result & 0x40000000) {
        return result ^ 0xc0000000 ^ leftHigh ^ rightHigh;
      }

      return result ^ 0x40000000 ^ leftHigh ^ rightHigh;
    }

    return result ^ leftHigh ^ rightHigh;
  }

  function f(x: number, y: number, z: number) {
    return (x & y) | (~x & z);
  }

  function g(x: number, y: number, z: number) {
    return (x & z) | (y & ~z);
  }

  function h(x: number, y: number, z: number) {
    return x ^ y ^ z;
  }

  function i(x: number, y: number, z: number) {
    return y ^ (x | ~z);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac)), s), b);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac)), s), b);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac)), s), b);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    return addUnsigned(rotateLeft(addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac)), s), b);
  }

  function convertToWordArray(text: string) {
    const words: number[] = [];
    let index = 0;

    while (index < text.length) {
      const wordIndex = (index - (index % 4)) / 4;
      const bytePosition = (index % 4) * 8;
      words[wordIndex] = (words[wordIndex] || 0) | (text.charCodeAt(index) << bytePosition);
      index += 1;
    }

    const wordIndex = (index - (index % 4)) / 4;
    const bytePosition = (index % 4) * 8;
    words[wordIndex] = (words[wordIndex] || 0) | (0x80 << bytePosition);
    words[(((index + 8) - ((index + 8) % 64)) / 64 + 1) * 16 - 2] = text.length << 3;
    words[(((index + 8) - ((index + 8) % 64)) / 64 + 1) * 16 - 1] = text.length >>> 29;

    return words;
  }

  function wordToHex(value: number) {
    return Array.from({ length: 4 }, (_, index) => {
      const byte = (value >>> (index * 8)) & 255;
      return `0${byte.toString(16)}`.slice(-2);
    }).join('');
  }

  function utf8Encode(text: string) {
    return unescape(encodeURIComponent(text));
  }

  const words = convertToWordArray(utf8Encode(input));
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let index = 0; index < words.length; index += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = ff(a, b, c, d, words[index + 0] || 0, 7, 0xd76aa478);
    d = ff(d, a, b, c, words[index + 1] || 0, 12, 0xe8c7b756);
    c = ff(c, d, a, b, words[index + 2] || 0, 17, 0x242070db);
    b = ff(b, c, d, a, words[index + 3] || 0, 22, 0xc1bdceee);
    a = ff(a, b, c, d, words[index + 4] || 0, 7, 0xf57c0faf);
    d = ff(d, a, b, c, words[index + 5] || 0, 12, 0x4787c62a);
    c = ff(c, d, a, b, words[index + 6] || 0, 17, 0xa8304613);
    b = ff(b, c, d, a, words[index + 7] || 0, 22, 0xfd469501);
    a = ff(a, b, c, d, words[index + 8] || 0, 7, 0x698098d8);
    d = ff(d, a, b, c, words[index + 9] || 0, 12, 0x8b44f7af);
    c = ff(c, d, a, b, words[index + 10] || 0, 17, 0xffff5bb1);
    b = ff(b, c, d, a, words[index + 11] || 0, 22, 0x895cd7be);
    a = ff(a, b, c, d, words[index + 12] || 0, 7, 0x6b901122);
    d = ff(d, a, b, c, words[index + 13] || 0, 12, 0xfd987193);
    c = ff(c, d, a, b, words[index + 14] || 0, 17, 0xa679438e);
    b = ff(b, c, d, a, words[index + 15] || 0, 22, 0x49b40821);

    a = gg(a, b, c, d, words[index + 1] || 0, 5, 0xf61e2562);
    d = gg(d, a, b, c, words[index + 6] || 0, 9, 0xc040b340);
    c = gg(c, d, a, b, words[index + 11] || 0, 14, 0x265e5a51);
    b = gg(b, c, d, a, words[index + 0] || 0, 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, words[index + 5] || 0, 5, 0xd62f105d);
    d = gg(d, a, b, c, words[index + 10] || 0, 9, 0x02441453);
    c = gg(c, d, a, b, words[index + 15] || 0, 14, 0xd8a1e681);
    b = gg(b, c, d, a, words[index + 4] || 0, 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, words[index + 9] || 0, 5, 0x21e1cde6);
    d = gg(d, a, b, c, words[index + 14] || 0, 9, 0xc33707d6);
    c = gg(c, d, a, b, words[index + 3] || 0, 14, 0xf4d50d87);
    b = gg(b, c, d, a, words[index + 8] || 0, 20, 0x455a14ed);
    a = gg(a, b, c, d, words[index + 13] || 0, 5, 0xa9e3e905);
    d = gg(d, a, b, c, words[index + 2] || 0, 9, 0xfcefa3f8);
    c = gg(c, d, a, b, words[index + 7] || 0, 14, 0x676f02d9);
    b = gg(b, c, d, a, words[index + 12] || 0, 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, words[index + 5] || 0, 4, 0xfffa3942);
    d = hh(d, a, b, c, words[index + 8] || 0, 11, 0x8771f681);
    c = hh(c, d, a, b, words[index + 11] || 0, 16, 0x6d9d6122);
    b = hh(b, c, d, a, words[index + 14] || 0, 23, 0xfde5380c);
    a = hh(a, b, c, d, words[index + 1] || 0, 4, 0xa4beea44);
    d = hh(d, a, b, c, words[index + 4] || 0, 11, 0x4bdecfa9);
    c = hh(c, d, a, b, words[index + 7] || 0, 16, 0xf6bb4b60);
    b = hh(b, c, d, a, words[index + 10] || 0, 23, 0xbebfbc70);
    a = hh(a, b, c, d, words[index + 13] || 0, 4, 0x289b7ec6);
    d = hh(d, a, b, c, words[index + 0] || 0, 11, 0xeaa127fa);
    c = hh(c, d, a, b, words[index + 3] || 0, 16, 0xd4ef3085);
    b = hh(b, c, d, a, words[index + 6] || 0, 23, 0x04881d05);
    a = hh(a, b, c, d, words[index + 9] || 0, 4, 0xd9d4d039);
    d = hh(d, a, b, c, words[index + 12] || 0, 11, 0xe6db99e5);
    c = hh(c, d, a, b, words[index + 15] || 0, 16, 0x1fa27cf8);
    b = hh(b, c, d, a, words[index + 2] || 0, 23, 0xc4ac5665);

    a = ii(a, b, c, d, words[index + 0] || 0, 6, 0xf4292244);
    d = ii(d, a, b, c, words[index + 7] || 0, 10, 0x432aff97);
    c = ii(c, d, a, b, words[index + 14] || 0, 15, 0xab9423a7);
    b = ii(b, c, d, a, words[index + 5] || 0, 21, 0xfc93a039);
    a = ii(a, b, c, d, words[index + 12] || 0, 6, 0x655b59c3);
    d = ii(d, a, b, c, words[index + 3] || 0, 10, 0x8f0ccc92);
    c = ii(c, d, a, b, words[index + 10] || 0, 15, 0xffeff47d);
    b = ii(b, c, d, a, words[index + 1] || 0, 21, 0x85845dd1);
    a = ii(a, b, c, d, words[index + 8] || 0, 6, 0x6fa87e4f);
    d = ii(d, a, b, c, words[index + 15] || 0, 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, words[index + 6] || 0, 15, 0xa3014314);
    b = ii(b, c, d, a, words[index + 13] || 0, 21, 0x4e0811a1);
    a = ii(a, b, c, d, words[index + 4] || 0, 6, 0xf7537e82);
    d = ii(d, a, b, c, words[index + 11] || 0, 10, 0xbd3af235);
    c = ii(c, d, a, b, words[index + 2] || 0, 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, words[index + 9] || 0, 21, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return `${wordToHex(a)}${wordToHex(b)}${wordToHex(c)}${wordToHex(d)}`;
}

export async function translateWithBaidu(
  texts: string[],
  _contextTexts: string[],
  config: Record<string, string>,
  signal: AbortSignal,
): Promise<string[]> {
  if (!config.appId || !config.secretKey) {
    throw new Error('请填写百度翻译 APP ID 和密钥');
  }

  const salt = Date.now().toString();
  const query = texts.join('\n');
  const sign = md5(`${config.appId}${query}${salt}${config.secretKey}`);
  const params = new URLSearchParams({
    q: query,
    from: 'jp',
    to: 'zh',
    appid: config.appId,
    salt,
    sign,
  });

  const baseUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
  const requestUrl = config.proxyUrl ? `${config.proxyUrl.replace(/\/$/, '')}/${baseUrl}` : baseUrl;
  const response = await fetch(requestUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`百度翻译 ${response.status}`);
  }

  const data = await response.json();
  if (data.error_code) {
    throw new Error(`百度翻译错误 ${data.error_code}: ${data.error_msg}`);
  }

  return data.trans_result.map((item: { dst: string }) => item.dst);
}
