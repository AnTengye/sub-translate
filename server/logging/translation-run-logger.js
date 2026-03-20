import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function formatDateParts(input) {
  const date = input instanceof Date ? input : new Date(input);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return {
    dayKey: `${year}-${month}-${day}`,
    timestamp: `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`,
    iso: date.toISOString(),
  };
}

function buildLogPath(logDir, runId, createdAt) {
  const parts = formatDateParts(createdAt);
  return {
    directory: join(logDir, parts.dayKey),
    filePath: join(logDir, parts.dayKey, `${parts.timestamp}-${runId}.json`),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createTranslationRunLogger(options = {}) {
  const logDir = options.logDir ?? join(process.cwd(), 'logs', 'translations');
  const now = options.now ?? (() => new Date());
  const uuid = options.randomUUID ?? randomUUID;
  const runs = new Map();

  async function persist(runId) {
    const session = runs.get(runId);
    if (!session) {
      throw new Error('翻译任务不存在');
    }

    const { directory, filePath } = buildLogPath(logDir, runId, session.createdAt);
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, JSON.stringify(session, null, 2), 'utf8');
    session.filePath = filePath;
  }

  return {
    getRun(runId) {
      return runs.get(runId) ?? null;
    },
    async createRun(payload) {
      const timestamp = now();
      const runId = payload.runId || uuid();
      const session = {
        runId,
        status: 'running',
        createdAt: formatDateParts(timestamp).iso,
        updatedAt: formatDateParts(timestamp).iso,
        completedAt: null,
        filePath: null,
        request: clone(payload),
        batches: [],
        summary: null,
        error: null,
      };

      runs.set(runId, session);
      await persist(runId);
      return {
        runId,
        filePath: session.filePath,
      };
    },
    async appendBatch(runId, payload) {
      const session = runs.get(runId);
      if (!session) {
        throw new Error('翻译任务不存在');
      }

      session.batches.push(clone(payload));
      session.updatedAt = formatDateParts(now()).iso;
      await persist(runId);
    },
    async finalizeRun(runId, payload) {
      const session = runs.get(runId);
      if (!session) {
        throw new Error('翻译任务不存在');
      }

      const timestamp = formatDateParts(now()).iso;
      session.status = payload.status;
      session.summary = payload.summary ?? null;
      session.error = payload.error ?? null;
      session.updatedAt = timestamp;
      session.completedAt = timestamp;
      await persist(runId);

      return {
        runId,
        filePath: session.filePath,
      };
    },
  };
}
