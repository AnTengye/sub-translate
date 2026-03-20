# Proxy Server And Drag Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-direct provider calls with a local Node proxy service, switch Baidu to the new LLM text translation API, and add drag-and-drop subtitle upload.

**Architecture:** Add a small same-origin Node server that serves the built SPA and exposes `/api/translate/:provider`. Move secret-bearing provider requests to the server, keep the existing client-side translation workflow, and extend the upload screen with drag-and-drop behavior.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Node HTTP server

---

### Task 1: Define Server Translation Contract

**Files:**
- Create: `server/translate/types.ts`
- Create: `server/translate/validate.ts`
- Create: `server/translate/validate.test.ts`

- [ ] **Step 1: Write the failing validation tests**

- [ ] **Step 2: Run validation tests to verify failure**

Run: `npm test -- server/translate/validate.test.ts`
Expected: FAIL because server validation modules do not exist yet

- [ ] **Step 3: Implement minimal request and option validation**

- [ ] **Step 4: Run validation tests to verify pass**

Run: `npm test -- server/translate/validate.test.ts`
Expected: PASS

### Task 2: Add Provider Proxy Adapters On The Server

**Files:**
- Create: `server/providers/openai-compatible.ts`
- Create: `server/providers/claude.ts`
- Create: `server/providers/qwen.ts`
- Create: `server/providers/baidu.ts`
- Create: `server/providers/index.ts`
- Create: `server/providers/providers.test.ts`
- Modify: `src/lib/providers/messages.ts`
- Modify: `src/lib/providers/response.ts`

- [ ] **Step 1: Write failing provider proxy tests**

- [ ] **Step 2: Run provider proxy tests to verify failure**

Run: `npm test -- server/providers/providers.test.ts`
Expected: FAIL because server adapters are missing

- [ ] **Step 3: Implement provider server adapters**

- [ ] **Step 4: Switch Baidu server adapter to `https://fanyi-api.baidu.com/ait/api/aiTextTranslate`**

- [ ] **Step 5: Keep Baidu Bearer auth as default and sign auth as optional fallback**

- [ ] **Step 6: Run provider proxy tests to verify pass**

Run: `npm test -- server/providers/providers.test.ts`
Expected: PASS

### Task 3: Add The Node App Server

**Files:**
- Create: `server/index.ts`
- Create: `server/http.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.node.json`

- [ ] **Step 1: Write failing HTTP server tests**

- [ ] **Step 2: Run HTTP server tests to verify failure**

Run: `npm test -- server/http.test.ts`
Expected: FAIL because the app server does not exist

- [ ] **Step 3: Implement `/api/translate/:provider` and static file serving**

- [ ] **Step 4: Add npm scripts for dev, build, and start with the server**

- [ ] **Step 5: Run HTTP server tests to verify pass**

Run: `npm test -- server/http.test.ts`
Expected: PASS

### Task 4: Migrate The Frontend To The Proxy

**Files:**
- Create: `src/lib/providers/adapters/proxy.ts`
- Modify: `src/lib/providers/definitions.ts`
- Modify: `src/lib/providers/registry.ts`
- Modify: `src/lib/providers/types.ts`
- Modify: `src/lib/providers/registry.test.ts`
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`

- [ ] **Step 1: Write failing tests for proxy-backed provider dispatch**

- [ ] **Step 2: Run registry tests to verify failure**

Run: `npm test -- src/lib/providers/registry.test.ts`
Expected: FAIL because client dispatch still expects direct credentials

- [ ] **Step 3: Implement client proxy adapter and non-secret provider fields**

- [ ] **Step 4: Remove secret entry fields from the frontend provider forms**

- [ ] **Step 5: Run registry tests to verify pass**

Run: `npm test -- src/lib/providers/registry.test.ts`
Expected: PASS

### Task 5: Add Drag-And-Drop Upload

**Files:**
- Modify: `src/features/subtitle-translator/components/UploadScreen.tsx`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Write failing drag-and-drop UI tests**

- [ ] **Step 2: Run page tests to verify failure**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because drop interactions are unsupported

- [ ] **Step 3: Implement drag enter, drag leave, drop, and visual feedback**

- [ ] **Step 4: Run page tests to verify pass**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 6: Update Deployment And Docs

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Update runtime environment variables for server-side secrets**

- [ ] **Step 2: Replace nginx-only container flow with Node app server runtime**

- [ ] **Step 3: Document local run, Docker run, and provider env vars**

- [ ] **Step 4: Run full verification**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS
