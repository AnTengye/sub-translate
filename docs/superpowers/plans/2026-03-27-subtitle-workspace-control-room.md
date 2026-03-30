# Subtitle Workspace Control Room Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the subtitle translator frontend into a dark control-room workspace led by the new design mockup, while keeping existing translation and provider behaviors working.

**Architecture:** Keep the current React/Vite business logic, reducer, and provider APIs intact, but replace the view composition with a new workspace shell: top status bar, left configuration rail, right execution/result area, and a redesigned provider center. Centralize all global actions in a single toolbar inside the right content area.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, existing CSS globals

---

### Task 1: Lock the new workspace contract with tests

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Test: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write failing tests for the new layout contract**

Add assertions for:
- upload after import enters a workspace with a top status/header region
- main global actions render in the unified toolbar
- left configuration area no longer renders the old dedicated actions section

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL because the old layout still exposes the previous structure/text

- [ ] **Step 3: Write the minimal UI changes needed to satisfy the layout contract**

Touch only the minimum composition points first in:
- `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- `frontend/src/features/subtitle-translator/components/ProviderPanel.tsx`
- `frontend/src/features/subtitle-translator/components/ResultToolbar.tsx`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 2: Rebuild the workspace shell and top-level composition

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/TranslationPanel.tsx`
- Create: `frontend/src/features/subtitle-translator/components/ActivityConsole.tsx`

- [ ] **Step 1: Write a failing test for log visibility and unified action placement**

Extend page/component tests to cover:
- activity console visible in main content area
- provider center entry available from unified action area or header

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL with missing new main-content behavior

- [ ] **Step 3: Implement the workspace shell**

Build:
- top header/status bar
- left config rail
- right content container
- activity console placement under the main toolbar

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 3: Redesign the upload screen

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write a failing test for the new upload-screen copy/structure**

Assert the upload entry still exposes file selection, but now includes the control-room style intro copy and supporting capability text.

- [ ] **Step 2: Run targeted test to verify failure**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement the new upload screen UI**

Keep drag/drop and input behavior intact while changing structure and classes to the new visual system.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 4: Redesign provider center into a two-pane control room

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write a failing test for the redesigned provider center navigation/details split**

Assert that:
- profile navigation is visible
- the details side still exposes connection/config fields
- save flow still works through the existing API mock

- [ ] **Step 2: Run targeted test to verify failure**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement the provider center layout refactor**

Recompose the existing JSX into:
- profile navigation pane
- detail/config pane
- fixed detail actions

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 5: Replace the global style system

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/src/features/subtitle-translator/components/SubtitleList.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ResultToolbar.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/TranslationPanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.tsx`
- Create: `frontend/src/features/subtitle-translator/components/ActivityConsole.tsx`

- [ ] **Step 1: Write a failing UI test for the new labels/classes only if a behavior contract is needed**

Keep tests focused on behavior and visible structure, not visual trivia.

- [ ] **Step 2: Run targeted tests if a new contract was added**

Run: `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`
Expected: FAIL only if the new contract is not met

- [ ] **Step 3: Implement the new tokenized dark theme**

Introduce:
- top status bar styles
- unified toolbar styles
- activity console styles
- dense KPI cards
- redesigned subtitle cards
- responsive breakpoints
- provider center visual language

- [ ] **Step 4: Run frontend test suite**

Run: `npm run -w frontend test`
Expected: PASS

### Task 6: Build and container verification

**Files:**
- Modify: `frontend/src/...` as needed from previous tasks
- Verify: `docker-compose.yml`
- Verify: `Dockerfile`

- [ ] **Step 1: Run production frontend build**

Run: `npm run build`
Expected: PASS with generated frontend bundle

- [ ] **Step 2: Run backend tests**

Run: `go test ./backend/...`
Expected: PASS

- [ ] **Step 3: Run Docker Compose build verification**

Run: `docker compose up --build`
Expected: application starts successfully and serves the redesigned UI for manual acceptance

- [ ] **Step 4: Record any residual issues**

If Docker verification is blocked by environment constraints, document the exact blocker and the last successful verification command.
