# Provider Center Delete Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete support for provider-center profiles, including deleting the currently active profile.

**Architecture:** Keep persistence on the existing `PUT /api/provider-center` full-state save path. Implement deletion entirely in the frontend draft state by removing the selected profile, recalculating the affected family's `activeProfileId`, and falling back to another selectable profile or an empty-state editor when needed.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Cover delete behavior with UI tests

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run `npm test -- ProviderCenter.test.tsx` and verify the delete cases fail**
- [ ] **Step 3: Commit the red test change**

### Task 2: Implement profile deletion and empty-state handling

**Files:**
- Modify: `frontend/src/features/subtitle-translator/components/ProviderCenter.tsx`

- [ ] **Step 1: Add helpers to remove a profile and compute fallback selection**
- [ ] **Step 2: Add a delete button for the selected profile**
- [ ] **Step 3: Render a usable empty state when a family has no profiles selected**
- [ ] **Step 4: Keep save behavior on the existing full-state callback**
- [ ] **Step 5: Commit the implementation**

### Task 3: Verify

**Files:**
- Test: `frontend/src/features/subtitle-translator/components/ProviderCenter.test.tsx`

- [ ] **Step 1: Run `npm test -- ProviderCenter.test.tsx` and verify PASS**
- [ ] **Step 2: Run `npm test` if the targeted suite passes cleanly**
- [ ] **Step 3: Summarize behavior and residual risks**
