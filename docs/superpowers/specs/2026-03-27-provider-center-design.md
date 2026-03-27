# Provider Center Design

## Overview

This document defines a Cherry Studio-inspired provider management system for the subtitle translation workspace.

The supported provider families remain fixed:

- OpenAI Compatible
- Claude Compatible
- Baidu

However, provider management is expanded significantly beyond the current profile editor. The new system must support:

- provider profile enable and disable
- provider profile connectivity checks
- provider profile model list management
- provider-level capability switches
- automatic model discovery for common provider APIs

All configuration, persistence, and operational provider-management capabilities must live on the server. The frontend becomes a management client, not the source of truth.

## Goals

- Introduce a dedicated `Provider Center` overlay inside the workspace.
- Make the server the single source of truth for provider families, profiles, model lists, switches, and status.
- Preserve the fixed three-family scope while making management feel like Cherry Studio.
- Support multiple profiles per provider family.
- Support independent profile enable and disable.
- Support independent connectivity checks per profile.
- Support independent model discovery and manual model management per profile.
- Support provider-level capability toggles per profile.
- Ensure translation runs consume server-side provider configuration rather than browser-local persisted settings.

## Non-Goals

- Do not add arbitrary custom provider families in this phase.
- Do not move provider management into a separate settings route.
- Do not change the current translation workflow into a multi-page application.
- Do not require model discovery to succeed for every provider implementation.
- Do not promise universal automatic model discovery for all non-standard APIs.

## Core Product Direction

The requested experience is not just a better config modal. It is a provider management center.

That means:

- provider profiles become first-class managed objects
- the server owns storage and operational logic
- the frontend primarily edits, inspects, and triggers provider-management operations

This is the closest practical match to Cherry Studio while staying inside the current three-family scope.

## Current Problems

The current implementation has several structural limitations:

- provider configuration persistence is browser-local
- the frontend carries too much responsibility for provider state
- there is no server-owned provider management model
- there is no connectivity check flow
- there is no model discovery flow
- there is no persisted model list management
- there is no explicit profile enable and disable state
- provider-specific switches are just loose form fields, not managed capabilities

These limitations prevent the UI from behaving like a real provider center.

## Chosen Architecture

Adopt a server-managed provider center architecture.

### Server Responsibilities

- persist all provider configuration
- expose provider families and profiles to the frontend
- validate and save provider profile changes
- perform connectivity checks
- perform automatic model discovery
- persist and serve model lists
- hold enable and disable state
- hold provider capability switches
- supply active provider configuration to translation execution

### Frontend Responsibilities

- show the Provider Center UI
- load provider center state from the server
- maintain temporary editing drafts
- submit saves to the server
- trigger check and discovery operations
- render server-returned statuses, models, and summaries

### Source of Truth

The server is the only source of truth.

The frontend must not persist provider configuration in `localStorage` once this system is in place.

## Provider Data Model

Each provider family contains multiple profiles.

Each profile is a full management object rather than just a config blob.

### Provider Family

- `id`
- `label`
- `description`
- `profiles`
- `activeProfileId`

### Provider Profile

- `id`
- `family`
- `name`
- `enabled`
- `isDefault`
- `connection`
- `settings`
- `capabilities`
- `models`
- `modelDiscovery`
- `health`

### Connection

Provider-family-specific connection fields.

#### OpenAI Compatible

- `apiEndpoint`
- `apiKey`

#### Claude Compatible

- `apiEndpoint`
- `apiKey`

#### Baidu

- `apiEndpoint`
- `appId`
- `apiKey`
- `secretKey`

### Settings

Provider-family-specific operational settings.

#### OpenAI Compatible

- `model`
- `disableThinking`

#### Claude Compatible

- `model`

#### Baidu

- `modelType`
- `reference`
- `punctuationPreprocessing`
- optional selected model field if model management is later extended for Baidu-specific variants

### Capabilities

Capability switches are persisted and explicit.

Examples:

- `supportsModelDiscovery`
- `supportsConnectionCheck`
- `supportsManualModelManagement`
- `supportsThinkingToggle`
- `supportsPunctuationPreprocessing`

This object can also include user-managed enablement for optional behavior where appropriate.

