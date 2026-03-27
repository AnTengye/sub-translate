package logging_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"srt-translate/internal/infra/logging"
)

func TestCreateAppendAndFinalizeRunLog(t *testing.T) {
	t.Parallel()

	logDir := t.TempDir()
	logger := logging.NewTranslationRunLogger(logging.TranslationRunLoggerDependencies{
		LogDir: logDir,
		Now: func() time.Time {
			return time.Date(2026, 3, 27, 10, 11, 12, 0, time.UTC)
		},
	})

	runID, filePath, err := logger.CreateRun(context.Background(), logging.CreateRunPayload{
		RunID: "1001",
		Request: map[string]any{
			"fileName": "sample.srt",
		},
	})
	if err != nil {
		t.Fatalf("CreateRun() error = %v", err)
	}

	if runID != "1001" {
		t.Fatalf("expected runID 1001, got %q", runID)
	}

	if _, err := os.Stat(filePath); err != nil {
		t.Fatalf("expected log file to exist: %v", err)
	}

	if err := logger.AppendBatch(context.Background(), runID, map[string]any{
		"provider": "openai-compatible",
	}); err != nil {
		t.Fatalf("AppendBatch() error = %v", err)
	}

	if err := logger.FinalizeRun(context.Background(), runID, logging.FinalizeRunPayload{
		Status: "completed",
		Summary: map[string]any{
			"translatedCount": 1,
		},
	}); err != nil {
		t.Fatalf("FinalizeRun() error = %v", err)
	}

	raw, err := os.ReadFile(filepath.Clean(filePath))
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if payload["status"] != "completed" {
		t.Fatalf("expected status completed, got %#v", payload["status"])
	}

	batches, ok := payload["batches"].([]any)
	if !ok || len(batches) != 1 {
		t.Fatalf("expected 1 batch, got %#v", payload["batches"])
	}
}
