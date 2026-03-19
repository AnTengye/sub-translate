# SRT Translate Projectization Design

## Overview

This document defines how to convert the existing `subtitle-translator.jsx` demo into a standard private-deployment project.

The target is a maintainable `Vite + React + TypeScript` single-page application for personal use. It should preserve the current translation workflow and all existing translation engines while making the codebase easier to run, extend in code, and deploy with Docker.

## Goals

- Convert the single-file demo into a standard project structure.
- Preserve the current end-user workflow: upload subtitle file, configure provider, translate in batches, retry failures, download translated SRT.
- Keep support for all current providers: Claude, OpenAI-compatible, Qwen, and Baidu.
- Support both local development and Docker-based deployment.
- Provide clear onboarding and deployment documentation in `README.md`.
- Keep the architecture simple and optimized for private self-hosting, not public multi-user SaaS.

## Non-Goals

- No backend proxy service in this iteration.
- No public production hardening for exposed internet usage.
- No persistent translation history or account system.
- No runtime plugin system or user-defined provider editor.
- No over-engineered extension framework beyond code-level provider registration.

## Current State

The repository currently contains a single file, `subtitle-translator.jsx`, which includes:

- React UI
- Inline CSS
- SRT parsing and serialization
- Translation provider definitions
- Provider request implementations
- Batch translation and retry logic
- Upload, preview, filtering, and download workflow

This makes the demo easy to share but hard to maintain, test, and deploy cleanly.

## Proposed Stack

- Build tool: Vite
- UI: React
- Language: TypeScript
- Tests: Vitest with jsdom
- Container runtime: Docker
- Static serving in container: Nginx

## Architecture

The codebase should stay simple and feature-oriented.

```text
src/
  main.tsx
  App.tsx
  styles/
    globals.css
  components/
    common/
    layout/
  features/
    subtitle-translator/
      SubtitleTranslatorPage.tsx
      components/
      hooks/
      state/
      types.ts
  lib/
    subtitle/
      srt.ts
      subtitle.ts
    providers/
      types.ts
      registry.ts
      definitions.ts
      messages.ts
      response.ts
      adapters/
        claude.ts
        openai-compatible.ts
        qwen.ts
        baidu.ts
```

### Responsibility Boundaries

- `features/subtitle-translator`: the end-user workflow and page-level state.
- `lib/subtitle`: subtitle parsing, serialization, and subtitle domain types.
- `lib/providers`: provider metadata, provider interfaces, request adapters, request/response helpers.
- `components`: reusable presentational components extracted from the page when useful.
- `styles`: global and shared application styles.

This structure is intentionally lightweight. It supports future code-level extension without introducing runtime plugin complexity.

## Provider Design

Provider support should be driven by a small registry and a shared interface instead of hard-coded branching in the page component.

### Unified Interface

Each provider adapter should implement a shared translate function signature:

- input: subtitle texts, prior translated context, provider config, abort signal
- output: translated strings in batch order

### Provider Metadata

Each provider should also expose:

- display label
- icon or short marker
- description
- field definitions for the configuration form
- default values
- optional UI notes such as CORS warnings

This allows the UI to render provider-specific forms from metadata instead of special-casing every provider.

### Extensibility Boundary

Future providers can be added by:

1. creating a new adapter file in `lib/providers/adapters`
2. adding metadata to `definitions.ts`
3. registering it in `registry.ts`

This is enough for a private-use tool. No further abstraction is needed for this iteration.

## Subtitle Processing Design

The subtitle domain should be moved into dedicated utilities:

- `parseSrt(content)` converts raw subtitle text into normalized entries
- `serializeSrt(entries)` converts translated entries back into valid SRT output

Each subtitle entry should have a clear typed structure containing:

- original index
- timecode
- original text
- translated text
- status

Parsing and serialization should remain side-effect free so they are easy to test.

## Translation Workflow Design

The current workflow should be preserved:

1. Upload subtitle file
2. Parse subtitle entries
3. Select translation provider
4. Configure provider and translation parameters
5. Translate in batches
6. Mark successful and failed entries
7. Retry failed entries individually or in batches
8. Download translated SRT

### Translation Execution

Batch translation logic should be extracted from the main page into focused helpers or hooks.

The flow should support:

- configurable batch size
- configurable context line count
- request cancellation
- per-batch logging
- graceful fallback on batch failure

### Retry Execution

Retry logic should remain context-aware:

