# Provider Feedback And NewAPI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainable shared interaction-feedback layer, rebuild provider model management around a dedicated dialog, and make NewAPI profiles work end-to-end.

**Architecture:** Introduce a lightweight frontend feedback foundation (`toast` + async action state) and split provider management responsibilities between the main provider editor and a dedicated model manager dialog. Keep NewAPI under the OpenAI-compatible protocol family, but ensure the selected server-backed profile drives model listing, connection checks, saving, and translation execution.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Node server, CSS

---

### Task 1: Lock interaction and provider-management behavior with failing tests

**Files:**
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `server/provider-center/service.test.ts`

- [ ] **Step 1: Write failing UI tests**
- [ ] **Step 2: Run targeted frontend tests and confirm failure**
- [ ] **Step 3: Write failing provider-center service tests for remote catalog selection semantics**
- [ ] **Step 4: Run targeted server tests and confirm failure**

### Task 2: Add shared feedback primitives

**Files:**
- Create: `src/components/ui/feedback/ToastProvider.tsx`
- Create: `src/components/ui/feedback/useToast.ts`
- Create: `src/components/ui/feedback/useAsyncAction.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Implement toast provider and hook**
- [ ] **Step 2: Implement async action hook for button-level pending/success/error state**
- [ ] **Step 3: Wire provider into the app root and shared button/toast styles**
- [ ] **Step 4: Re-run targeted frontend tests**

### Task 3: Rebuild provider center model management

**Files:**
- Create: `src/features/subtitle-translator/components/ModelManagerDialog.tsx`
- Modify: `src/features/subtitle-translator/components/ProviderCenter.tsx`
- Modify: `src/features/subtitle-translator/provider-center-api.ts`
- Modify: `server/provider-center/service.js`
- Modify: `server/provider-center/discovery.js`
- Modify: `server/index.js`

- [ ] **Step 1: Split model management into a dedicated dialog**
- [ ] **Step 2: Remove inline search/auto-discovery actions from the provider form**
- [ ] **Step 3: Make the manage button open the dialog and load the remote model catalog**
- [ ] **Step 4: Persist only user-selected models into the profile**
- [ ] **Step 5: Re-run targeted frontend and server tests**

### Task 4: Make NewAPI profiles effective end-to-end

**Files:**
- Modify: `src/features/subtitle-translator/state/reducer.ts`
- Modify: `src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `server/providers/index.js`
- Modify: `server/providers/openai-compatible.js`
- Modify: `server/provider-center/schema.js`

- [ ] **Step 1: Ensure active server profile config always drives translation runtime**
- [ ] **Step 2: Normalize NewAPI base URL handling against official `/v1` OpenAI-compatible expectations**
- [ ] **Step 3: Keep NewAPI profile type metadata without diverging protocol logic**
- [ ] **Step 4: Re-run targeted tests**

### Task 5: Sweep button feedback and verify

**Files:**
- Modify: `src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `src/features/subtitle-translator/components/ResultToolbar.tsx`
- Modify: `src/features/subtitle-translator/components/SubtitleList.tsx`
- Modify: `src/features/subtitle-translator/components/TranslationPanel.tsx`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`

- [ ] **Step 1: Apply shared pending/disabled/pressed feedback to all actionable buttons in scope**
- [ ] **Step 2: Surface success/error results with toast or inline status according to the agreed rules**
- [ ] **Step 3: Run `npm test`**
- [ ] **Step 4: Run `npm run build`**
