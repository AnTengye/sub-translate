package httpserver_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	httpserver "srt-translate/internal/transport/http"
)

func TestServerServesIndexFallback(t *testing.T) {
	t.Parallel()

	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte("<!doctype html><html><body>spa</body></html>"))
		}),
	})

	req := httptest.NewRequest(http.MethodGet, "/subtitle/list", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	if !strings.Contains(rec.Body.String(), "spa") {
		t.Fatalf("expected body to contain SPA content, got %q", rec.Body.String())
	}
}