- batch retry operates on all failed items
- single retry reuses nearest successful prior translations as context
- retry status is visible in the UI

## State Management

State should remain local to the feature and use `useReducer` for clarity.

The state model should cover:

- workflow step: `upload | config | translating | done`
- parsed entries
- current display entries
- selected provider
- provider form values
- translation parameter values
- progress
- logs
- retry state
- active filter
- current error

This keeps the workflow explicit without adding external state libraries.

## UI and Styling

The refactor may make necessary structural improvements, but should preserve the existing product feel and user workflow.

### UI Expectations

- Keep the single-page flow.
- Keep drag-and-drop upload.
- Keep sidebar-driven configuration.
- Keep translation status visibility.
- Keep preview and filtering for all, failed, and successful items.
- Keep download and retry actions.

### Styling Strategy

- Move inline CSS into project style files.
- Preserve the visual direction where practical.
- Avoid unnecessary visual redesign beyond what supports maintainability and responsive cleanup.

## Configuration Strategy

The project should support both environment-provided defaults and UI-entered runtime values.

### Environment Variables

Use `VITE_` variables for non-sensitive defaults and app-level configuration, for example:

- `VITE_APP_TITLE`
- `VITE_DEFAULT_PROVIDER`
- `VITE_OPENAI_ENDPOINT`
- `VITE_OPENAI_MODEL`
- `VITE_QWEN_MODEL`

Sensitive keys may also be supplied through environment variables for private deployments, but the documentation must clearly warn that this is still a browser-delivered frontend and therefore not suitable for public exposure.

### Runtime Inputs

The UI should allow users to enter or override:

- API keys
- endpoint
- model name
- provider-specific values
- translation batch size
- context lines
- temperature where applicable

## Error Handling

Errors should be normalized into clear user-visible messages.

### Error Categories

- file parsing errors
- invalid or missing provider configuration
- request errors
- response parsing errors
- cancelled operations

### Error Behavior

- batch failure should not crash the whole workflow
- failed batches should mark entries as failed and continue
- cancellation should be shown distinctly from true error states
- response parsing should use the current tolerant fallback strategy where reasonable

## Testing Strategy

The project should prioritize tests for core logic and workflow-critical behaviors.

### Unit Tests

- SRT parsing and serialization
- response parsing
- provider registry behavior
- provider adapter request construction and error handling
- translation batching and retry helpers

### UI Tests

Add a minimal set of component or feature tests for:

- file import success/failure transition
- provider form rendering from metadata
- result filtering
- action availability across workflow states

### Verification Commands

The final project should support at least:

- `npm run test`
- `npm run build`

If linting is added, it should also be included in project verification.

## Docker and Compose Design

The project should ship with a simple static deployment path for private hosting.

### Dockerfile

Use a multi-stage build:

1. Node image builds the Vite app
2. Nginx image serves the built static assets

### Nginx

Provide a minimal `nginx.conf` with SPA fallback support so the application works consistently when served in a container.

### docker-compose.yml

Provide a simple compose file that:

- builds the app image
- exposes a host port for browser access
- optionally loads environment variables from a local `.env`

This compose setup is for private deployment convenience only. It does not imply a production-grade secret management model.

## README Requirements

`README.md` should include:

- project introduction
- feature list
- supported providers
- local development instructions
- environment variable reference
- Docker and Compose usage
- private deployment warning about browser-exposed credentials
- project structure overview
- steps for adding a new provider in code

## Migration Plan Summary

The implementation should proceed in this order:

1. scaffold the Vite + React + TypeScript project
2. migrate the single-file demo into the new structure
3. extract subtitle utilities
4. extract provider infrastructure and adapters
5. restore the full UI workflow
6. add tests for core logic
7. add Docker, Nginx, Compose, and `.env.example`
8. write and verify the README

## Risks and Trade-Offs

- Pure frontend private deployment keeps setup simple, but browser-side credentials remain inherently exposed.
- Supporting all current providers increases surface area, but it preserves existing user value and is still manageable with a small registry.
- Migrating directly to TypeScript adds upfront work, but it improves maintainability for provider config and workflow state.

## Acceptance Criteria

The work is complete when:

- the app runs locally with `Vite`
- the app builds successfully
- the UI preserves the existing end-to-end workflow
- all four current providers remain available in the UI
- batch translation and retry behavior still work
- `README.md`, `Dockerfile`, `docker-compose.yml`, `nginx.conf`, and `.env.example` are present
- core tests pass
- the project is suitable for private self-hosted use