### Models

Each profile owns its own model list.

Each model item should minimally include:

- `id`
- `label`
- `enabled`
- `source`
- optional metadata

Where `source` is one of:

- `auto`
- `manual`
- `mixed`

### Model Discovery Status

- `sourceMode`
- `lastCheckedAt`
- `lastStatus`
- `lastError`

### Health Status

- `lastCheckedAt`
- `status`
- `summary`
- optional `error`

## Provider Center Information Architecture

### Translation Page

The translation page keeps only lightweight provider controls.

It should show:

- provider family quick switch
- active profile summary
- active model summary
- a `Manage Providers` button

It should no longer serve as the main editing surface for provider fields.

### Provider Center Overlay

The Provider Center opens as a workspace-covering overlay.

#### Left Column

Shows the three provider families.

Each family row includes:

- family name
- active profile name
- enabled or disabled summary
- readiness status
- recent check state

#### Right Column Header

Shows the active profile management header:

- profile selector
- create profile
- duplicate profile
- rename profile
- delete profile
- enable or disable switch
- set as default
- run connectivity check
- discover models

#### Right Column Sections

1. `Overview`
   - profile summary
   - readiness state
   - recent check result
   - recent discovery result

2. `Connection`
   - endpoint and credential fields

3. `Models`
   - discovered and manual models
   - default or selected model
   - manual add, edit, remove controls
   - discovery controls and status

4. `Capabilities`
   - provider-level capability switches and toggles

5. `Behavior`
   - provider-family-specific runtime settings
   - examples: `disableThinking`, `modelType`, `reference`, `punctuationPreprocessing`

The footer remains fixed with `Save` and `Cancel`.

## Interaction Design

### Draft Editing

The frontend loads provider center data from the server and creates a temporary draft for editing.

- all UI edits affect the draft only
- `Save` sends the draft to the server
- `Cancel` discards the draft
- after a successful save, the frontend reloads data from the server

This prevents the client from becoming an accidental second source of truth.

### Profile Operations

For each provider family:

- create profile
- duplicate profile
- rename profile
- delete profile
- set active profile
- set default profile
- enable profile
- disable profile

Rules:

- at least one profile must remain for each family
- deleting the last profile is forbidden
- deleting the active profile selects another remaining profile
- disabled profiles remain editable but cannot be used for new translation tasks until enabled

### Save Semantics

Saving updates only future work.

Saved changes affect:

- future translation runs
- future retry tasks

Saved changes do not affect:

- already-started translation runs
- already-started retry tasks

This preserves the current request snapshot semantics.

## Connectivity Check Design

Connectivity checks must be profile-specific and server-executed.

### Intent

The check should answer whether the current provider profile can realistically be used, not merely whether the endpoint responds.

### Check Rules

1. If the profile already has a selected or default model, use that model for a minimal validation request where supported.
2. If the profile has no selected model but supports model discovery, attempt model discovery first, then use the first viable model.
3. If no model can be determined, fall back to endpoint and credential validation and report that the connection is reachable but model configuration is incomplete.

### Returned Status

The server should return:

- `success`
- `warning`
- `failed`

Plus a human-readable summary and optional error detail.

## Model Discovery Design

Model discovery is server-managed and profile-specific.

### Discovery Strategy

Use automatic discovery first, with manual management as fallback.

This must support:

- `auto`
- `manual`
- `mixed`

### OpenAI Compatible

Primary compatibility path:

- request standard `GET {baseUrl}/models`
- use Bearer authentication
- parse common `data[]` response structures

This should cover most OpenAI-compatible providers.

### Claude Compatible

Try Anthropic-compatible discovery where the provider exposes it.

If no supported discovery interface exists:

- mark discovery as unavailable or unsupported
- allow full manual model management

Do not overfit speculative non-standard endpoints.

### Baidu

Implement family-specific compatibility where official interfaces allow it.

If there is no stable general-purpose model listing endpoint:

- keep manual model management available
- expose discovery support as limited or unavailable

### Discovery Result Handling

The server should:

- normalize discovered models into a stable internal format
- merge auto and manual models where `mixed` mode is used
- preserve manually added models across later discovery runs
- record discovery timestamp and failure details

