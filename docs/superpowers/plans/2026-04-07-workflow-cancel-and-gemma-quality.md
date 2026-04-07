# Workflow Cancel And Gemma Quality Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible workflow stop control and tighten the workflow translation path so weaker models like Gemma get better prompts and context.

**Architecture:** Keep the existing workflow execution flow, but thread cancellation state through the page component and reuse the existing abort-aware proxy calls. Improve translation quality by passing workflow context into translate nodes and letting translate operations consume node-level prompt text the same way review and judge already do.

**Tech Stack:** React, TypeScript, Vitest, Go, net/http, existing workflow/provider abstractions

---

### Task 1: Capture Expected Behavior In Tests

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`
- Modify: `backend/internal/infra/providers/response_test.go`

- [ ] **Step 1: Write failing frontend tests for workflow stop button visibility and cancel behavior**
- [ ] **Step 2: Run the frontend tests to verify they fail for the expected reason**
- [ ] **Step 3: Write failing workflow utility tests for translate-stage context propagation**
- [ ] **Step 4: Run the workflow tests to verify they fail for the expected reason**
- [ ] **Step 5: Write failing backend tests for translate prompt parsing/building**
- [ ] **Step 6: Run the backend tests to verify they fail for the expected reason**

### Task 2: Implement Minimal Production Changes

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/WorkflowTemplatePanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.ts`
- Modify: `backend/internal/infra/providers/translators.go`

- [ ] **Step 1: Wire workflow abort controller into page state and expose stop action in the workflow panel**
- [ ] **Step 2: Mark cancelled workflow runs as `cancelled` and keep UI state/logging coherent**
- [ ] **Step 3: Pass prior successful subtitles as `contextTexts` for workflow translate batches**
- [ ] **Step 4: Extend translate message building to honor node-level prompt text**

### Task 3: Verify End To End

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`
- Modify: `backend/internal/infra/providers/response_test.go`

- [ ] **Step 1: Run targeted frontend tests**
- [ ] **Step 2: Run targeted backend tests**
- [ ] **Step 3: Run broader frontend test suite if targeted tests are green**
- [ ] **Step 4: Report exact verification results and remaining gaps**
