package providercenterinfra

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainprovider "srt-translate/internal/domain/providercenter"
)

func TestHealthCheckerCheckFailsWhenModelsRouteIsUnavailable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"upstream unavailable"}}`, http.StatusBadGateway)
	}))
	defer server.Close()

	checker := HealthChecker{
		Client: server.Client(),
	}

	result, err := checker.Check(context.Background(), domainprovider.Profile{
		Family: "openai-compatible",
		Connection: map[string]string{
			"apiEndpoint": server.URL + "/v1",
			"apiKey":      "test-key",
		},
		Settings: map[string]string{},
	})
	if err != nil {
		t.Fatalf("Check() error = %v", err)
	}

	if result.Status != "failed" {
		t.Fatalf("expected failed status, got %#v", result)
	}

	if !strings.Contains(result.Summary, "/models") {
		t.Fatalf("expected summary to mention models route, got %q", result.Summary)
	}

	if result.Error == nil || !strings.Contains(*result.Error, "502") {
		t.Fatalf("expected upstream status in error, got %#v", result.Error)
	}
}

func TestHealthCheckerCheckSucceedsWhenModelsRouteIsReachable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Fatalf("expected /v1/models, got %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("expected bearer auth, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o-mini"}]}`))
	}))
	defer server.Close()

	checker := HealthChecker{
		Client: server.Client(),
	}

	result, err := checker.Check(context.Background(), domainprovider.Profile{
		Family: "openai-compatible",
		Connection: map[string]string{
			"apiEndpoint": server.URL + "/v1",
			"apiKey":      "test-key",
		},
		Settings: map[string]string{},
	})
	if err != nil {
		t.Fatalf("Check() error = %v", err)
	}

	if result.Status != "success" {
		t.Fatalf("expected success status, got %#v", result)
	}

	if !strings.Contains(result.Summary, "/models") {
		t.Fatalf("expected summary to mention models route, got %q", result.Summary)
	}

	if result.Error != nil {
		t.Fatalf("expected nil error, got %#v", result.Error)
	}
}

func TestModelVerifierCheckModelUsesMinimalOpenAICompatibleRequest(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Fatalf("expected /v1/chat/completions, got %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("expected bearer auth, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"pong"}}]}`))
	}))
	defer server.Close()

	verifier := ModelVerifier{Client: server.Client()}
	result, err := verifier.CheckModel(context.Background(), domainprovider.Profile{
		Family: "openai-compatible",
		Connection: map[string]string{
			"apiEndpoint": server.URL + "/v1",
			"apiKey":      "test-key",
		},
		Settings: map[string]string{},
	}, "gpt-4.1-mini")
	if err != nil {
		t.Fatalf("CheckModel() error = %v", err)
	}
	if result.Status != "available" {
		t.Fatalf("expected available status, got %#v", result)
	}
}

func TestModelVerifierCheckModelMarksUpstreamFailureAsUnavailable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"model not assigned"}}`, http.StatusBadGateway)
	}))
	defer server.Close()

	verifier := ModelVerifier{Client: server.Client()}
	result, err := verifier.CheckModel(context.Background(), domainprovider.Profile{
		Family: "openai-compatible",
		Connection: map[string]string{
			"apiEndpoint": server.URL + "/v1",
			"apiKey":      "test-key",
		},
		Settings: map[string]string{},
	}, "gpt-4.1-mini")
	if err != nil {
		t.Fatalf("CheckModel() error = %v", err)
	}
	if result.Status != "unavailable" {
		t.Fatalf("expected unavailable status, got %#v", result)
	}
	if result.Error == nil || !strings.Contains(*result.Error, "model not assigned") {
		t.Fatalf("expected upstream error details, got %#v", result.Error)
	}
}
