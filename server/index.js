import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { createTranslationRunLogger } from './logging/translation-run-logger.js';
import { isFailureTranslation, normalizeTranslationItems } from './providers/response.js';
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

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRunEntry(value) {
  return (
    isObject(value) &&
    Number.isInteger(value.idx) &&
    typeof value.timecode === 'string' &&
    typeof value.text === 'string'
  );
}

function validateRunCreateRequest(payload) {
  if (!isObject(payload)) {
    throw new Error('请求体格式无效');
  }

  if (typeof payload.fileName !== 'string' || payload.fileName.trim() === '') {
    throw new Error('文件名格式无效');
  }

  if (typeof payload.provider !== 'string' || payload.provider.trim() === '') {
    throw new Error('翻译引擎格式无效');
  }

  if (!Number.isInteger(payload.totalEntries) || payload.totalEntries <= 0) {
    throw new Error('字幕总数格式无效');
  }

  if (!Array.isArray(payload.entries) || payload.entries.length !== payload.totalEntries || !payload.entries.every(isRunEntry)) {
    throw new Error('字幕清单格式无效');
  }

  if (!isObject(payload.providerConfig) || !isObject(payload.translationConfig)) {
    throw new Error('运行配置格式无效');
  }

  if (
    payload.mode !== undefined &&
    payload.mode !== 'translate' &&
    payload.mode !== 'retry-all' &&
    payload.mode !== 'retry-single'
  ) {
    throw new Error('运行模式格式无效');
  }

  return {
    runId: typeof payload.runId === 'string' && payload.runId ? payload.runId : randomUUID(),
    fileName: payload.fileName,
    provider: payload.provider,
    totalEntries: payload.totalEntries,
    entries: payload.entries,
    providerConfig: payload.providerConfig,
    translationConfig: payload.translationConfig,
    mode: payload.mode ?? 'translate',
  };
}

function validateRunFinalizeRequest(payload) {
  if (!isObject(payload)) {
    throw new Error('请求体格式无效');
  }

  if (!['completed', 'failed', 'cancelled'].includes(payload.status)) {
    throw new Error('运行状态格式无效');
  }

  if (payload.summary !== undefined && !isObject(payload.summary)) {
    throw new Error('运行汇总格式无效');
  }

  if (payload.error !== undefined && payload.error !== null && !isObject(payload.error)) {
    throw new Error('运行错误格式无效');
  }

  return {
    status: payload.status,
    summary: payload.summary,
    error: payload.error,
  };
}

function normalizeTranslateResult(result) {
  if (Array.isArray(result)) {
    return {
      translations: result,
      debug: {},
    };
  }

  if (!isObject(result) || !Array.isArray(result.translations)) {
    throw new Error('代理返回格式无效');
  }

  return {
    translations: normalizeTranslationItems(result.translations, result.translations.length),
    debug: isObject(result.debug) ? result.debug : {},
  };
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
  const logger =
    options.translationRunLogger ??
    createTranslationRunLogger({
      logDir: options.logDir,
    });

  return async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');

      if (request.method === 'POST' && url.pathname === '/api/translation-runs') {
        const payload = validateRunCreateRequest(await readJsonBody(request));
        const result = await logger.createRun(payload);
        sendJson(response, 200, result);
        return;
      }

      if (
        request.method === 'POST' &&
        url.pathname.startsWith('/api/translation-runs/') &&
        url.pathname.endsWith('/finalize')
      ) {
        const runId = url.pathname.slice('/api/translation-runs/'.length, -'/finalize'.length);
        const payload = validateRunFinalizeRequest(await readJsonBody(request));
        const result = await logger.finalizeRun(runId, payload);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === 'POST' && url.pathname.startsWith('/api/translate/')) {
        const provider = url.pathname.slice('/api/translate/'.length);
        const payload = await readJsonBody(request);
        const validated = validateTranslateRequest(provider, payload);
        try {
          const result = normalizeTranslateResult(
            await translateImpl(
              provider,
              validated,
              new AbortController().signal,
              { env },
            ),
          );

          if (validated.runId && validated.batch) {
            const runEntryList = logger.getRun(validated.runId)?.request?.entries ?? [];
            await logger.appendBatch(validated.runId, {
              provider,
              batch: validated.batch,
              request: {
                texts: validated.texts,
                contextTexts: validated.contextTexts,
                options: validated.options,
              },
              response: {
                translations: result.translations,
                ...(result.debug.response ?? {}),
              },
              fillMapping: validated.texts.map((text, index) => ({
                subtitleIdx: runEntryList[validated.batch.startIndex + index]?.idx ?? null,
                targetIndex: validated.batch.startIndex + index,
                timecode: runEntryList[validated.batch.startIndex + index]?.timecode ?? null,
                sourceText: text,
                translatedText: result.translations[index] ?? '[翻译失败]',
                status: isFailureTranslation(result.translations[index]) ? 'error' : 'done',
              })),
              debug: result.debug,
            });
          }

          sendJson(response, 200, { translations: result.translations });
          return;
        } catch (error) {
          if (validated.runId && validated.batch) {
            const runEntryList = logger.getRun(validated.runId)?.request?.entries ?? [];
            await logger.appendBatch(validated.runId, {
              provider,
              batch: validated.batch,
              request: {
                texts: validated.texts,
                contextTexts: validated.contextTexts,
                options: validated.options,
              },
              response: null,
              fillMapping: validated.texts.map((text, index) => ({
                subtitleIdx: runEntryList[validated.batch.startIndex + index]?.idx ?? null,
                targetIndex: validated.batch.startIndex + index,
                timecode: runEntryList[validated.batch.startIndex + index]?.timecode ?? null,
                sourceText: text,
                translatedText: '[翻译失败]',
                status: 'error',
              })),
              error: {
                message: error instanceof Error ? error.message : '翻译失败',
              },
            });
          }

          throw error;
        }
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
          '文件名格式无效',
          '翻译引擎格式无效',
          '字幕总数格式无效',
          '字幕清单格式无效',
          '运行配置格式无效',
          '运行模式格式无效',
          '运行状态格式无效',
          '运行汇总格式无效',
          '运行错误格式无效',
          '运行标识格式无效',
          '批次元信息格式无效',
        ].includes(message) || message.startsWith('存在不允许的配置项:')
          ? 400
          : message === '翻译任务不存在'
            ? 404
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
