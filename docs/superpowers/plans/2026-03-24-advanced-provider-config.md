# Advanced Provider Config Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider-level advanced configuration panel with persistent local profiles, request-scoped runtime overrides, and immediate effect for future translation and retry requests.

**Architecture:** Introduce a frontend profile store backed by `localStorage`, wire the active profile into existing provider state and translation snapshots, then extend the server request contract so providers consume explicit runtime override fields before falling back to process environment variables.

**Tech Stack:** React 19, TypeScript, CSS, Node.js, Vitest, Testing Library

---

### Task 1: Lock Profile Storage Behavior In Tests

**Files:**
- Create: `src/features/subtitle-translator/config-storage.test.ts`
- Create: `src/features/subtitle-translator/config-storage.ts`

- [ ] **Step 1: Write failing tests for seeding provider profiles from env defaults and restoring saved profiles from local storage**
- [ ] **Step 2: Run `npm test -- src/features/subtitle-translator/config-storage.test.ts` and verify the storage tests fail for the missing module**
- [ ] **Step 3: Implement the minimal profile storage helpers to load, validate, persist, and update provider profiles**
- [ ] **Step 4: Re-run `npm test -- src/features/subtitle-translator/config-storage.test.ts` and verify the storage tests pass**

### Task 2: Lock Request Validation For Runtime Overrides

**Files:**
- Modify: `server/translate/validate.test.ts`
- Modify: `server/translate/validate.js`

- [ ] **Step 1: Write failing tests covering allowed runtime override shapes and rejected unknown override fields**
- [ ] **Step 2: Run `npm test -- server/translate/validate.test.ts` and verify the new validation tests fail**
- [ ] **Step 3: Implement the minimal validation changes for request-scoped runtime overrides**
- [ ] **Step 4: Re-run `npm test -- server/translate/validate.test.ts` and verify the validation suite passes**

### Task 3: Lock Provider Runtime Override Consumption

**Files:**
- Modify: `server/providers/providers.test.ts`
- Modify: `server/providers/openai-compatible.js`
- Modify: `server/providers/claude.js`
- Modify: `server/providers/baidu.js`

- [ ] **Step 1: Write failing provider tests proving runtime overrides beat process env values and secrets stay redacted in debug output**
- [ ] **Step 2: Run `npm test -- server/providers/providers.test.ts` and verify the new cases fail**
- [ ] **Step 3: Implement the minimal provider changes to consume runtime overrides and preserve redaction**
- [ ] **Step 4: Re-run `npm test -- server/providers/providers.test.ts` and verify the provider suite passes**

### Task 4: Bind Active Provider Profiles Into Frontend State

**Files:**
- Modify: `src/features/subtitle-translator/types.ts`
- Modify: `src/features/subtitle-translator/state/reducer.test.ts`
- Modify: `src/features/subtitle-translator/state/reducer.ts`
- Modify: `src/lib/config/env.ts`
- Modify: `src/lib/providers/types.ts`
- Modify: `src/lib/providers/definitions.ts`

- [ ] **Step 1: Write failing reducer tests for initializing provider config from persisted active profiles and switching providers to their own active profile**
- [ ] **Step 2: Run `npm test -- src/features/subtitle-translator/state/reducer.test.ts` and verify the new reducer tests fail**
- [ ] **Step 3: Implement the minimal shared type and reducer updates needed to carry profile-backed provider config in app state**
- [ ] **Step 4: Re-run `npm test -- src/features/subtitle-translator/state/reducer.test.ts` and verify the reducer suite passes**

### Task 5: Add Advanced Config UI And Persistence

**Files:**
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`
- Create: `src/features/subtitle-translator/components/AdvancedConfigPanel.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write failing page tests for the gear entry, advanced config panel, profile persistence, and immediate main-panel sync after save**
- [ ] **Step 2: Run `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx` and verify the new UI tests fail**
- [ ] **Step 3: Implement the minimal UI, local persistence wiring, and provider-profile editing flow to satisfy the tests**
- [ ] **Step 4: Re-run `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx` and verify the page tests pass**

### Task 6: Snapshot Runtime Overrides In Translation Flows

**Files:**
- Modify: `src/features/subtitle-translator/utils/translation.test.ts`
- Modify: `src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `src/features/subtitle-translator/utils/translation.ts`
- Modify: `src/lib/providers/adapters/proxy.ts`
- Modify: `server/http.test.ts`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing tests proving translate and retry requests carry task-scoped runtime overrides while current-run snapshots stay stable**
- [ ] **Step 2: Run `npm test -- src/features/subtitle-translator/utils/translation.test.ts` and `npm test -- server/http.test.ts` and verify the new cases fail**
- [ ] **Step 3: Implement the minimal request payload and server wiring changes to pass runtime override snapshots through the full stack**
- [ ] **Step 4: Re-run the targeted translation and HTTP tests and verify they pass**

### Task 7: Final Verification

**Files:**
- No additional file changes required

- [ ] **Step 1: Run `npm test` and verify the full suite passes**
- [ ] **Step 2: Run `npm run build` and verify the production build passes**
- [ ] **Step 3: Review the feature against the design acceptance criteria, including browser-restart persistence and future-request-only effect**
