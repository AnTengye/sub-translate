# Provider Center Server Source Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cherry Studio-style provider center where server-side storage is the only source of truth for provider profiles, model lists, health checks, and capability switches.

**Architecture:** Add a server-side provider-center service with file-backed persistence and operational endpoints, then refit the frontend workspace to consume and edit that data through a new Provider Center overlay. Translation startup resolves provider settings from the server-side active profile snapshot instead of browser-local storage.

**Tech Stack:** Node HTTP server, React 19, TypeScript, Vitest, local JSON persistence

---

### Task 1: Add server-side provider center persistence and schema

**Files:**
- Create: `server/provider-center/storage.js`
- Create: `server/provider-center/schema.js`
- Test: `server/provider-center/storage.test.ts`
- Modify: `server/index.js`

- [ ] **Step 1: Write the failing storage tests**

```ts
it('seeds default provider-center data from env when storage is empty', async () => {
  const service = createProviderCenterStorage({ dataFile, env })
  const state = await service.read()
  expect(state.families['openai-compatible'].profiles).toHaveLength(1)
  expect(state.families['openai-compatible'].profiles[0].connection.apiEndpoint).toBe('https://api.example.com/v1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/provider-center/storage.test.ts`
Expected: FAIL because `createProviderCenterStorage` does not exist yet

- [ ] **Step 3: Write minimal storage/schema implementation**

```js
export function createProviderCenterStorage({ dataFile, env }) {
  return {
    async read() { /* seed or load */ },
    async write(nextState) { /* persist json */ }
  }
}
```

- [ ] **Step 4: Run targeted test to verify it passes**

Run: `npm test -- server/provider-center/storage.test.ts`
Expected: PASS

### Task 2: Add provider-center server routes and operational actions

**Files:**
- Create: `server/provider-center/service.js`
- Create: `server/provider-center/discovery.js`
- Create: `server/provider-center/health.js`
- Test: `server/provider-center/service.test.ts`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing HTTP/service tests**

```ts
it('returns provider center state from GET /api/provider-center', async () => {
  const response = await request(app).get('/api/provider-center')
  expect(response.statusCode).toBe(200)
  expect(response.body.families['openai-compatible']).toBeDefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/provider-center/service.test.ts server/http.test.ts`
Expected: FAIL with missing route or missing service

- [ ] **Step 3: Implement minimal routes and actions**

```js
if (request.method === 'GET' && url.pathname === '/api/provider-center') {
  sendJson(response, 200, await providerCenterService.read())
  return
}
```

- [ ] **Step 4: Add discovery and health adapters**

```js
export async function discoverModelsForProfile(profile) { /* family-specific discovery */ }
export async function checkProfileHealth(profile) { /* minimal connectivity check */ }
```

- [ ] **Step 5: Run targeted tests**

Run: `npm test -- server/provider-center/service.test.ts server/http.test.ts`
Expected: PASS

### Task 3: Route translation through server-managed provider profiles

**Files:**
- Modify: `server/translate/validate.js`
- Modify: `server/index.js`
- Modify: `server/providers/index.js`
- Test: `server/translate/validate.test.ts`
- Test: `server/providers/providers.test.ts`
- Test: `server/http.test.ts`

- [ ] **Step 1: Write failing tests for profile-based translation requests**

```ts
it('resolves translate config from provider family and profile id', async () => {
  const validated = validateTranslateRequest('openai-compatible', {
    profileId: 'openai-default',
    texts: ['hello']
  })
  expect(validated.profileId).toBe('openai-default')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- server/translate/validate.test.ts server/providers/providers.test.ts`
Expected: FAIL because `profileId` is unsupported

- [ ] **Step 3: Implement minimal profile-aware translation flow**

```js
const profile = await providerCenterService.getProfile(provider, validated.profileId)
const providerOptions = buildProviderOptionsFromProfile(profile)
const runtimeOverrides = buildRuntimeOverridesFromProfile(profile)
```

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- server/translate/validate.test.ts server/providers/providers.test.ts server/http.test.ts`
Expected: PASS

### Task 4: Replace local provider storage with frontend Provider Center client

**Files:**
- Create: `src/features/subtitle-translator/provider-center-api.ts`
- Create: `src/features/subtitle-translator/components/ProviderCenter.tsx`
- Create: `src/features/subtitle-translator/components/ProviderFamilyList.tsx`
- Create: `src/features/subtitle-translator/components/ProviderProfileManager.tsx`
- Create: `src/features/subtitle-translator/components/ProviderConnectionForm.tsx`
- Create: `src/features/subtitle-translator/components/ProviderModelsManager.tsx`
- Create: `src/features/subtitle-translator/components/ProviderCapabilitiesForm.tsx`
- Create: `src/features/subtitle-translator/components/ProviderOverview.tsx`
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Modify: `src/features/subtitle-translator/components/ProviderPanel.tsx`
- Modify: `src/features/subtitle-translator/types.ts`
- Modify: `src/features/subtitle-translator/hooks/useTranslationController.ts`
- Modify: `src/features/subtitle-translator/state/reducer.ts`
- Modify: `src/styles/globals.css`
- Test: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write failing frontend tests for Provider Center flow**

```tsx
it('loads provider center data from server and opens the overlay', async () => {
  render(<SubtitleTranslatorPage />)
  await user.click(screen.getByRole('button', { name: /manage providers/i }))
  expect(await screen.findByRole('dialog', { name: /provider center/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because Provider Center UI and API client do not exist

- [ ] **Step 3: Implement Provider Center API client and overlay UI**

```ts
export async function fetchProviderCenterState() {
  const response = await fetch('/api/provider-center')
  return response.json()
}
```

- [ ] **Step 4: Wire translation requests to selected profile ids**

```ts
dispatchTranslateWithProvider(state.provider, texts, contextTexts, batch, runId, {
  profileId: state.activeProfileId
})
```

- [ ] **Step 5: Run targeted frontend tests**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

### Task 5: Full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-03-27-provider-center-design.md` (only if implementation-driven clarifications are needed)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS with all tests green

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS and produce `dist/`

- [ ] **Step 3: Review working tree**

Run: `git status --short`
Expected: Only intended implementation files changed
