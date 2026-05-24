package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	appprovidercenter "srt-translate/internal/app/providercenter"
	apptranslate "srt-translate/internal/app/translate"
	domainprovider "srt-translate/internal/domain/providercenter"
	domainworkflow "srt-translate/internal/domain/workflow"
)

type ProviderDefaultsReader interface {
	ReadProviderDefaults(context.Context) map[string]any
}

type ProviderCenterService interface {
	Read(context.Context) (domainprovider.State, error)
	Save(context.Context, domainprovider.State) (domainprovider.State, error)
	Check(context.Context, string, string, *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.HealthCheckResult, error)
	DiscoverModels(context.Context, string, string, *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.ModelDiscoveryResult, error)
	VerifyModel(context.Context, string, string, string, *domainprovider.Profile) (appprovidercenter.ModelCheckResult, error)
}

type WorkflowTemplateService interface {
	Read(context.Context) (domainworkflow.State, error)
	Save(context.Context, domainworkflow.State) (domainworkflow.State, error)
}

type TranslateService interface {
	Translate(context.Context, string, apptranslate.TranslateInput) (apptranslate.Result, error)
}

type CreateRunPayload struct {
	RunID             string         `json:"runId"`
	FileName          string         `json:"fileName"`
	Provider          string         `json:"provider"`
	TotalEntries      int            `json:"totalEntries"`
	Entries           []RunEntry     `json:"entries"`
	ProviderConfig    map[string]any `json:"providerConfig"`
	TranslationConfig map[string]any `json:"translationConfig"`
	Mode              string         `json:"mode"`
}

type RunEntry struct {
	Idx      int    `json:"idx"`
	Timecode string `json:"timecode"`
	Text     string `json:"text"`
}

type FinalizeRunPayload struct {
	Status  string         `json:"status"`
	Summary map[string]any `json:"summary"`
	Error   map[string]any `json:"error"`
}

type TranslationRunLogger interface {
	CreateRun(context.Context, CreateRunPayload) (string, string, error)
	AppendBatch(context.Context, string, map[string]any) error
	FinalizeRun(context.Context, string, FinalizeRunPayload) error
}

type defaultProviderDefaultsReader struct{}

func (defaultProviderDefaultsReader) ReadProviderDefaults(context.Context) map[string]any {
	return map[string]any{}
}

type defaultProviderCenterService struct{}

func (defaultProviderCenterService) Read(context.Context) (domainprovider.State, error) {
	return domainprovider.State{}, nil
}

func (defaultProviderCenterService) Save(_ context.Context, state domainprovider.State) (domainprovider.State, error) {
	return state, nil
}

func (defaultProviderCenterService) Check(context.Context, string, string, *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.HealthCheckResult, error) {
	return domainprovider.Profile{}, appprovidercenter.HealthCheckResult{}, errors.New("Provider Profile 标识格式无效")
}

func (defaultProviderCenterService) DiscoverModels(context.Context, string, string, *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.ModelDiscoveryResult, error) {
	return domainprovider.Profile{}, appprovidercenter.ModelDiscoveryResult{}, errors.New("Provider Profile 标识格式无效")
}

func (defaultProviderCenterService) VerifyModel(context.Context, string, string, string, *domainprovider.Profile) (appprovidercenter.ModelCheckResult, error) {
	return appprovidercenter.ModelCheckResult{}, errors.New("Provider Profile 标识格式无效")
}

type defaultTranslateService struct{}

func (defaultTranslateService) Translate(context.Context, string, apptranslate.TranslateInput) (apptranslate.Result, error) {
	return apptranslate.Result{}, errors.New("不支持的翻译引擎")
}

type defaultWorkflowTemplateService struct{}

func (defaultWorkflowTemplateService) Read(context.Context) (domainworkflow.State, error) {
	return domainworkflow.State{Version: 1, Templates: []domainworkflow.Template{}}, nil
}

func (defaultWorkflowTemplateService) Save(_ context.Context, state domainworkflow.State) (domainworkflow.State, error) {
	if state.Version == 0 {
		state.Version = 1
	}
	return state, nil
}

type defaultTranslationRunLogger struct{}

func (defaultTranslationRunLogger) CreateRun(context.Context, CreateRunPayload) (string, string, error) {
	return "", "", errors.New("翻译任务不存在")
}

func (defaultTranslationRunLogger) AppendBatch(context.Context, string, map[string]any) error {
	return nil
}

func (defaultTranslationRunLogger) FinalizeRun(context.Context, string, FinalizeRunPayload) error {
	return errors.New("翻译任务不存在")
}

