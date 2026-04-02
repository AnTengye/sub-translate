package httpserver_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	appprovidercenter "srt-translate/internal/app/providercenter"
	apptranslate "srt-translate/internal/app/translate"
	domainprovider "srt-translate/internal/domain/providercenter"
	domainworkflow "srt-translate/internal/domain/workflow"
	httpserver "srt-translate/internal/transport/http"
)

type fakeProviderDefaultsReader struct {
	value map[string]any
}

func (f fakeProviderDefaultsReader) ReadProviderDefaults(context.Context) map[string]any {
	return f.value
}

type fakeProviderCenterService struct {
	state          domainprovider.State
	checkedFamily  string
	checkedID      string
	checkedProfile *domainprovider.Profile
}

func (f fakeProviderCenterService) Read(_ context.Context) (domainprovider.State, error) {
	return f.state, nil
}

func (f fakeProviderCenterService) Save(_ context.Context, state domainprovider.State) (domainprovider.State, error) {
	f.state = state
	return state, nil
}

func (f *fakeProviderCenterService) Check(_ context.Context, family string, profileID string, profile *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.HealthCheckResult, error) {
	f.checkedFamily = family
	f.checkedID = profileID
	f.checkedProfile = profile
	if profile != nil {
		return *profile, appprovidercenter.HealthCheckResult{
			Status:  profile.Health.Status,
			Summary: profile.Health.Summary,
			Error:   profile.Health.Error,
		}, nil
	}
	for _, profile := range f.state.Families[family].Profiles {
		if profile.ID == profileID {
			return profile, appprovidercenter.HealthCheckResult{
				Status:  profile.Health.Status,
				Summary: profile.Health.Summary,
				Error:   profile.Health.Error,
			}, nil
		}
	}
	return domainprovider.Profile{}, appprovidercenter.HealthCheckResult{}, nil
}

func (f *fakeProviderCenterService) DiscoverModels(_ context.Context, family string, profileID string, profile *domainprovider.Profile) (domainprovider.Profile, appprovidercenter.ModelDiscoveryResult, error) {
	if profile != nil {
		return *profile, appprovidercenter.ModelDiscoveryResult{
			Models:                 profile.AvailableModels,
			Summary:                "发现 0 个模型",
			SupportsModelDiscovery: true,
		}, nil
	}
	for _, profile := range f.state.Families[family].Profiles {
		if profile.ID == profileID {
			return profile, appprovidercenter.ModelDiscoveryResult{
				Models:                 profile.AvailableModels,
				Summary:                "发现 0 个模型",
				SupportsModelDiscovery: true,
			}, nil
		}
	}
	return domainprovider.Profile{}, appprovidercenter.ModelDiscoveryResult{}, nil
}

type fakeTranslateService struct {
	lastProvider string
	lastInput    apptranslate.TranslateInput
}

func (f *fakeTranslateService) Translate(_ context.Context, provider string, input apptranslate.TranslateInput) (apptranslate.Result, error) {
	f.lastProvider = provider
	f.lastInput = input

	result := apptranslate.Result{
		Translations: []string{"你好"},
		Debug: map[string]any{
			"provider": provider,
			"runId":    input.RunID,
		},
	}
	if input.Operation == "judge" {
		result.Metadata = map[string]any{
			"decisions": []map[string]any{
				{"winner": "A", "reason": "更自然"},
			},
		}
	}

	return result, nil
}

type fakeWorkflowTemplateService struct {
	state domainworkflow.State
}

func (f fakeWorkflowTemplateService) Read(context.Context) (domainworkflow.State, error) {
	return f.state, nil
}

func (f fakeWorkflowTemplateService) Save(_ context.Context, state domainworkflow.State) (domainworkflow.State, error) {
	f.state = state
	return state, nil
}

type fakeRunLogger struct {
	createdRunID string
	finalizedID  string
}

func (f *fakeRunLogger) CreateRun(_ context.Context, payload httpserver.CreateRunPayload) (string, string, error) {
	f.createdRunID = payload.RunID
	return payload.RunID, "logs/file.json", nil
}

func (f *fakeRunLogger) AppendBatch(context.Context, string, map[string]any) error {
	return nil
}

func (f *fakeRunLogger) FinalizeRun(_ context.Context, runID string, _ httpserver.FinalizeRunPayload) error {
	f.finalizedID = runID
	return nil
}