## Capability Switch Design

Provider-level switches should be explicit profile-managed settings rather than ad hoc loose fields.

Examples by family:

### OpenAI Compatible

- `disableThinking`
- optional future compatibility toggles

### Claude Compatible

- family-specific future switches if added later

### Baidu

- `punctuationPreprocessing`
- `modelType`
- optional future translation behavior toggles

These controls live in the Provider Center and persist on the server.

## Readiness and Validation Rules

The UI should show whether a profile is usable.

### OpenAI Compatible Ready

Requires:

- non-empty `apiEndpoint`
- non-empty `apiKey`
- at least one model available or a selected model present

### Claude Compatible Ready

Requires:

- non-empty `apiEndpoint`
- non-empty `apiKey`
- at least one model available or a selected model present

### Baidu Ready

Requires:

- non-empty `apiEndpoint`
- non-empty `appId`
- non-empty `apiKey`
- non-empty `secretKey`
- non-empty `modelType`

When model management is relevant for Baidu variants, model availability can become part of readiness as well.

## Server API Design

The API should be simple and explicit for the current project size.

### Read and Save

- `GET /api/provider-center`
  - returns all families, profiles, active selections, summaries, models, capabilities, and statuses

- `PUT /api/provider-center`
  - saves the provider center configuration payload

### Operational Actions

- `POST /api/provider-center/check`
  - runs connectivity check for a profile

- `POST /api/provider-center/models/discover`
  - triggers model discovery for a profile

- `POST /api/provider-center/models`
  - applies manual model list mutations

- `POST /api/provider-center/default`
  - changes active or default profile for a family

The exact endpoint split can be refined later, but these capabilities must exist.

## Translation Runtime Integration

Translation execution must no longer rely on browser-local provider persistence.

Instead:

- the frontend selects provider family and active profile
- the backend resolves the active saved profile
- translation requests use the server-side saved connection, settings, capability switches, and model selection

This implies translation execution reads from server-managed provider configuration at run start and snapshots it into the run context.

## Frontend Component Design

### New Components

#### `ProviderCenter`

Responsibilities:

- top-level overlay
- server data loading
- draft lifecycle
- save and cancel orchestration

#### `ProviderFamilyList`

Responsibilities:

- left-side family navigation
- active profile summary
- readiness badge
- recent check state

#### `ProviderProfileManager`

Responsibilities:

- profile selection
- create, duplicate, rename, delete
- enable and disable
- set default

#### `ProviderConnectionForm`

Responsibilities:

- connection fields only

#### `ProviderModelsManager`

Responsibilities:

- render current models
- allow manual add, edit, delete
- trigger discovery
- show discovery status

#### `ProviderCapabilitiesForm`

Responsibilities:

- render persisted capability switches

#### `ProviderOverview`

Responsibilities:

- show readiness, health, and discovery summaries

### Existing Components

#### `ProviderPanel`

Should be reduced to summary and entry controls only.

#### `AdvancedConfigPanel`

Should be replaced by the new Provider Center system.

#### `config-storage.ts`

Should no longer act as the main persistence layer.

Any remaining client-side usage should be transitional and strictly temporary.

## Persistence Design

All provider persistence lives on the server.

Possible storage formats can be chosen during planning, but the design requires:

- durable provider profile storage
- durable model list storage
- durable enable and disable state
- durable capability switch storage
- durable operational status metadata where useful

The frontend must not be responsible for durability.

## Error Handling

- save failures must leave the client draft intact and show the server error
- discovery failures must preserve existing manual models
- check failures must not invalidate the saved profile automatically
- unsupported discovery must be explicit rather than silent
- disabled profiles must be clearly marked and excluded from new task usage

## Security Considerations

Because all configuration moves server-side:

- credential storage must be treated as sensitive server data
- server logs must not print raw credentials
- health-check and discovery errors must redact secrets
- frontend responses should return only the minimum necessary secret representation if masking is used

## Implementation Scope

Frontend files likely affected:

