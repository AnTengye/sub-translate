# Workflow Runtime Resume And Provider Limits Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add layered provider RPM/RPD configuration, rate-limit interruption handling, and pause/import/export workflow run snapshots that can resume from batch boundaries without re-uploading subtitle files.

**Architecture:** Extend provider-center state with layered limits, add workflow-run persistence and APIs beside workflow templates, and thread run snapshot updates through the existing batch-oriented translation controller. The frontend gains homepage import entry, runtime controls, and restored workspace state sourced from exported run snapshots.

**Tech Stack:** Go backend, JSON file repositories, React 19 + TypeScript frontend, Vitest, Go test

---

### Task 1: Lock Provider Limit Domain Shapes

**Files:**
- Modify: `backend/internal/domain/providercenter/types.go`
- Modify: `frontend/src/features/subtitle-translator/provider-center-api.ts`
- Modify: `frontend/src/features/subtitle-translator/provider-center-api.test.ts`
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`

- [ ] **Step 1: Write the failing frontend normalization test for global/profile/model RPM/RPD fields**

```ts
it('normalizes layered provider limit fields', async () => {
  // assert missing arrays/fields become stable empty values and limits survive parsing
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/features/subtitle-translator/provider-center-api.test.ts`
Expected: FAIL because layered limit fields are not modeled

- [ ] **Step 3: Add minimal backend/frontend domain fields for layered limits**

Add:
- provider center global limit object
- profile `rpmLimit` / `rpdLimit`
- model `rpdLimit`

- [ ] **Step 4: Run targeted frontend tests to verify they pass**

Run: `npm test -- --run frontend/src/features/subtitle-translator/provider-center-api.test.ts frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`
Expected: PASS

### Task 2: Add Provider Center UI For Layered Limits

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ModelManagerDialog.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`

- [ ] **Step 1: Write the failing component test for editing global/profile/model limits**

```tsx
it('edits layered limits and preserves inheritance semantics', async () => {
  // interact with global limit inputs, profile limit inputs, and model manager inputs
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`
Expected: FAIL because the controls do not exist

- [ ] **Step 3: Implement the minimal UI and draft mutation logic**

Add:
- global limit section
- profile-level limit inputs
- model-level RPM/RPD inputs in model manager

- [ ] **Step 4: Run targeted component test**

Run: `npm test -- --run frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`
Expected: PASS

### Task 3: Extend Backend Provider Persistence And Limit Resolution

**Files:**
- Modify: `backend/internal/app/providercenter/service.go`
- Modify: `backend/internal/infra/db/providercenter_repository.go`
- Modify: `backend/internal/infra/db/providercenter_repository_test.go`
- Modify: `backend/internal/app/translate/service.go`
- Modify: `backend/internal/app/translate/service_test.go`
- Modify: `backend/internal/infra/providers/ratelimiter.go`
- Modify: `backend/internal/infra/providers/translators_test.go` (only if helper coverage is needed)

- [ ] **Step 1: Write the failing backend test for layered limit resolution**

```go
func TestTranslateServiceResolvesLimitsFromModelProfileAndGlobal(t *testing.T) {
    // expect model override, then profile fallback, then global fallback, then unlimited
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./backend/internal/app/translate -run TestTranslateServiceResolvesLimitsFromModelProfileAndGlobal -v`
Expected: FAIL because only model RPM is supported

- [ ] **Step 3: Implement minimal backend persistence and resolution changes**

Add:
- repository read/write coverage for new fields
- translate-service limit resolution helper
- rate limiter support for RPM and RPD

- [ ] **Step 4: Run backend tests**

Run: `go test ./backend/internal/app/translate ./backend/internal/infra/db ./backend/internal/infra/providers -v`
Expected: PASS

### Task 4: Add Workflow Run Snapshot Domain And Storage

**Files:**
- Create: `backend/internal/domain/workflowrun/types.go`
- Create: `backend/internal/app/workflowruns/service.go`
- Create: `backend/internal/app/workflowruns/service_test.go`
- Create: `backend/internal/infra/workflowruns/file_repository.go`
- Create: `backend/internal/infra/workflowruns/file_repository_test.go`

- [ ] **Step 1: Write the failing workflow run service test for create/save/import/export**

```go
func TestWorkflowRunServiceImportsExportedSnapshot(t *testing.T) {
    // create run with subtitle source, export it, import it, assert new ID and sourceRunID
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./backend/internal/app/workflowruns -run TestWorkflowRunServiceImportsExportedSnapshot -v`
Expected: FAIL because package does not exist

- [ ] **Step 3: Implement workflow run domain, service, and file repository**

Add:
- run snapshot type
- file-backed repository
- create/save/list/import/export methods

- [ ] **Step 4: Run workflow run tests**

Run: `go test ./backend/internal/app/workflowruns ./backend/internal/infra/workflowruns -v`
Expected: PASS

### Task 5: Thread Snapshot Updates And Interruption Handling Through Workflow Execution

**Files:**
- Modify: `frontend/src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.ts`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`
- Modify: `backend/internal/app/translate/service.go`
- Modify: `backend/internal/app/translate/service_test.go`
- Modify: `backend/internal/infra/logging/translation_run_logger.go`
- Modify: `backend/internal/infra/logging/translation_run_logger_test.go`

- [ ] **Step 1: Write the failing test for consecutive rate-limit interruption behavior**

```go
func TestTranslateServiceSignalsInterruptionAfterThreshold(t *testing.T) {
    // simulate repeated rate-limit hits for the same node and assert interruption metadata
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./backend/internal/app/translate -run TestTranslateServiceSignalsInterruptionAfterThreshold -v`
Expected: FAIL because interruption tracking does not exist

- [ ] **Step 3: Implement minimal run-activity and interruption tracking**

Add:
- rate-limit hit metadata
- consecutive counter reset after successful batch
- paused-interrupted stop condition at batch boundary

- [ ] **Step 4: Run workflow and logging tests**

Run: `go test ./backend/internal/app/translate ./backend/internal/infra/logging -v`
Expected: PASS

### Task 6: Expose Workflow Run APIs

**Files:**
- Modify: `backend/internal/transport/http/server.go`
- Modify: `backend/internal/transport/http/routes_test.go`
- Modify: `backend/internal/transport/http/server_test.go`
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Write the failing HTTP test for workflow run import/export endpoints**

```go
func TestServerWorkflowRunImportAndExport(t *testing.T) {
    // assert import stores snapshot and export returns the same run payload
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./backend/internal/transport/http -run TestServerWorkflowRunImportAndExport -v`
Expected: FAIL because routes do not exist

- [ ] **Step 3: Implement the minimal endpoints and wiring**

Add:
- GET/POST/PUT/import/export handlers
- repository/service wiring in `main.go`

- [ ] **Step 4: Run HTTP tests**

Run: `go test ./backend/internal/transport/http -v`
Expected: PASS

### Task 7: Add Frontend Workflow Run API And Homepage Import Flow

**Files:**
- Create: `frontend/src/features/subtitle-translator/workflow-run-api.ts`
- Create: `frontend/src/features/subtitle-translator/workflow-run-api.test.ts`
- Modify: `frontend/src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write the failing frontend test for importing a workflow run from the homepage**

```tsx
it('imports a workflow run package from the homepage and restores the workspace', async () => {
  // simulate file import and assert restored subtitle state without manual upload
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because homepage import flow does not exist

- [ ] **Step 3: Implement workflow run API helpers and homepage import UI**

Add:
- import/export helpers
- upload screen dual-entry UI
- restored workspace hydration path

- [ ] **Step 4: Run targeted frontend tests**

Run: `npm test -- --run frontend/src/features/subtitle-translator/workflow-run-api.test.ts frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 8: Add Pause / Resume / Export Runtime Controls

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/WorkflowTemplatePanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.test.ts`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write the failing reducer or page test for pause/resume/export controls**

```tsx
it('pauses a running workflow, resumes from snapshot state, and exports the run package', async () => {
  // assert status transitions and API calls
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/features/subtitle-translator/state/reducer.test.ts frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because runtime control state does not exist

- [ ] **Step 3: Implement minimal runtime control state and buttons**

Add:
- run status state
- pause/resume/export handlers
- interrupted status badge

- [ ] **Step 4: Run targeted frontend tests**

Run: `npm test -- --run frontend/src/features/subtitle-translator/state/reducer.test.ts frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 9: Full Verification

**Files:**
- Modify: any files touched above as required by fixes

- [ ] **Step 1: Run frontend test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run backend test suite**

Run: `go test ./backend/...`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Review diff for accidental scope creep**

Run: `git diff --stat`
Expected: only files related to layered limits, workflow runs, UI/runtime controls, and tests
