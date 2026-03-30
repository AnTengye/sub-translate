# UI Density And Provider Center Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the subtitle workspace and Provider Center denser, less repetitive, and more stable across high-DPI desktop layouts while fixing the model manager and log panel interaction issues.

**Architecture:** Keep the existing React component split, but move repeated display logic into small helpers inside the affected components, add state for log expansion, and tighten CSS tokens/layout rules so the sidebar, content pane, dialogs, and action rows follow one compact interaction scale.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS

---

### Task 1: Add failing UI tests for the regressions

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write a failing test for compact provider summaries and selector-only selected text**
- [ ] **Step 2: Run `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx` and confirm the new assertion fails for the current UI**
- [ ] **Step 3: Write a failing test for expandable logs and model manager catalog presentation**
- [ ] **Step 4: Run `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx` again and confirm failure is caused by the missing UI behavior**

### Task 2: Simplify Provider Center and sidebar copy

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/target-selection.ts`

- [ ] **Step 1: Add helpers that collapse verbose health text into short status labels**
- [ ] **Step 2: Remove duplicated selected-profile summary text below the provider selectors**
- [ ] **Step 3: Hide redundant model/source text where the selector or primary label already communicates it**
- [ ] **Step 4: Run targeted frontend tests**

### Task 3: Fix model manager and activity console behavior

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ModelManagerDialog.tsx`
- Modify: `frontend/src/features/subtitle-translator/components/ActivityConsole.tsx`

- [ ] **Step 1: Deduplicate model label/ID rendering and replace raw source text with compact badges**
- [ ] **Step 2: Add explicit expandable/collapsible log panel behavior**
- [ ] **Step 3: Ensure the collapsed log view still shows multiple readable lines on high-DPI layouts**
- [ ] **Step 4: Run targeted frontend tests**

### Task 4: Tighten layout and action styling

**Files:**
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1: Reduce oversized advanced-parameter trigger and compact selector spacing**
- [ ] **Step 2: Normalize close/refresh/action button sizing and spacing**
- [ ] **Step 3: Make workspace columns stretch to equal visual height and keep the log section usable in 2560x1600 at 200% scale**
- [ ] **Step 4: Fix crowded add-button rows in dialogs and side panels**
- [ ] **Step 5: Run frontend tests and build**

### Task 5: Verify the full workspace

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Run `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx`**
- [ ] **Step 2: Run `npm run -w frontend test`**
- [ ] **Step 3: Run `npm run -w frontend build`**
- [ ] **Step 4: If needed, run a Playwright check against the workspace using the bundled `.srt` sample**
