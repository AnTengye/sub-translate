import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTranslationRun,
  dispatchTranslate,
  finalizeTranslationRun,
  getProviderDefinition,
  listProviderDefinitions,
} from './registry';

describe('provider registry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns metadata for supported providers', () => {
    expect(getProviderDefinition('openai-compatible').label).toContain('OpenAI');
  });

  it('lists all supported providers', () => {
    expect(listProviderDefinitions().map((provider) => provider.id)).toEqual([
      'openai-compatible',
      'claude-compatible',
      'baidu',
    ]);
  });

  it('dispatches provider requests through the local proxy endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ translations: ['你好'] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(
      dispatchTranslate(
        'openai-compatible',
        ['こんにちは'],
        [],
        {
          kind: 'translate',
          sequence: 1,
          startIndex: 0,
          endIndex: 0,
          totalEntries: 1,
        },
        'run-123',
        {
          model: 'gpt-4o-mini',
          temperature: '0.2',
          disableThinking: 'true',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual(['你好']);

    expect(fetch).toHaveBeenCalledWith(
      '/api/translate/openai-compatible',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId: 'run-123',
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
            temperature: '0.2',
            disableThinking: 'true',
          },
        }),
      }),
    );
  });

  it('creates and finalizes translation runs through the local proxy endpoint', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'run-123' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'run-123' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

    await expect(
      createTranslationRun(
        {
          fileName: 'sample.srt',
          provider: 'openai-compatible',
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
          mode: 'translate',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ runId: 'run-123' });

    await expect(
      finalizeTranslationRun(
        'run-123',
        {
          status: 'completed',
          summary: {
            totalEntries: 1,
            translatedCount: 1,
            errorCount: 0,
          },
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ runId: 'run-123' });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/translation-runs',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/translation-runs/run-123/finalize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          status: 'completed',
          summary: {
            totalEntries: 1,
            translatedCount: 1,
            errorCount: 0,
          },
        }),
      }),
    );
  });
});
