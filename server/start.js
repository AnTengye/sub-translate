import http from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppHandler } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

function readMode() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  if (modeArg) {
    return modeArg.slice('--mode='.length);
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

async function start() {
  const mode = readMode();
  const port = Number.parseInt(process.env.PORT || '3000', 10) || 3000;

  if (mode === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: projectRoot,
      appType: 'spa',
      server: {
        middlewareMode: true,
      },
    });

    const appHandler = createAppHandler({
      distDir,
      env: process.env,
    });

    const server = http.createServer(async (request, response) => {
      if ((request.url || '').startsWith('/api/translate/')) {
        await appHandler(request, response);
        return;
      }

      vite.middlewares(request, response, () => {
        response.statusCode = 404;
        response.end('Not found');
      });
    });

    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`SRT Translate dev server listening on http://localhost:${port}`);
    });
    return;
  }

  if (!existsSync(distDir)) {
    throw new Error('生产模式下未找到 dist 目录，请先运行 npm run build');
  }

  const server = http.createServer(
    createAppHandler({
      distDir,
      env: process.env,
    }),
  );

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`SRT Translate listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
