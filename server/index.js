import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import { dispatchServerTranslate } from './providers/index.js';
import { validateTranslateRequest } from './translate/validate.js';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const body = chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(body);
      } catch {
        reject(new Error('请求体必须是合法 JSON'));
      }
    });
    request.on('error', reject);
  });
}

async function serveStaticFile(response, distDir, requestPath) {
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const targetPath = join(distDir, safePath);

  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isFile()) {
      throw new Error('not-file');
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(targetPath)] || 'application/octet-stream',
    });
    createReadStream(targetPath).pipe(response);
    return true;
  } catch {
    return false;
  }
}

async function serveIndexHtml(response, distDir) {
  const indexPath = join(distDir, 'index.html');
  await access(indexPath);
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
  });
  createReadStream(indexPath).pipe(response);
}

export function createAppHandler(options = {}) {
  const distDir = options.distDir ?? join(process.cwd(), 'dist');
  const translateImpl = options.translateImpl ?? dispatchServerTranslate;
  const env = options.env ?? process.env;

  return async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');

      if (request.method === 'POST' && url.pathname.startsWith('/api/translate/')) {
        const provider = url.pathname.slice('/api/translate/'.length);
        const payload = await readJsonBody(request);
        const validated = validateTranslateRequest(provider, payload);
        const translations = await translateImpl(
          provider,
          validated,
          new AbortController().signal,
          { env },
        );
        sendJson(response, 200, { translations });
        return;
      }

      if (url.pathname !== '/' && (await serveStaticFile(response, distDir, url.pathname.slice(1)))) {
        return;
      }

      await serveIndexHtml(response, distDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务异常';
      const statusCode =
        [
          '不支持的翻译引擎',
          '请求体必须是合法 JSON',
          '至少提供一条待翻译字幕',
          '上下文字幕格式无效',
          '配置项格式无效',
          '请求体格式无效',
        ].includes(message) || message.startsWith('存在不允许的配置项:')
          ? 400
          : 500;

      sendJson(response, statusCode, {
        error: message,
      });
    }
  };
}

export function createAppServer(options = {}) {
  return http.createServer(createAppHandler(options));
}