func TestProviderDefaultsRouteReturnsConfiguredPayload(t *testing.T) {
	t.Parallel()

	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler: http.NotFoundHandler(),
		ProviderDefaultsReader: fakeProviderDefaultsReader{
			value: map[string]any{
				"defaultProvider": "openai-compatible",
			},
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/provider-profiles/defaults", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if payload["defaultProvider"] != "openai-compatible" {
		t.Fatalf("expected defaultProvider openai-compatible, got %#v", payload["defaultProvider"])
	}
}

func TestProviderCenterRouteReturnsState(t *testing.T) {
	t.Parallel()

	service := &fakeProviderCenterService{
		state: domainprovider.State{
			Version:         1,
			DefaultProvider: "openai-compatible",
			Families: map[string]domainprovider.Family{
				"openai-compatible": {ID: "openai-compatible"},
			},
		},
	}
	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler:     http.NotFoundHandler(),
		ProviderCenterService: service,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/provider-center", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestProviderCenterCheckRouteUsesDraftProfileFromRequest(t *testing.T) {
	t.Parallel()

	service := &fakeProviderCenterService{
		state: domainprovider.State{
			Version:         1,
			DefaultProvider: "openai-compatible",
			Families: map[string]domainprovider.Family{
				"openai-compatible": {
					ID:              "openai-compatible",
					ActiveProfileID: "saved-profile",
					Profiles: []domainprovider.Profile{
						{
							ID:         "saved-profile",
							Family:     "openai-compatible",
							Name:       "Saved",
							Connection: map[string]string{"apiEndpoint": "https://saved.example.com/v1", "apiKey": "saved-key"},
							Health:     domainprovider.Health{Status: "idle", Summary: "saved"},
						},
					},
				},
			},
		},
	}
	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler:     http.NotFoundHandler(),
		ProviderCenterService: service,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/provider-center/check", bytes.NewBufferString(`{
		"family":"openai-compatible",
		"profileId":"saved-profile",
		"profile":{
			"id":"saved-profile",
			"family":"openai-compatible",
			"name":"Draft",
			"enabled":true,
			"isDefault":true,
			"connection":{"apiEndpoint":"https://draft.example.com/v1","apiKey":"draft-key"},
			"settings":{"model":"gpt-4.1-mini"},
			"capabilities":{"supportsConnectionCheck":true},
			"models":[],
			"modelDiscovery":{"sourceMode":"auto","supportsModelDiscovery":true,"lastCheckedAt":null,"lastStatus":"idle","lastError":null},
			"health":{"status":"success","summary":"draft","lastCheckedAt":null,"error":null}
		}
	}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	if service.checkedProfile == nil {
		t.Fatalf("expected draft profile to be forwarded to the service")
	}

	if got := service.checkedProfile.Connection["apiEndpoint"]; got != "https://draft.example.com/v1" {
		t.Fatalf("expected draft endpoint to be used, got %q", got)
	}

	if got := service.checkedProfile.Connection["apiKey"]; got != "draft-key" {
		t.Fatalf("expected draft api key to be used, got %q", got)
	}
}

