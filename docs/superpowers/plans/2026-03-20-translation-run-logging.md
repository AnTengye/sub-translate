# Translation Run Logging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task-level server-side JSON logs that capture each translation run's request flow, raw model responses, fill-back mapping, and final outcome.

**Architecture:** The frontend will create a translation run session before dispatching batches and finalize it when the run completes, fails, or is cancelled. The Node server will own run metadata, append per-batch events to an in-memory session, and persist the aggregated JSON file to `logs/translations/...`.

**Tech Stack:** React, TypeScript, Node HTTP server, Vitest

---

### Task 1: Define request contract for translation runs

**Files:**
- Modify: `server/translate/validate.js`
- Modify: `server/translate/validate.test.ts`
- Modify: `src/lib/providers/adapters/proxy.ts`
- Modify: `src/lib/providers/registry.ts`

- [ ] **Step 1: Write the failing validation tests for run metadata**
- [ ] **Step 2: Run the validation tests to verify they fail**
- [ ] **Step 3: Implement minimal request validation and proxy payload changes**
- [ ] **Step 4: Run the validation tests to verify they pass**

### Task 2: Add server-side run lifecycle and JSON persistence

**Files:**
- Create: `server/logging/translation-run-logger.js`
- Modify: `server/index.js`
- Modify: `server/http.test.ts`

- [ ] **Step 1: Write failing HTTP tests for creating, updating, and finalizing run logs**
- [ ] **Step 2: Run the HTTP tests to verify they fail**
- [ ] **Step 3: Implement run logger, create/finalize endpoints, and per-batch persistence**
- [ ] **Step 4: Run the HTTP tests to verify they pass**

### Task 3: Capture provider request/response details and fill-back mapping

**Files:**
- Modify: `server/providers/index.js`
- Modify: `server/providers/claude.js`
- Modify: `server/providers/openai-compatible.js`
- Modify: `server/providers/qwen.js`
- Modify: `server/providers/baidu.js`
- Modify: `server/providers/providers.test.ts`
- Modify: `src/features/subtitle-translator/utils/translation.ts`

- [ ] **Step 1: Write failing provider and batch-processing tests for raw response logging data**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement provider debug payloads and batch fill-back event recording**
- [ ] **Step 4: Run the targeted tests to verify they pass**

### Task 4: Wire frontend run lifecycle through translation and retry flows

**Files:**
- Modify: `src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `src/features/subtitle-translator/types.ts`
- Modify: `src/features/subtitle-translator/state/reducer.ts`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write failing controller/page tests for run creation and finalization calls**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement frontend session orchestration with success/failure/cancel finalization**
- [ ] **Step 4: Run the targeted tests to verify they pass**

### Task 5: Document and verify the feature

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with log file location and contents**
- [ ] **Step 2: Run full test suite**
- [ ] **Step 3: Run production build**
