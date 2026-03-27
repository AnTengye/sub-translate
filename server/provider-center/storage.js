import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createProviderCenterSeed, isProviderCenterState } from './schema.js';

async function fileExists(path) {
  try {
    await readFile(path, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function createProviderCenterStorage({ dataFile, env }) {
  async function read() {
    if (!(await fileExists(dataFile))) {
      return createProviderCenterSeed(env);
    }

    try {
      const raw = await readFile(dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (isProviderCenterState(parsed)) {
        return parsed;
      }
    } catch {
      // fall back to env-backed seed
    }

    return createProviderCenterSeed(env);
  }

  async function write(nextState) {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(nextState, null, 2), 'utf8');
    return nextState;
  }

  return {
    read,
    write,
  };
}
