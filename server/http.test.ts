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
