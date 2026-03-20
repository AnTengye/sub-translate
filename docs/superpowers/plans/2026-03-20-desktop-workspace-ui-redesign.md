# Desktop Workspace UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the subtitle translator into a modern desktop workspace with stronger hierarchy, summary, and status-driven interaction while preserving all existing translation behavior.

**Architecture:** Keep the existing reducer, hooks, and provider flow intact. Restructure the page and presentational components around a top-level workspace header, a clearer control rail, and a richer result area, then restyle the interface with a coherent light-theme design system.

**Tech Stack:** React 19, TypeScript, CSS, Testing Library, Vitest

---

### Task 1: Lock New Workspace Structure In Tests

**Files:**
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write a failing test for the new workspace header after file import**

- [ ] **Step 2: Run `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx` and verify it fails for the missing header structure**

- [ ] **Step 3: Write a failing test for summary metrics and product-style upload copy**

- [ ] **Step 4: Run `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx` and verify it fails for the expected missing UI**

### Task 2: Rebuild The Upload Entry Experience

**Files:**
- Modify: `src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Implement stronger product entry messaging and supporting helper points**

- [ ] **Step 2: Keep drag-and-drop and file input behavior unchanged**

- [ ] **Step 3: Update upload styles to match the new light workspace system**

- [ ] **Step 4: Run the page test file and verify upload behavior remains green**

### Task 3: Introduce Workspace Header And Summary Layer

**Files:**
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `src/features/subtitle-translator/components/TranslationPanel.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add a top header with file context, workflow stage, and key metrics**

- [ ] **Step 2: Add a summary strip above the result controls**

- [ ] **Step 3: Update layout classes for desktop-first workspace structure**

- [ ] **Step 4: Re-run the page test file and adjust assertions only if the approved behavior changed**

### Task 4: Redesign Control Rail And Result Toolbar

**Files:**
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `src/features/subtitle-translator/components/ResultToolbar.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Reorganize the left control rail into clearer grouped sections**

- [ ] **Step 2: Strengthen provider selection, parameter grouping, and action hierarchy**

- [ ] **Step 3: Upgrade filter and bulk action presentation in the result toolbar**

- [ ] **Step 4: Run the page test file and verify no workflow regression**

### Task 5: Improve Subtitle Card Readability And Status Feedback

**Files:**
- Modify: `src/features/subtitle-translator/components/SubtitleList.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add human-readable status labels and richer metadata presentation**

- [ ] **Step 2: Improve source/translation visual separation and fallback copy**

- [ ] **Step 3: Keep single-item retry behavior intact**

- [ ] **Step 4: Run the page test file and verify subtitle interactions still pass**

### Task 6: Final Verification

**Files:**
- No additional file changes required

- [ ] **Step 1: Run `npm test` and verify the full suite passes**

- [ ] **Step 2: Run `npm run build` and verify production build passes**

- [ ] **Step 3: Review for desktop hierarchy, action clarity, and state feedback against the design spec**
