import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWorkflowTemplates, saveWorkflowTemplates } from './workflow-api';

describe('workflow api', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init || init.method === undefined) {
          return new Response(
            JSON.stringify({
              version: 1,
              templates: [
                {
                  id: 'quality-first',
                  name: '质量优先',
                  description: 'seed',
                  scenario: 'translation',
                  stages: [
                    {
                      id: 'translate',
                      name: '主翻译与补偿',
                      type: 'translate',
                      execution: 'serial',
                      strategy: 'fallback',
                      nodes: [],
                    },
                  ],
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        return new Response(String(init.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads workflow templates from the backend', async () => {
    const state = await fetchWorkflowTemplates();

    expect(state.templates).toHaveLength(1);
    expect(state.templates[0].stages[0].strategy).toBe('fallback');
  });

  it('saves workflow templates to the backend', async () => {
    const state = await saveWorkflowTemplates({
      version: 1,
      templates: [
        {
          id: 'compare',
          name: '双路比对',
          description: 'parallel compare',
          scenario: 'comparison',
          stages: [
            {
              id: 'translate',
              name: '候选翻译',
              type: 'translate',
              execution: 'parallel',
              strategy: 'keep-all',
              nodes: [],
            },
          ],
        },
      ],
    });

    expect(state.templates[0].id).toBe('compare');
    expect(state.templates[0].stages[0].execution).toBe('parallel');
  });
});
