package providers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apptranslate "srt-translate/internal/app/translate"
)

func TestBuildOperationMessagesIncludesTranslatePrompt(t *testing.T) {
	t.Parallel()

	system, _, err := buildOperationMessages(apptranslate.Request{
		Operation: "translate",
		Texts:     []string{"こんにちは"},
		Options: map[string]any{
			"prompt": "保留敬语，遇到人名使用音译。",
		},
	})
	if err != nil {
		t.Fatalf("buildOperationMessages() error = %v", err)
	}

	if !strings.Contains(system, "补充要求：保留敬语，遇到人名使用音译。") {
		t.Fatalf("expected translate prompt to be appended, got %q", system)
	}
}

func TestBuildThinkingOverrideSupportsGemma(t *testing.T) {
	t.Parallel()

	override := buildThinkingOverride("models/gemma-4-26b-a4b-it", "true")
	expected, ok := override["thinking_budget"].(int)
	if !ok || expected != 0 {
		t.Fatalf("expected gemma thinking override, got %#v", override)
	}
}

func TestGoogleTranslatorTranslateParsesGenerateContentResponse(t *testing.T) {
	t.Parallel()

	var capturedPath string
	var capturedQuery string
	var capturedBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedQuery = r.URL.RawQuery
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("Decode() error = %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{
				map[string]any{
					"content": map[string]any{
						"parts": []any{
							map[string]any{"text": "[\"你好\"]"},
						},
					},
				},
			},
		})
	}))
	defer server.Close()

	translator := GoogleTranslator{
		Client:          server.Client(),
		DefaultEndpoint: server.URL,
	}

	result, err := translator.Translate(context.Background(), apptranslate.Request{
		Operation: "translate",
		Texts:     []string{"こんにちは"},
		Options: map[string]any{
			"model":           "models/gemini-2.5-flash",
			"disableThinking": "true",
		},
		RuntimeOverrides: map[string]any{
			"apiKey": "google-key",
		},
	})
	if err != nil {
		t.Fatalf("Translate() error = %v", err)
	}

	if len(result.Translations) != 1 || result.Translations[0] != "你好" {
		t.Fatalf("unexpected translations %#v", result.Translations)
	}
	if capturedPath != "/models/gemini-2.5-flash:generateContent" {
		t.Fatalf("unexpected request path %q", capturedPath)
	}
	if !strings.Contains(capturedQuery, "key=google-key") {
		t.Fatalf("expected api key in query, got %q", capturedQuery)
	}

	generationConfig, ok := capturedBody["generationConfig"].(map[string]any)
	if !ok {
		t.Fatalf("expected generationConfig in payload, got %#v", capturedBody)
	}
	if generationConfig["temperature"] != 0.3 {
		t.Fatalf("expected default temperature, got %#v", generationConfig["temperature"])
	}
	if _, exists := capturedBody["thinkingConfig"]; exists {
		t.Fatalf("expected top-level thinkingConfig to be omitted, got %#v", capturedBody["thinkingConfig"])
	}
	thinkingConfig, ok := generationConfig["thinkingConfig"].(map[string]any)
	if !ok || thinkingConfig["thinkingBudget"] != float64(0) {
		t.Fatalf("expected generationConfig.thinkingConfig override, got %#v", generationConfig["thinkingConfig"])
	}
}

func TestGoogleTranslatorTranslateOmitsThinkingConfigForGemmaModels(t *testing.T) {
	t.Parallel()

	var capturedBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("Decode() error = %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{
				map[string]any{
					"content": map[string]any{
						"parts": []any{
							map[string]any{"text": "[\"你好\"]"},
						},
					},
				},
			},
		})
	}))
	defer server.Close()

	translator := GoogleTranslator{
		Client:          server.Client(),
		DefaultEndpoint: server.URL,
	}

	_, err := translator.Translate(context.Background(), apptranslate.Request{
		Operation: "translate",
		Texts:     []string{"こんにちは"},
		Options: map[string]any{
			"model":           "models/gemma-4-26b-a4b-it",
			"disableThinking": "true",
		},
		RuntimeOverrides: map[string]any{
			"apiKey": "google-key",
		},
	})
	if err != nil {
		t.Fatalf("Translate() error = %v", err)
	}

	generationConfig, ok := capturedBody["generationConfig"].(map[string]any)
	if !ok {
		t.Fatalf("expected generationConfig in payload, got %#v", capturedBody)
	}
	if _, exists := generationConfig["thinkingConfig"]; exists {
		t.Fatalf("expected gemma request to omit generationConfig.thinkingConfig, got %#v", generationConfig["thinkingConfig"])
	}
}
