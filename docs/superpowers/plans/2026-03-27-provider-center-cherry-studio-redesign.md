# Provider Center Cherry Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Provider Center into a Cherry Studio-style management workspace with a flat saved-config list, add-provider modal, and provider-specific field scoping.

**Architecture:** Keep the existing server-backed provider center payload and APIs intact, but remap the frontend into a flattened profile list and a single-form editor. Implement the behavior change with test-first updates around the current `ProviderCenter` integration instead of inventing a parallel UI path.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS

---

### Task 1: Update coverage for the new information architecture

**Files:**
- Modify: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
- Test: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add assertions for:

- flat saved-config list items from multiple families
- add-provider modal opening from the left rail button
- `New API` creation preset visibility
- removal of `disableThinking` from the Provider Center editor
- Baidu-specific fields remaining visible

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because the current Provider Center still uses family navigation and old field layout.

- [ ] **Step 3: Implement the minimal UI and state changes to satisfy the tests**

Touch the Provider Center component and any supporting helpers needed for list flattening and creation flow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx src/features/subtitle-translator/components/ProviderCenter.tsx src/styles/globals.css
git commit -m "feat: redesign provider center layout"
```

### Task 2: Implement provider-center state mapping and creation flow

**Files:**
- Modify: `src/features/subtitle-translator/components/ProviderCenter.tsx`
- Modify: `src/features/subtitle-translator/provider-center-api.ts`
- Test: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Write the failing test for create flow persistence shape**

Cover that a new profile created from the modal is inserted into the correct backend family with the chosen label and default connection shape.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: FAIL because profile creation currently only duplicates the active family profile.

- [ ] **Step 3: Write minimal implementation**

Implement:

- flat profile descriptor generation
- provider-type label mapping
- modal draft state for name + type
- profile creation using family-specific default payloads

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/subtitle-translator/components/ProviderCenter.tsx src/features/subtitle-translator/provider-center-api.ts src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx
git commit -m "feat: add provider center creation flow"
```

### Task 3: Restyle the Provider Center to the approved Cherry Studio direction

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/features/subtitle-translator/components/ProviderCenter.tsx`
- Test: `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

- [ ] **Step 1: Add or update a focused regression test if semantics changed**

Keep tests anchored to accessible labels and button names so the CSS rewrite does not silently break behavior.

- [ ] **Step 2: Run test to verify current semantics remain valid**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS before the CSS-heavy changes.

- [ ] **Step 3: Implement the minimal styling changes**

Rewrite the modal layout, left rail, editor rows, model list styling, add-provider modal styling, and responsive behavior.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css src/features/subtitle-translator/components/ProviderCenter.tsx
git commit -m "style: align provider center with cherry studio"
```

### Task 4: Verify end-to-end behavior and ship

**Files:**
- Modify: `README.md` (only if workflow notes change)

- [ ] **Step 1: Run the full targeted verification suite**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Run visual verification**

Use Playwright MCP against the local app with `Kaori Mori.ja-ja.srt` to confirm:

- flat saved-config left rail
- add-provider modal
- Cherry Studio-style right editor
- field scope changes by provider type
- overall style consistency

- [ ] **Step 3: Merge back to `master` and start the app stack**

Run the required git merge flow without rewriting unrelated history, then start:

```bash
docker compose up --build -d
```

- [ ] **Step 4: Final smoke check**

Verify the app is reachable and the Provider Center opens with the new layout.