type Dependencies struct {
	StaticFileHandler       http.Handler
	ProviderDefaultsReader  ProviderDefaultsReader
	ProviderCenterService   ProviderCenterService
	WorkflowTemplateService WorkflowTemplateService
	TranslateService        TranslateService
	TranslationRunLogger    TranslationRunLogger
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

func NewServer(deps Dependencies) http.Handler {
	staticHandler := deps.StaticFileHandler
	if staticHandler == nil {
		staticHandler = http.NotFoundHandler()
	}
	providerDefaultsReader := deps.ProviderDefaultsReader
	if providerDefaultsReader == nil {
		providerDefaultsReader = defaultProviderDefaultsReader{}
	}
	providerCenterService := deps.ProviderCenterService
	if providerCenterService == nil {
		providerCenterService = defaultProviderCenterService{}
	}
	workflowTemplateService := deps.WorkflowTemplateService
	if workflowTemplateService == nil {
		workflowTemplateService = defaultWorkflowTemplateService{}
	}
	translateService := deps.TranslateService
	if translateService == nil {
		translateService = defaultTranslateService{}
	}
	runLogger := deps.TranslationRunLogger
	if runLogger == nil {
		runLogger = defaultTranslationRunLogger{}
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/provider-profiles/defaults":
			writeJSON(w, http.StatusOK, providerDefaultsReader.ReadProviderDefaults(r.Context()))
			return
		case r.Method == http.MethodGet && r.URL.Path == "/api/provider-center":
			state, err := providerCenterService.Read(r.Context())
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, state)
			return
		case r.Method == http.MethodGet && r.URL.Path == "/api/workflow-templates":
			state, err := workflowTemplateService.Read(r.Context())
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, state)
			return
		case r.Method == http.MethodPut && r.URL.Path == "/api/workflow-templates":
			var payload domainworkflow.State
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			state, err := workflowTemplateService.Save(r.Context(), payload)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, state)
			return
		case r.Method == http.MethodPut && r.URL.Path == "/api/provider-center":
			var payload domainprovider.State
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			state, err := providerCenterService.Save(r.Context(), payload)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, state)
			return
		case r.Method == http.MethodPost && r.URL.Path == "/api/provider-center/check":
			var payload struct {
				Family    string                  `json:"family"`
				ProfileID string                  `json:"profileId"`
				Profile   *domainprovider.Profile `json:"profile"`
			}
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			profile, result, err := providerCenterService.Check(r.Context(), payload.Family, payload.ProfileID, payload.Profile)
			if err != nil {
				log.Printf("[Provider] Check Error: %s %s - %v", payload.Family, payload.ProfileID, err)
				writeError(w, resolveStatusCode(err), err)
				return
			}
			log.Printf("[Provider] Check Success: %s %s", payload.Family, payload.ProfileID)
			writeJSON(w, http.StatusOK, map[string]any{
				"profile": profile,
				"status":  result.Status,
				"summary": result.Summary,
				"error":   result.Error,
			})
			return
		case r.Method == http.MethodPost && r.URL.Path == "/api/provider-center/models/discover":
			var payload struct {
				Family    string                  `json:"family"`
				ProfileID string                  `json:"profileId"`
				Profile   *domainprovider.Profile `json:"profile"`
			}
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			profile, result, err := providerCenterService.DiscoverModels(r.Context(), payload.Family, payload.ProfileID, payload.Profile)
			if err != nil {
				log.Printf("[Provider] DiscoverModels Error: %s %s - %v", payload.Family, payload.ProfileID, err)
				writeError(w, resolveStatusCode(err), err)
				return
			}
			log.Printf("[Provider] DiscoverModels Success: %s %s, found %d models", payload.Family, payload.ProfileID, len(result.Models))
			writeJSON(w, http.StatusOK, map[string]any{
				"profile": profile,
				"models":  result.Models,
				"summary": result.Summary,
			})
			return
		case r.Method == http.MethodPost && r.URL.Path == "/api/provider-center/models/check":
			var payload struct {
				Family    string                  `json:"family"`
				ProfileID string                  `json:"profileId"`
				ModelID   string                  `json:"modelId"`
				Profile   *domainprovider.Profile `json:"profile"`
			}
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			result, err := providerCenterService.VerifyModel(r.Context(), payload.Family, payload.ProfileID, payload.ModelID, payload.Profile)
			if err != nil {
				log.Printf("[Provider] VerifyModel Error: %s %s %s - %v", payload.Family, payload.ProfileID, payload.ModelID, err)
				writeError(w, resolveStatusCode(err), err)
				return
			}
			log.Printf("[Provider] VerifyModel Success: %s %s %s => %s", payload.Family, payload.ProfileID, payload.ModelID, result.Status)
			writeJSON(w, http.StatusOK, result)
			return
		case r.Method == http.MethodPost && r.URL.Path == "/api/translation-runs":
			var payload CreateRunPayload
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			runID, filePath, err := runLogger.CreateRun(r.Context(), payload)
			if err != nil {
				log.Printf("[Run] CreateRun Error: %v", err)
				writeError(w, resolveStatusCode(err), err)
				return
			}
			log.Printf("[Run] Created Run: %s, file: %s, total entries: %d", runID, filePath, payload.TotalEntries)
			writeJSON(w, http.StatusOK, map[string]any{
				"runId":    runID,
				"filePath": filePath,
			})
			return
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/api/translation-runs/") && strings.HasSuffix(r.URL.Path, "/finalize"):
			var payload FinalizeRunPayload
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			runID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/translation-runs/"), "/finalize")
			if err := runLogger.FinalizeRun(r.Context(), runID, payload); err != nil {
				log.Printf("[Run] FinalizeRun Error: %s - %v", runID, err)
				writeError(w, resolveStatusCode(err), err)
				return
			}
			log.Printf("[Run] Finalized Run: %s, status: %s", runID, payload.Status)
			writeJSON(w, http.StatusOK, map[string]any{
				"runId": runID,
			})
			return
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/api/translate/"):
			provider := strings.TrimPrefix(r.URL.Path, "/api/translate/")
			if !isSupportedProvider(provider) {
				writeError(w, http.StatusBadRequest, errors.New("不支持的翻译引擎"))
				return
			}
			var payload apptranslate.TranslateInput
			if err := decodeJSONBody(r, &payload); err != nil {
				writeError(w, http.StatusBadRequest, errors.New("请求体必须是合法 JSON"))
				return
			}
			if len(payload.Texts) == 0 {
				writeError(w, http.StatusBadRequest, errors.New("至少提供一条待翻译字幕"))
				return
			}

			batchSeq := float64(0)
			if val, ok := payload.Batch["sequence"].(float64); ok {
				batchSeq = val
			}
			batchKind := ""
			if val, ok := payload.Batch["kind"].(string); ok {
				batchKind = val
			}

			log.Printf("[Translate] [%s] Starting batch %v - Run: %s, Provider: %s, Entries: %d, Operation: %s", batchKind, batchSeq, payload.RunID, provider, len(payload.Texts), payload.Operation)

			start := time.Now()
			result, err := translateService.Translate(r.Context(), provider, payload)
			duration := time.Since(start)

			if err != nil {
				log.Printf("[Translate] [%s] Error batch %v - Run: %s, Error: %v", batchKind, batchSeq, payload.RunID, err)
				writeError(w, resolveStatusCode(err), err)
				return
			}

			successCount := 0
			for _, t := range result.Translations {
				if t != "" && t != "[翻译失败]" {
					successCount++
				}
			}

			log.Printf("[Translate] [%s] Completed batch %v - Run: %s, Success: %d/%d, Duration: %v", batchKind, batchSeq, payload.RunID, successCount, len(result.Translations), duration)

			if payload.RunID != "" {
				_ = runLogger.AppendBatch(r.Context(), payload.RunID, map[string]any{
					"provider": provider,
					"request": map[string]any{
						"operation":     payload.Operation,
						"texts":         payload.Texts,
						"contextTexts":  payload.ContextTexts,
						"draftTexts":    payload.DraftTexts,
						"candidateSets": payload.CandidateSets,
						"options":       payload.Options,
					},
					"response": map[string]any{
						"translations": result.Translations,
						"metadata":     result.Metadata,
					},
					"debug": result.Debug,
				})
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"translations": result.Translations,
				"metadata":     result.Metadata,
			})
			return
		default:
			staticHandler.ServeHTTP(w, r)
		}
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			handler.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		handler.ServeHTTP(lrw, r)
		duration := time.Since(start)

		log.Printf("[HTTP] %s %s - %d (%v)", r.Method, r.URL.Path, lrw.statusCode, duration)
	})
}

func isSupportedProvider(provider string) bool {
	switch provider {
	case "openai-compatible", "claude-compatible", "google", "baidu":
		return true
	default:
		return false
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, statusCode int, err error) {
	writeJSON(w, statusCode, map[string]any{
		"error": err.Error(),
	})
}

func decodeJSONBody(r *http.Request, target any) error {
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	if len(body) == 0 {
		body = []byte("{}")
	}

	return json.Unmarshal(body, target)
}

func resolveStatusCode(err error) int {
	switch err.Error() {
	case "不支持的翻译引擎", "请求体必须是合法 JSON", "至少提供一条待翻译字幕", "Provider Profile 标识格式无效", "不支持的工作流节点操作":
		return http.StatusBadRequest
	case "翻译任务不存在":
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}