func TestUnsupportedProviderReturnsBadRequest(t *testing.T) {
	t.Parallel()

	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler: http.NotFoundHandler(),
	})

	req := httptest.NewRequest(http.MethodPost, "/api/translate/unknown", bytes.NewBufferString(`{"texts":["x"]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestTranslationRunAndTranslateRoutes(t *testing.T) {
	t.Parallel()

	logger := &fakeRunLogger{}
	translateService := &fakeTranslateService{}
	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler:    http.NotFoundHandler(),
		TranslateService:     translateService,
		TranslationRunLogger: logger,
	})

	createReq := httptest.NewRequest(http.MethodPost, "/api/translation-runs", bytes.NewBufferString(`{
		"runId":"run-1",
		"fileName":"sample.srt",
		"provider":"openai-compatible",
		"totalEntries":1,
		"entries":[{"idx":1,"timecode":"00:00:01,000 --> 00:00:02,000","text":"こんにちは"}],
		"providerConfig":{"model":"gpt-4o-mini"},
		"translationConfig":{"batchSize":20}
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	handler.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusOK {
		t.Fatalf("expected create run status %d, got %d", http.StatusOK, createRec.Code)
	}

	translateReq := httptest.NewRequest(http.MethodPost, "/api/translate/openai-compatible", bytes.NewBufferString(`{
		"runId":"run-1",
		"texts":["こんにちは"],
		"contextTexts":[],
		"options":{"model":"gpt-4o-mini"}
	}`))
	translateReq.Header.Set("Content-Type", "application/json")
	translateRec := httptest.NewRecorder()
	handler.ServeHTTP(translateRec, translateReq)

	if translateRec.Code != http.StatusOK {
		t.Fatalf("expected translate status %d, got %d", http.StatusOK, translateRec.Code)
	}

	var translatePayload map[string]any
	if err := json.Unmarshal(translateRec.Body.Bytes(), &translatePayload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	translations, ok := translatePayload["translations"].([]any)
	if !ok || len(translations) != 1 || translations[0] != "你好" {
		t.Fatalf("unexpected translations payload %#v", translatePayload["translations"])
	}

	finalizeReq := httptest.NewRequest(http.MethodPost, "/api/translation-runs/run-1/finalize", bytes.NewBufferString(`{
		"status":"completed",
		"summary":{"translatedCount":1}
	}`))
	finalizeReq.Header.Set("Content-Type", "application/json")
	finalizeRec := httptest.NewRecorder()
	handler.ServeHTTP(finalizeRec, finalizeReq)

	if finalizeRec.Code != http.StatusOK {
		t.Fatalf("expected finalize status %d, got %d", http.StatusOK, finalizeRec.Code)
	}

	if logger.createdRunID != "run-1" {
		t.Fatalf("expected created run id run-1, got %q", logger.createdRunID)
	}

	if logger.finalizedID != "run-1" {
		t.Fatalf("expected finalized run id run-1, got %q", logger.finalizedID)
	}

	if translateService.lastProvider != "openai-compatible" {
		t.Fatalf("expected provider to be forwarded, got %q", translateService.lastProvider)
	}
}

func TestWorkflowTemplateRoutes(t *testing.T) {
	t.Parallel()

	service := fakeWorkflowTemplateService{
		state: domainworkflow.State{
			Version: 1,
			Templates: []domainworkflow.Template{
				{
					ID:   "quality",
					Name: "质量优先",
					Stages: []domainworkflow.Stage{
						{ID: "translate", Name: "主翻译", Type: "translate", Execution: "serial", Strategy: "fallback"},
					},
				},
			},
		},
	}
	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler:       http.NotFoundHandler(),
		WorkflowTemplateService: service,
	})

	readReq := httptest.NewRequest(http.MethodGet, "/api/workflow-templates", nil)
	readRec := httptest.NewRecorder()
	handler.ServeHTTP(readRec, readReq)

	if readRec.Code != http.StatusOK {
		t.Fatalf("expected read status %d, got %d", http.StatusOK, readRec.Code)
	}

	saveReq := httptest.NewRequest(http.MethodPut, "/api/workflow-templates", bytes.NewBufferString(`{
		"version":1,
		"templates":[
			{
				"id":"compare",
				"name":"双路比对",
				"description":"parallel compare",
				"scenario":"comparison",
				"stages":[
					{"id":"translate","name":"候选翻译","type":"translate","execution":"parallel","strategy":"keep-all","nodes":[]}
				]
			}
		]
	}`))
	saveReq.Header.Set("Content-Type", "application/json")
	saveRec := httptest.NewRecorder()
	handler.ServeHTTP(saveRec, saveReq)

	if saveRec.Code != http.StatusOK {
		t.Fatalf("expected save status %d, got %d", http.StatusOK, saveRec.Code)
	}

	var payload domainworkflow.State
	if err := json.Unmarshal(saveRec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if len(payload.Templates) != 1 || payload.Templates[0].ID != "compare" {
		t.Fatalf("unexpected workflow payload %#v", payload)
	}
}

func TestJudgeTranslateRouteReturnsMetadataAndWorkflowPayload(t *testing.T) {
	t.Parallel()

	translateService := &fakeTranslateService{}
	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler: http.NotFoundHandler(),
		TranslateService:  translateService,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/translate/openai-compatible", bytes.NewBufferString(`{
		"runId":"run-judge-1",
		"operation":"judge",
		"texts":["こんにちは"],
		"candidateSets":[
			{"key":"A","label":"候选 A","texts":["你好"]},
			{"key":"B","label":"候选 B","texts":["您好"]}
		],
		"options":{"model":"gpt-4o-mini"}
	}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	if translateService.lastInput.Operation != "judge" {
		t.Fatalf("expected judge operation to be forwarded, got %q", translateService.lastInput.Operation)
	}

	if len(translateService.lastInput.CandidateSets) != 2 {
		t.Fatalf("expected candidate sets to be forwarded, got %#v", translateService.lastInput.CandidateSets)
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if _, ok := payload["metadata"].(map[string]any); !ok {
		t.Fatalf("expected metadata payload, got %#v", payload)
	}
}
