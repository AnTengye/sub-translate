import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppServer } from './index.js';

async function startServer(options = {}) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl =
    typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';

  return {
    server,
    baseUrl,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

describe('createAppServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates and finalizes a translation run log file', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'srt-translate-dist-'));
    const logDir = await mkdtemp(join(tmpdir(), 'srt-translate-logs-'));
    await writeFile(join(distDir, 'index.html'), '<!doctype html><html><body>spa</body></html>', 'utf8');

    const app = await startServer({
      distDir,
      logDir,
      translateImpl: vi.fn().mockResolvedValue({
        translations: ['你好'],
        debug: {
          request: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            payload: {
              model: 'gpt-4o-mini',
            },
          },
          response: {
            rawText: '["你好"]',
          },
        },
      }),
      env: {
        NODE_ENV: 'test',
      },
    });

    const createResponse = await fetch(`${app.baseUrl}/api/translation-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'sample.srt',
        provider: 'openai',
        totalEntries: 1,
        entries: [
          {
            idx: 1,
            timecode: '00:00:01,000 --> 00:00:02,000',
            text: 'こんにちは',
          },
        ],
        providerConfig: {
          model: 'gpt-4o-mini',
        },
        translationConfig: {
          batchSize: 20,
          contextLines: 3,
          temperature: 0.3,
        },
      }),
    });

    expect(createResponse.status).toBe(200);
    const createData = await createResponse.json();
    expect(createData.runId).toEqual(expect.any(String));

    const translateResponse = await fetch(`${app.baseUrl}/api/translate/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runId: createData.runId,
        texts: ['こんにちは'],
        contextTexts: [],
        batch: {
          kind: 'translate',
          sequence: 1,
          startIndex: 0,
          endIndex: 0,
          totalEntries: 1,
        },
        options: {
          model: 'gpt-4o-mini',
        },
      }),
    });

    expect(translateResponse.status).toBe(200);

    const finalizeResponse = await fetch(`${app.baseUrl}/api/translation-runs/${createData.runId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        summary: {
          totalEntries: 1,
          translatedCount: 1,
          errorCount: 0,
        },
      }),
    });

    expect(finalizeResponse.status).toBe(200);

    const [dateDir] = await (await import('node:fs/promises')).readdir(logDir);
    const [logFile] = await (await import('node:fs/promises')).readdir(join(logDir, dateDir));
    const logData = JSON.parse(await (await import('node:fs/promises')).readFile(join(logDir, dateDir, logFile), 'utf8'));

    expect(logData.status).toBe('completed');
    expect(logData.request.fileName).toBe('sample.srt');
    expect(logData.batches).toHaveLength(1);
    expect(logData.batches[0].request.texts).toEqual(['こんにちは']);
    expect(logData.batches[0].response.rawText).toBe('["你好"]');
    expect(logData.batches[0].fillMapping).toEqual([
      {
        subtitleIdx: 1,
        targetIndex: 0,
        timecode: '00:00:01,000 --> 00:00:02,000',
        sourceText: 'こんにちは',
        translatedText: '你好',
        status: 'done',
      },
    ]);

    await app.close();
  });

  it('handles translation proxy requests', async () => {
    const app = await startServer({
      distDir: join(process.cwd(), 'dist'),
      translateImpl: vi.fn().mockResolvedValue(['你好']),
      env: {
        NODE_ENV: 'test',
      },
    });

    const response = await fetch(`${app.baseUrl}/api/translate/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: ['こんにちは'],
        contextTexts: [],
        options: {
          model: 'gpt-4o-mini',
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      translations: ['你好'],
    });

    await app.close();
  });

  it('records failed batch details in the translation run log', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'srt-translate-dist-'));
    const logDir = await mkdtemp(join(tmpdir(), 'srt-translate-logs-'));
    await writeFile(join(distDir, 'index.html'), '<!doctype html><html><body>spa</body></html>', 'utf8');

    const app = await startServer({
      distDir,
      logDir,
      translateImpl: vi.fn().mockRejectedValue(new Error('upstream boom')),
      env: {
        NODE_ENV: 'test',
      },
    });

    const createResponse = await fetch(`${app.baseUrl}/api/translation-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'sample.srt',
        provider: 'openai',
        totalEntries: 1,
        entries: [
          {
            idx: 1,
            timecode: '00:00:01,000 --> 00:00:02,000',
            text: 'こんにちは',
          },
        ],
        providerConfig: {
          model: 'gpt-4o-mini',
        },
        translationConfig: {
          batchSize: 20,
          contextLines: 3,
          temperature: 0.3,
        },
      }),
    });
    const createData = await createResponse.json();

    const translateResponse = await fetch(`${app.baseUrl}/api/translate/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runId: createData.runId,
        texts: ['こんにちは'],
        contextTexts: [],
        batch: {
          kind: 'translate',
          sequence: 1,
          startIndex: 0,
          endIndex: 0,
          totalEntries: 1,
        },
        options: {
          model: 'gpt-4o-mini',
        },
      }),
    });

    expect(translateResponse.status).toBe(500);

    await fetch(`${app.baseUrl}/api/translation-runs/${createData.runId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'failed',
        summary: {
          totalEntries: 1,
          translatedCount: 0,
          errorCount: 1,
        },
        error: {
          message: 'upstream boom',
        },
      }),
    });

    const [dateDir] = await (await import('node:fs/promises')).readdir(logDir);
    const [logFile] = await (await import('node:fs/promises')).readdir(join(logDir, dateDir));
    const logData = JSON.parse(await (await import('node:fs/promises')).readFile(join(logDir, dateDir, logFile), 'utf8'));

    expect(logData.status).toBe('failed');
    expect(logData.batches[0].error).toEqual({
      message: 'upstream boom',
    });

    await app.close();
  });

  it('returns index.html for non-api routes', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'srt-translate-dist-'));
    await writeFile(join(distDir, 'index.html'), '<!doctype html><html><body>spa</body></html>', 'utf8');

    const app = await startServer({
      distDir,
      translateImpl: vi.fn(),
      env: {
        NODE_ENV: 'production',
      },
    });

    const response = await fetch(`${app.baseUrl}/subtitle/list`);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('spa');

    await app.close();
  });
});
