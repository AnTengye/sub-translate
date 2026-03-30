# Provider Target Selection And Style Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent primary/fallback provider target selection with model selection, move non-core translation parameters into a floating advanced panel, and comprehensively fix workspace styling issues.

**Architecture:** Derive eligible provider targets from `providerCenter`, store explicit primary/fallback selections in translator state, and build runtime request payloads from the selected target instead of the active family default. Replace the sidebar’s card-toggle UI with structured selector cards and unify styling tokens/components across the workspace and Provider Center.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS

---

### Task 1: Add failing state and UI tests

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.test.ts`

- [ ] **Step 1: Write failing tests for independent primary/fallback target selection**
- [ ] **Step 2: Run targeted tests to confirm failures**
- [ ] **Step 3: Write failing tests for floating advanced parameter panel**
- [ ] **Step 4: Run targeted tests to confirm failures**

### Task 2: Refactor translator state around explicit provider targets

**Files:**
- Modify: `frontend/src/features/subtitle-translator/types.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.ts`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.test.ts`

- [ ] **Step 1: Introduce explicit target selection types and reducer actions**
- [ ] **Step 2: Initialize and hydrate targets from provider center data**
- [ ] **Step 3: Enforce no duplicate primary/fallback combination**
- [ ] **Step 4: Run reducer tests**

### Task 3: Update runtime translation dispatch and fallback behavior

**Files:**
- Modify: `frontend/src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `frontend/src/features/subtitle-translator/utils/translation.ts`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Build request config from selected target rather than active family**
- [ ] **Step 2: Add fallback dispatch path for failed translation batches**
- [ ] **Step 3: Verify translation request tests**

### Task 4: Rebuild sidebar provider and parameter UI

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Replace family toggle cards with explicit provider/model selectors**
- [ ] **Step 2: Add floating advanced parameter panel**
- [ ] **Step 3: Preserve busy/disabled behavior**
- [ ] **Step 4: Run component tests**

### Task 5: Refresh shared styles

**Files:**
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1: Unify sidebar, selector card, and form control styling**
- [ ] **Step 2: Add non-layout-shifting advanced panel styles**
- [ ] **Step 3: Fix workspace and Provider Center spacing/responsive issues**
- [ ] **Step 4: Run style assertion tests and build**

### Task 6: Full verification

**Files:**
- Modify: `frontend/src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `frontend/src/features/subtitle-translator/state/reducer.test.ts`

- [ ] **Step 1: Run `npm run -w frontend test -- SubtitleTranslatorPage.test.tsx state/reducer.test.ts`**
- [ ] **Step 2: Run `npm run -w frontend test`**
- [ ] **Step 3: Run `npm run -w frontend build`**