- `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- `src/features/subtitle-translator/components/ProviderPanel.tsx`
- `src/features/subtitle-translator/types.ts`
- `src/styles/globals.css`

Frontend files likely added:

- `src/features/subtitle-translator/components/ProviderCenter.tsx`
- `src/features/subtitle-translator/components/ProviderFamilyList.tsx`
- `src/features/subtitle-translator/components/ProviderProfileManager.tsx`
- `src/features/subtitle-translator/components/ProviderConnectionForm.tsx`
- `src/features/subtitle-translator/components/ProviderModelsManager.tsx`
- `src/features/subtitle-translator/components/ProviderCapabilitiesForm.tsx`
- `src/features/subtitle-translator/components/ProviderOverview.tsx`

Server files likely affected:

- `server/index.js`
- `server/start.js`
- `server/providers/index.js`
- `server/providers/openai-compatible.js`
- `server/providers/claude.js`
- `server/providers/baidu.js`
- `server/translate/validate.js`

Server files likely added:

- provider-center route and service modules
- model discovery service modules
- connectivity check service modules
- provider-center persistence modules

## Acceptance Criteria

- The Provider Center is a workspace overlay and the main editing surface for provider management.
- The server is the only source of truth for provider configuration and persistence.
- Users can create, duplicate, rename, delete, enable, disable, and set default profiles within the fixed three provider families.
- Users can run connectivity checks independently for each profile.
- Users can manage model lists independently for each profile.
- OpenAI-compatible providers can automatically discover models from common standard model-list endpoints.
- Unsupported or partially supported providers fall back to manual model management without breaking the workflow.
- Provider-level capability switches are persisted and managed server-side.
- New translation and retry tasks use saved server-side provider configuration.
- In-flight tasks continue using the run-start snapshot.

## Approved UI Direction Addendum

This addendum supersedes the earlier family-first frontend layout direction for the Provider Center UI while keeping the same server-side data model and APIs.

### Left Column: Saved Configurations

The left side must no longer show three provider families as navigation roots.

Instead, it shows one flat list of saved configurations across all supported provider families.

Each row represents one saved profile and includes:

- provider icon
- profile name
- provider type tag
- enabled or disabled state
- recent health summary

The list is visually closer to Cherry Studio:

- pale background rail
- compact rows
- selected row highlighted with a white surface, subtle border, and light shadow
- fixed bottom `+ 添加` action

### Add Provider Flow

Creating a new saved configuration must happen through a lightweight modal launched from the bottom-left add button.

The modal includes:

- provider name
- provider type

Supported provider types in this flow:

- OpenAI
- Anthropic
- New API
- Baidu

The chosen type maps to the existing internal provider families as follows:

- `OpenAI` -> `openai-compatible`
- `Anthropic` -> `claude-compatible`
- `New API` -> `openai-compatible`
- `Baidu` -> `baidu`

`New API` is therefore a frontend creation preset and label variant for the existing OpenAI-compatible runtime path, not a fourth backend provider family.

### Right Column: Cherry Studio Style Editor

The right side becomes a desktop-style form workspace modeled after Cherry Studio rather than stacked product cards.

It includes:

1. top title row with current profile name, provider type label, and enable switch
2. `API 密钥` block with inline actions such as reveal and connectivity check
3. `API 地址` block with endpoint input and a muted preview line where relevant
4. `模型` block with grouped rows and lighter desktop-form styling
5. footer-level model management actions matching the Cherry Studio mental model

The earlier large card-heavy glassmorphism treatment is not acceptable for this screen.

### Field Scope Rules

#### OpenAI / Anthropic / New API

Provider Center retains:

- connection fields
- model discovery and manual model management
- provider enable state

Provider Center removes:

- OpenAI and Anthropic runtime-only switches such as `disableThinking`

Those runtime controls must move to the translation-time workflow instead of the Provider Center.

#### Baidu

Baidu-specific operational fields remain inside Provider Center because they are provider configuration rather than per-run convenience toggles.

Retained Baidu fields:

- `modelType`
- `reference`
- `punctuationPreprocessing`

### Visual Constraints

The visual direction must feel consistent with the rest of the app while moving closer to Cherry Studio:

- lighter borders
- reduced corner radii
- less frosted-glass depth
- desktop utility feel over marketing-card feel
- restrained mint/teal highlight color
- orange reserved mainly for primary save emphasis
