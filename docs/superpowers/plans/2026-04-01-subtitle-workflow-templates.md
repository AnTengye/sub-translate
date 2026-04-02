# Subtitle Workflow Templates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stage-based subtitle workflow templates with serial fallback, parallel comparison, judge recommendation, and review polishing across the existing frontend and Go backend.

**Architecture:** Keep Provider Center and `/api/translate/:provider` as the provider execution backbone. Add backend workflow-template persistence and extend translate requests for `review` / `judge` node operations, while moving page orchestration from primary/fallback mode to template-driven workflow execution in the frontend.

**Tech Stack:** React 19 + TypeScript + Vitest + Testing Library, Go HTTP server, JSON file persistence

---

### Task 1: Add Workflow Template Backend Types And Routes

**Files:**
- Create: `backend/internal/domain/workflow/types.go`
- Create: `backend/internal/app/workflowtemplates/service.go`
- Create: `backend/internal/app/workflowtemplates/service_test.go`
- Create: `backend/internal/infra/workflowtemplates/file_repository.go`
- Create: `backend/internal/infra/workflowtemplates/file_repository_test.go`
- Modify: `backend/internal/platform/config/config.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/internal/transport/http/server.go`
- Modify: `backend/internal/transport/http/server_test.go`

- [ ] **Step 1: Write failing repository and route tests**
- [ ] **Step 2: Run backend tests to verify they fail for missing workflow support**
- [ ] **Step 3: Implement workflow domain, repository, default seeds, and HTTP GET/PUT routes**
- [ ] **Step 4: Run backend tests to verify workflow template routes pass**

### Task 2: Extend Translate API For Review And Judge Node Operations

**Files:**
- Modify: `backend/internal/app/translate/service.go`
- Modify: `backend/internal/infra/providers/translators.go`
- Modify: `backend/internal/app/translate/service_test.go`
- Modify: `backend/internal/transport/http/server.go`
- Modify: `backend/internal/transport/http/server_test.go`

- [ ] **Step 1: Write failing tests for review/judge request payloads and metadata responses**
- [ ] **Step 2: Run targeted backend tests and verify expected failures**
- [ ] **Step 3: Implement request extensions, prompt builders, judge parsing, and metadata response**
- [ ] **Step 4: Run backend tests to verify review/judge flows pass**

### Task 3: Add Frontend Workflow Template API And State

**Files:**
- Create: `frontend/src/features/subtitle-translator/workflow-api.ts`
- Create: `frontend/src/features/subtitle-translator/workflow-types.ts`
- Create: `frontend/src/features/subtitle-translator/workflow-api.test.ts`
- Modify: `frontend/src/features/subtitle-translator/types.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.test.ts`

- [ ] **Step 1: Write failing frontend tests for workflow template fetch/save and state transitions**
- [ ] **Step 2: Run frontend tests to confirm workflow state is not implemented yet**
- [ ] **Step 3: Implement workflow template API client and reducer changes**
- [ ] **Step 4: Run targeted frontend tests to verify state support passes**

### Task 4: Implement Workflow Editor UI

**Files:**
- Create: `frontend/src/features/subtitle-translator/components/WorkflowTemplatePanel.tsx`
- Create: `frontend/src/features/subtitle-translator/components/WorkflowStageCard.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write failing UI tests for template selection, node editing, and save action**
- [ ] **Step 2: Run targeted Vitest cases and verify UI expectations fail**
- [ ] **Step 3: Implement stage-based workflow editor sidebar and wire save/fetch**
- [ ] **Step 4: Re-run UI tests to verify editor behavior**

### Task 5: Implement Frontend Workflow Execution Engine

**Files:**
- Create: `frontend/src/features/subtitle-translator/utils/workflow.ts`
- Create: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`
- Modify: `frontend/src/lib/providers/types.ts`
- Modify: `frontend/src/lib/providers/adapters/proxy.ts`
- Modify: `frontend/src/lib/providers/registry.ts`
- Modify: `frontend/src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`

- [ ] **Step 1: Write failing tests for serial fallback, parallel compare, judge recommendation, and manual override**
- [ ] **Step 2: Run targeted frontend tests and verify workflow execution failures**
- [ ] **Step 3: Implement workflow execution helpers and page/controller integration**
- [ ] **Step 4: Run targeted frontend tests to verify workflow execution passes**

### Task 6: Verify Full Frontend/Backend Flow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run `go test ./backend/...`**
- [ ] **Step 2: Run `npm run test -- --runInBand` or repo-equivalent frontend test command**
- [ ] **Step 3: Run production build command**
- [ ] **Step 4: Update README workflow section if behavior changed**
- [ ] **Step 5: Re-run the verification commands and record evidence**
