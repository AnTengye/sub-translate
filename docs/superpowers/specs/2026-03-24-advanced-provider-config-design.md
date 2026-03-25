# Advanced Provider Config Design

## Overview

This document defines an advanced configuration panel for provider-level runtime settings currently sourced from `.env`.

The feature moves provider endpoint and credential management into the UI while preserving the existing translation workflow. Configuration changes must persist locally across browser restarts and apply immediately to newly started translation or retry requests without affecting in-flight work.

## Goals

- Add a gear entry in the provider area that opens an advanced configuration panel.
- Support multiple saved configuration profiles per provider.
- Persist profiles and active selections in browser local storage so they survive browser close and reopen.
- Allow the UI to manage the core provider settings currently sourced from `.env`, including endpoint and credentials.
- Make saved changes take effect for future translation or retry requests immediately.
- Keep in-progress translation runs pinned to the configuration snapshot captured when that run started.

## Non-Goals

- Do not rewrite the `.env` file on disk.
- Do not add server-side persistent profile storage.
- Do not hot-swap credentials for already running translation batches.
- Do not introduce cross-device sync or user accounts.

## Current Problems

The current implementation splits configuration responsibilities awkwardly:

- Frontend state only exposes a subset of provider options such as model or toggle fields.
- Server providers still depend on `process.env` for endpoint and credentials.
- There is no UI for switching between multiple provider setups.
- There is no local persistence for provider-specific configuration sets.

This prevents runtime reconfiguration and forces restarts or manual `.env` edits for common provider changes.

## Chosen Approach

Use frontend-local profile storage plus request-scoped runtime overrides.

- The browser stores provider profiles in `localStorage`.
- Each provider owns its own set of profiles and active profile selection.
- Translation and retry flows snapshot the currently active profile when a run starts.
- Each request sends both existing provider options and a structured runtime environment override payload.
- Server provider implementations read override values first and fall back to `process.env` only when an override is absent.

This approach matches the requested behavior while keeping the system single-user and avoiding risky live `.env` file edits.

## Profile Model

Profiles are grouped by provider, not shared across providers.

### Shared Behavior

- Each provider has a list of profiles.
- Each provider stores its active profile id.
- Each profile has an id, name, and provider-specific values.
- At least one profile must always exist for each provider.
- On first load, the app seeds profiles from current `.env` values.
- After first save, `localStorage` becomes the source of truth for the browser UI.

### Provider Fields

#### OpenAI Compatible

- profile name
- API endpoint
- API key
- model
- disableThinking

#### Claude Compatible

- profile name
- API endpoint
- API key
- model

#### Baidu

- profile name
- API endpoint
- APP ID
- API key
- secret key
- model type
- reference
- punctuation preprocessing

## UI Design

The advanced config UI lives inside the existing workspace rather than on a separate page.

### Entry Point

- Add a gear button to the provider card header in `ProviderPanel`.
- The button opens a right-side drawer or overlay panel.

### Panel Layout

- Provider tabs at the top let the user switch between OpenAI Compatible, Claude Compatible, and Baidu.
- A profile switcher row sits below the tabs:
  - current profile select
  - new profile
  - duplicate profile
  - rename profile
  - delete profile
- The main form shows the full editable field set for the selected provider profile.
- Save and cancel actions sit in the footer.

### Relationship To Existing Fields

- The existing provider form in the main panel remains.
- Fields already shown there, such as model or checkboxes, become a direct view of the active profile for the current provider.
- Saving the advanced panel updates the active profile and immediately reflects in the main panel.

## Persistence Rules

- Store all provider profile collections and active profile ids in a single versioned local storage record.
- Restore both data and active selections on page load.
- If local storage is missing or malformed, fall back to `.env`-derived defaults and continue.

Browser close or app refresh must not clear saved profiles unless the user explicitly deletes them.

## Runtime Data Flow

### Frontend

1. Load persisted provider profiles on app initialization.
2. Derive current provider defaults from the active profile for that provider.
3. When the user starts translate, retry all, or retry single:
   - snapshot the active provider profile
   - derive provider options for the existing API contract
   - derive runtime override fields for endpoint and credentials
4. Reuse that snapshot throughout the run.

### Server

1. Extend translate request validation to accept a structured runtime override object.
2. Pass validated runtime overrides into provider dispatch.
3. Each provider reads runtime override values first.
4. Missing override fields continue to fall back to `process.env`.

## Immediate Effect Semantics

Saved changes only affect newly started translation or retry requests.

- Existing runs continue on the snapshot captured at run start.
- Saving during an active run is allowed.
- The UI should clarify that saved changes apply to future work, not the currently running task.

## Error Handling

- Invalid or unreadable local storage:
  - recover with seeded defaults
  - show a non-blocking message
- Empty or duplicate profile names:
  - block save with inline validation
- Deleting active profile:
  - automatically select another remaining profile
- Deleting the last profile for a provider:
  - disallow
- Missing credentials at request time:
  - let server validation or provider execution fail with explicit existing errors

## Security Constraints

- Secrets are stored locally in browser storage on the current machine.
- Secret inputs use password fields.
- Debug output must stay redacted for endpoint headers and secrets.
- The server must not log raw credential values when runtime overrides are used.

## Implementation Scope

- Frontend state and storage:
  - `src/lib/config/env.ts`
  - new frontend storage module(s) under `src/features/subtitle-translator`
  - `src/features/subtitle-translator/state/reducer.ts`
  - `src/features/subtitle-translator/types.ts`
  - `src/features/subtitle-translator/hooks/useTranslationController.ts`
- Frontend UI:
  - `src/features/subtitle-translator/components/ProviderPanel.tsx`
  - new advanced config component(s)
  - `src/styles/globals.css`
  - `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- Shared provider metadata:
  - `src/lib/providers/definitions.ts`
  - `src/lib/providers/types.ts`
- Server request handling:
  - `server/translate/validate.js`
  - `server/index.js`
  - `server/providers/*.js`

## Acceptance Criteria

- A gear button opens an advanced config panel from the provider area.
- Users can create, duplicate, rename, delete, and switch profiles per provider.
- Profile data and active selections survive browser close and reopen.
- Saving profile changes updates the visible active provider settings immediately.
- New translation and retry requests use the saved configuration without restarting the app.
- In-flight translation runs are unaffected by later profile edits.
- Full test suite and production build pass.
