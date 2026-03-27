# Go Server Refactor Design

## Overview

This document defines the Go-based server replacement for the subtitle translation workspace.

The replacement must preserve the current frontend contract while improving server-side structure, persistence, and future extensibility.

## Goals

- Replace the current Node.js server with Go.
- Keep frontend API paths, JSON fields, HTTP status codes, and error messages compatible.
- Move provider-center persistence to Gorm-backed storage.
- Use SQLite first, while keeping the design portable to MySQL later.
- Keep translation-run batch logs file-based rather than storing them in the database.
- Support approximately 10 concurrent translation requests safely.
- Produce a Docker Compose workflow that can build and run the full system for acceptance.

## Non-Goals

- Do not change the frontend workflow or require frontend protocol updates.
- Do not introduce async job execution in this phase.
- Do not split the system into multiple services in this phase.
- Do not store translation batch logs in the database.
- Do not optimize for high-scale multi-node deployment in this phase.

## Approved Constraints

- rollout is a one-shot replacement of the Node server
- frontend changes must not be required for API compatibility
- persistence uses Gorm
- primary database is SQLite
- later migration to MySQL must remain practical
- primary keys use Snowflake IDs
- translation requests remain synchronous HTTP requests
- translation-run logs remain filesystem JSON files
- target concurrency is about 10 simultaneous translations

## Architecture

The Go server will be implemented as a modular monolith with clear boundaries:

- `cmd/server`
  - process startup
  - configuration loading
  - dependency wiring
  - graceful shutdown
- `internal/transport/http`
  - exact HTTP route compatibility with the current server
  - request parsing
  - response formatting
  - error mapping
- `internal/app`
  - translation service
  - provider-center service
  - translation-run log service
- `internal/domain`
  - provider profile models
  - validation rules
  - request and response contracts
  - provider family capability rules
- `internal/infra`
  - Gorm repositories
  - SQLite and MySQL-ready database adapter
  - provider HTTP clients
  - file-based translation-run logger
  - static-file serving
- `internal/platform`
  - config
  - clock
  - Snowflake ID generator
  - structured logging
  - concurrency limiter

## Transport Compatibility

The following routes must remain compatible:

- `GET /api/provider-profiles/defaults`
- `GET /api/provider-center`
- `PUT /api/provider-center`
- `POST /api/provider-center/check`
- `POST /api/provider-center/models/discover`
- `POST /api/translation-runs`
- `POST /api/translation-runs/:id/finalize`
- `POST /api/translate/:provider`

Compatibility includes:

- same JSON field names
- same optional field behavior
- same status-code mapping
- same Chinese error strings where current behavior depends on them

Static asset serving must continue to support SPA fallback to `index.html`.

## Persistence Design

The database is the source of truth for provider-center configuration.

### Database-backed state

- global default provider
- provider family active profile selection
- provider profiles
- provider profile connection settings
- provider profile runtime settings
- provider profile capabilities
- provider profile health state
- provider profile model-discovery state
- provider profile model catalog

### File-backed state

- translation run log files
- per-batch request and response details
- translation summary and final status snapshots

This preserves the existing debugging and audit value of translation logs without turning the first phase into a logging-schema migration project.

## Database Model

Recommended relational model:

- `app_configs`
  - `id`
  - `default_provider`
  - timestamps
- `provider_families`
  - `id`
  - `label`
  - `description`
  - `active_profile_id`
  - timestamps
- `provider_profiles`
  - `id`
  - `family_id`
  - `name`
  - `enabled`
  - `is_default`
  - `connection_json`
  - `settings_json`
  - `capabilities_json`
  - `health_json`
  - `model_discovery_json`
  - timestamps
- `provider_models`
  - `id`
  - `profile_id`
  - `model_key`
  - `label`
  - `enabled`
  - `source`
  - timestamps

JSON-like fields are stored in portable formats:

- SQLite: `TEXT`
- MySQL: can remain string-backed initially or move to `JSON` later behind repository logic

All primary keys use Snowflake IDs to avoid auto-increment coupling.

## Provider Runtime Design

The provider runtime remains synchronous and request-scoped.

Each provider family implements a translator interface with family-specific request building and response parsing.

Required families:

- OpenAI Compatible
- Claude Compatible
- Baidu

Provider resolution rules must match current behavior:

- resolve provider family from route
- resolve profile from saved provider-center state
- merge server-managed profile settings with request options
- merge runtime overrides using the current precedence rules

## Translation Run Logging

Translation run logging remains filesystem-based under the existing log directory pattern.

Required behavior:

- create log file at run creation
- append batch details after each translate call
- finalize run status
- redact sensitive credentials from logged request metadata

## Concurrency and Stability

The server should include lightweight protections suitable for about 10 concurrent translation requests:

- request-scoped context cancellation
- semaphore limit for translation execution
- pooled outbound HTTP clients
- configurable request timeouts
- graceful shutdown support

This phase does not require a queue.

## Docker and Delivery

Docker delivery will become a multi-stage build:

- Node stage builds the frontend assets
- Go stage builds the server binary
- runtime stage serves static assets with the Go server

`docker-compose.yml` must remain a single-service local deployment flow for acceptance.

## Testing Strategy

The migration should be protected by compatibility-focused tests:

- Go HTTP handler tests for route behavior
- Go service tests for provider-center persistence
- Go tests for translation-run logging
- provider adapter tests for request and response normalization
- frontend tests only where integration assumptions change
- Docker Compose smoke test for build and startup

## Acceptance Criteria

- The application builds and runs through `docker compose`.
- The frontend can load without API contract changes.
- Provider center data is persisted through Gorm using SQLite.
- Translation-run logs are written to files and not stored in the database.
- All existing supported provider families continue to work through the Go server.
- The service handles about 10 simultaneous translation requests without process instability.
