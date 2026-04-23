# Dual Path Adversarial Judge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-pass compare judge with the documented adversarial multi-dimension judge, optional tiebreak stage, judge resume support, and detailed UI output.

**Architecture:** Keep the existing dual candidate translation stage, then introduce two judge execution modes in the frontend runtime: `adversarial` for parallel dimension review and `tiebreak` for disputed entries only. Extend backend workflow templates and shared workflow types so the UI can configure dimension-aware judge nodes while preserving backward compatibility for existing templates and saved workflow exports.

**Tech Stack:** Go backend services and domain types, React + TypeScript frontend, Vitest, Go test

---

### Task 1: Define file boundaries and contract updates

**Files:**
- Modify: `backend/internal/domain/workflow/types.go`
- Modify: `backend/internal/app/workflowtemplates/service.go`
- Modify: `frontend/src/features/subtitle-translator/workflow-types.ts`
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.ts`
- Modify: `frontend/src/features/subtitle-translator/workflow-run-api.ts`

- [ ] **Step 1: Document the new judge data contract**

Add support for:
- `node.judgeDimension`
- judge decision `confidence`, `dimensionScores`, `isDisputed`, `debateReason`
- stage strategies `adversarial` and `tiebreak`

- [ ] **Step 2: Keep compatibility constraints explicit**

Existing templates and saved exports must still parse. Old judge flows should continue working under the generic judge branch.

- [ ] **Step 3: Commit file responsibilities**

- `service.go`: seed the redesigned comparison template
- `types.go` and `workflow-types.ts`: serialize new node/stage metadata
- `workflow.ts`: execute adversarial and tiebreak logic plus resume
- `workflow-run-api.ts`: preserve enriched judge decisions in exports

### Task 2: Add failing backend tests for seeded templates

**Files:**
- Modify: `backend/internal/app/workflowtemplates/service_test.go`

- [ ] **Step 1: Write the failing test**

Assert the seeded compare template contains:
- parallel translate stage with two candidates
- judge stage using `adversarial`
- debate stage using `tiebreak`
- judge nodes tagged with expected `JudgeDimension`

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/app/workflowtemplates -run TestReadSeedsAdversarialCompareTemplate`
Expected: FAIL because the default template still exposes `manual-review` and lacks debate metadata

- [ ] **Step 3: Write minimal implementation**

Update backend seeded state and workflow domain types until the test passes.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/app/workflowtemplates -run TestReadSeedsAdversarialCompareTemplate`
Expected: PASS

### Task 3: Add failing runtime tests for adversarial judge and tiebreak

**Files:**
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`
- Test: `frontend/src/features/subtitle-translator/utils/workflow.test.ts`

- [ ] **Step 1: Write the failing adversarial test**

Add a workflow fixture with:
- parallel candidate translation
- parallel `adversarial` judge nodes for `accuracy` and `fluency`
- serial `tiebreak` stage

Assert:
- dimension judge nodes run independently
- confidence is computed
- disputed entries trigger tiebreak only for disputed rows
- final selected text reflects tiebreak decisions

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- workflow.test.ts`
Expected: FAIL because runtime has no adversarial/tiebreak handling

- [ ] **Step 3: Write the failing resume test**

Add a paused snapshot in the middle of the judge stage and verify resume restarts from the saved judge batch instead of rerunning earlier judge batches.

- [ ] **Step 4: Run test to verify it fails**

Run: `npm --prefix frontend test -- workflow.test.ts`
Expected: FAIL because judge resume state is not implemented

- [ ] **Step 5: Write minimal implementation**

Implement new parsing, score consolidation, disputed entry mapping, and snapshot behavior until both tests pass.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm --prefix frontend test -- workflow.test.ts`
Expected: PASS

### Task 4: Add failing page tests for adversarial review UI

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write the failing UI test**

Update the comparison workflow fixture and mocked judge responses so the page renders:
- confidence badge
- dimension review summaries
- dispute marker and tiebreak conclusion

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL because the page only shows flat reasons

- [ ] **Step 3: Write minimal implementation**

Render detailed judge cards while preserving manual candidate override behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 5: Implement runtime and export plumbing

**Files:**
- Modify: `frontend/src/features/subtitle-translator/utils/workflow.ts`
- Modify: `frontend/src/features/subtitle-translator/workflow-run-api.ts`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`

- [ ] **Step 1: Parse and clone enriched judge decisions**

Preserve nested `dimensionScores` across parse, snapshot build, export, and page state restoration.

- [ ] **Step 2: Add adversarial judge execution**

Execute judge nodes in parallel by batch, consolidate per-entry results, update final texts, and mark disputes.

- [ ] **Step 3: Add tiebreak execution**

Collect disputed indices, execute only those rows, merge final reasons, and preserve high-confidence rows untouched.

- [ ] **Step 4: Add judge resume support**

Honor `stageIndex`, `nodeIndex`, and `batchIndex` for both adversarial and tiebreak stages.

- [ ] **Step 5: Update page rendering**

Expose confidence, dimension winners/scores, dispute state, and debate conclusion without breaking existing manual override UX.

### Task 6: Verify the whole feature

**Files:**
- Modify: none

- [ ] **Step 1: Run targeted frontend tests**

Run: `npm --prefix frontend test -- workflow.test.ts SubtitleTranslatorPage.test.tsx`
Expected: PASS

- [ ] **Step 2: Run targeted backend tests**

Run: `go test ./internal/app/workflowtemplates`
Expected: PASS

- [ ] **Step 3: Run focused API serialization sanity checks**

Run: `npm --prefix frontend test -- workflow-api.test.ts`
Expected: PASS or no regression

- [ ] **Step 4: Summarize known tradeoffs**

Call out any remaining limitations, especially around confidence threshold configurability and UI aggregate stats if they are deferred.
