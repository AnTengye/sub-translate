# Provider Families Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace vendor-specific mainstream providers with protocol-family providers and move all request endpoints to server-side configuration.

**Architecture:** The app will expose three providers: `openai-compatible`, `claude-compatible`, and `baidu`. Frontend provider definitions and state will align with those ids, while the server will own endpoint resolution through environment variables and keep Baidu as a specialized adapter.

**Tech Stack:** React, TypeScript, Node.js, Vitest

---

### Task 1: Lock the new provider contract in tests

**Files:**
- Modify: `server/providers/providers.test.ts`
- Modify: `server/translate/validate.test.ts`
- Modify: `src/lib/providers/adapters/providers.test.ts`
- Modify: `src/lib/providers/registry.test.ts`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] Step 1: Write failing tests for the new provider ids and env-driven endpoints.
- [ ] Step 2: Run targeted tests to verify they fail for the expected contract mismatch.
- [ ] Step 3: Implement the minimal production changes required by those failures.
- [ ] Step 4: Re-run targeted tests and make them pass.

### Task 2: Refactor provider definitions and state

**Files:**
- Modify: `src/lib/providers/types.ts`
- Modify: `src/lib/providers/definitions.ts`
- Modify: `src/lib/providers/registry.ts`
- Modify: `src/lib/config/env.ts`
- Modify: `src/features/subtitle-translator/state/reducer.ts`
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`

- [ ] Step 1: Update provider ids, labels, defaults, and field definitions for the three-provider model.
- [ ] Step 2: Remove frontend endpoint inputs and qwen-specific provider handling.
- [ ] Step 3: Re-run affected frontend tests.

### Task 3: Refactor server-side dispatch and validation

**Files:**
- Modify: `server/providers/index.js`
- Modify: `server/providers/openai-compatible.js`
- Modify: `server/providers/claude.js`
- Modify: `server/providers/baidu.js`
- Modify: `server/translate/validate.js`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Step 1: Read endpoints from server env with protocol-family defaults.
- [ ] Step 2: Remove request-level endpoint handling and qwen-specific dispatch.
- [ ] Step 3: Update docs and sample env for the new configuration model.
- [ ] Step 4: Run the full test suite and build to verify the final state.
