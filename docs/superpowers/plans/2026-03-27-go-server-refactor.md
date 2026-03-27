# Go Server Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Node.js server with a Go server that keeps the frontend protocol-compatible, persists provider-center state with Gorm and SQLite, keeps translation logs file-based, and runs through Docker Compose.

**Architecture:** Implement a modular Go monolith with HTTP compatibility handlers, application services, Gorm repositories, file-based translation-run logging, and provider family adapters. Build frontend assets with Node, serve them from the Go binary, and keep Docker Compose as the acceptance path.

**Tech Stack:** Go, Gorm, SQLite, Node/Vite build pipeline, React, Vitest, Docker Compose

---

### Task 1: Scaffold the Go server and prove the compatibility harness

**Files:**
- Create: `go.mod`
- Create: `cmd/server/main.go`
- Create: `internal/transport/http/server.go`
- Create: `internal/transport/http/server_test.go`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write the failing Go HTTP smoke test**

```go
func TestServerServesIndexFallback(t *testing.T) {
    srv := newTestServer(t)
    res := performRequest(t, srv, http.MethodGet, "/subtitle/list", "")
    require.Equal(t, http.StatusOK, res.Code)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/transport/http -run TestServerServesIndexFallback -v`
Expected: FAIL because the Go HTTP server does not exist yet

- [ ] **Step 3: Implement the minimal server scaffold**

```go
func NewServer(deps Dependencies) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/", deps.StaticHandler)
    return mux
}
```

- [ ] **Step 4: Re-run the targeted test**

Run: `go test ./internal/transport/http -run TestServerServesIndexFallback -v`
Expected: PASS

### Task 2: Add provider-center persistence with Gorm and SQLite

**Files:**
- Create: `internal/domain/providercenter/models.go`
- Create: `internal/app/providercenter/service.go`
- Create: `internal/infra/db/models.go`
- Create: `internal/infra/db/providercenter_repository.go`
- Create: `internal/infra/db/migrate.go`
- Create: `internal/app/providercenter/service_test.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Write the failing provider-center persistence tests**

```go
func TestReadSeedsDefaultProviderCenterState(t *testing.T) {
    svc := newProviderCenterService(t)
    state, err := svc.Read(context.Background())
    require.NoError(t, err)
    require.Equal(t, "openai-compatible", state.Families["openai-compatible"].ID)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/app/providercenter -run TestReadSeedsDefaultProviderCenterState -v`
Expected: FAIL because the repository and models do not exist yet

- [ ] **Step 3: Implement minimal Gorm-backed persistence**

```go
type ProviderProfileRecord struct {
    ID              string `gorm:"primaryKey"`
    FamilyID        string
    ConnectionJSON  string
    SettingsJSON    string
}
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `go test ./internal/app/providercenter -v`
Expected: PASS

### Task 3: Add translation-run file logging and finalize compatibility

**Files:**
- Create: `internal/domain/translationrun/types.go`
- Create: `internal/app/translationrun/service.go`
- Create: `internal/infra/logging/translation_run_logger.go`
- Create: `internal/app/translationrun/service_test.go`
- Create: `internal/infra/logging/translation_run_logger_test.go`
- Modify: `internal/transport/http/server.go`

- [ ] **Step 1: Write the failing translation-run tests**

```go
func TestCreateAppendAndFinalizeRunLog(t *testing.T) {
    svc := newTranslationRunService(t)
    runID, err := svc.CreateRun(context.Background(), payload)
    require.NoError(t, err)
    require.NotEmpty(t, runID)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/app/translationrun ./internal/infra/logging -v`
Expected: FAIL because the translation-run service does not exist yet

- [ ] **Step 3: Implement file-based logger and HTTP routes**

```go
if r.Method == http.MethodPost && strings.HasPrefix(path, "/api/translation-runs/") {
    // create or finalize run log
}
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `go test ./internal/app/translationrun ./internal/infra/logging -v`
Expected: PASS

### Task 4: Port provider adapters and translate API behavior

**Files:**
- Create: `internal/domain/translate/types.go`
- Create: `internal/app/translate/service.go`
- Create: `internal/infra/providers/openai_compatible.go`
- Create: `internal/infra/providers/claude_compatible.go`
- Create: `internal/infra/providers/baidu.go`
- Create: `internal/infra/providers/registry.go`
- Create: `internal/app/translate/service_test.go`
- Create: `internal/transport/http/translate_test.go`
- Modify: `internal/transport/http/server.go`

- [ ] **Step 1: Write the failing translate compatibility tests**

```go
func TestTranslateUsesProfileAndReturnsTranslations(t *testing.T) {
    srv := newTestServerWithTranslator(t, fakeTranslator{translations: []string{"你好"}})
    res := performJSONRequest(t, srv, http.MethodPost, "/api/translate/openai-compatible", payload)
    require.Equal(t, http.StatusOK, res.Code)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/app/translate ./internal/transport/http -run Translate -v`
Expected: FAIL because translation flow is not implemented yet

- [ ] **Step 3: Implement the minimal translator flow**

```go
result, err := svc.Translate(ctx, provider, request)
writeJSON(w, http.StatusOK, map[string]any{"translations": result.Translations})
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `go test ./internal/app/translate ./internal/transport/http -run Translate -v`
Expected: PASS

### Task 5: Replace runtime packaging and remove the Node server from compose

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `internal/platform/config/config.go`
- Create: `internal/platform/id/snowflake.go`

- [ ] **Step 1: Write the failing container-facing config test**

```go
func TestLoadConfigUsesSQLiteDefaults(t *testing.T) {
    cfg := config.LoadFromEnv()
    require.Equal(t, "data/app.db", cfg.DatabasePath)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/platform/config -v`
Expected: FAIL because config loading does not exist yet

- [ ] **Step 3: Implement container config and Snowflake ID support**

```go
type Config struct {
    Port         string
    DatabaseDSN  string
    LogDir       string
}
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `go test ./internal/platform/config -v`
Expected: PASS

### Task 6: Full verification and acceptance

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-27-go-server-refactor-design.md` (only if implementation clarifies details)

- [ ] **Step 1: Run the Go test suite**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 2: Run the frontend test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run the frontend production build**

Run: `npm run build`
Expected: PASS and produce `dist/`

- [ ] **Step 4: Build the Docker image**

Run: `docker compose build`
Expected: PASS

- [ ] **Step 5: Start the stack and perform a smoke check**

Run: `docker compose up -d`
Expected: PASS and service reachable on configured port

- [ ] **Step 6: Verify the acceptance endpoint**

Run: `curl http://localhost:8080/api/provider-profiles/defaults`
Expected: HTTP 200 with JSON payload
