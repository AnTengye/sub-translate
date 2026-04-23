package logging

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type CreateRunPayload struct {
	RunID   string
	Request map[string]any
}

type FinalizeRunPayload struct {
	Status  string
	Summary map[string]any
	Error   map[string]any
}

type TranslationRunLoggerDependencies struct {
	LogDir string
	Now    func() time.Time
}

type TranslationRunLogger struct {
	logDir string
	now    func() time.Time
	mu     sync.Mutex
	runs   map[string]*runSession
}

type runSession struct {
	RunID       string           `json:"runId"`
	Status      string           `json:"status"`
	CreatedAt   string           `json:"createdAt"`
	UpdatedAt   string           `json:"updatedAt"`
	CompletedAt *string          `json:"completedAt"`
	FilePath    string           `json:"filePath"`
	Request     map[string]any   `json:"request"`
	Batches     []map[string]any `json:"batches"`
	Summary     map[string]any   `json:"summary"`
	Error       map[string]any   `json:"error"`
}

func NewTranslationRunLogger(deps TranslationRunLoggerDependencies) *TranslationRunLogger {
	nowFn := deps.Now
	if nowFn == nil {
		nowFn = time.Now
	}

	return &TranslationRunLogger{
		logDir: deps.LogDir,
		now:    nowFn,
		runs:   map[string]*runSession{},
	}
}

func (l *TranslationRunLogger) CreateRun(_ context.Context, payload CreateRunPayload) (string, string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	timestamp := l.now().UTC()
	runID := payload.RunID
	if runID == "" {
		return "", "", errors.New("运行标识格式无效")
	}

	session := &runSession{
		RunID:     runID,
		Status:    "running",
		CreatedAt: timestamp.Format(time.RFC3339),
		UpdatedAt: timestamp.Format(time.RFC3339),
		Request:   cloneMap(payload.Request),
		Batches:   []map[string]any{},
	}
	session.FilePath = l.buildFilePath(runID, timestamp)
	l.runs[runID] = session

	if err := l.persist(session); err != nil {
		return "", "", err
	}

	return runID, session.FilePath, nil
}

func (l *TranslationRunLogger) AppendBatch(_ context.Context, runID string, payload map[string]any) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	session, ok := l.runs[runID]
	if !ok {
		return errors.New("翻译任务不存在")
	}

	session.Batches = append(session.Batches, cloneMap(payload))
	session.UpdatedAt = l.now().UTC().Format(time.RFC3339)
	return l.persist(session)
}

func (l *TranslationRunLogger) FinalizeRun(_ context.Context, runID string, payload FinalizeRunPayload) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	session, ok := l.runs[runID]
	if !ok {
		return errors.New("翻译任务不存在")
	}

	// NEW: Generate summary even if not provided to ensure it's never null
	summary := payload.Summary
	if summary == nil {
		summary = l.generateFailureSummary(session)
	}

	timestamp := l.now().UTC().Format(time.RFC3339)
	session.Status = payload.Status
	session.Summary = summary // Guaranteed non-null
	session.Error = cloneMap(payload.Error)
	session.UpdatedAt = timestamp
	session.CompletedAt = &timestamp

	return l.persist(session)
}

// generateFailureSummary creates a comprehensive summary from batch data when none is provided
func (l *TranslationRunLogger) generateFailureSummary(session *runSession) map[string]any {
	totalBatches := len(session.Batches)
	totalEntries := 0
	successfulEntries := 0
	failedBatches := []int{}
	silentFailBatches := []int{}

	for i, batch := range session.Batches {
		successCount := 0
		totalCount := 0
		hasError := false

		if sc, ok := batch["successCount"].(float64); ok {
			successCount = int(sc)
		}
		if tc, ok := batch["totalCount"].(float64); ok {
			totalCount = int(tc)
		}
		if he, ok := batch["hasError"].(bool); ok {
			hasError = he
		}

		totalEntries += totalCount
		successfulEntries += successCount

		// Detect silent failures (0 success but had entries)
		if successCount == 0 && totalCount > 0 {
			silentFailBatches = append(silentFailBatches, i)
		}

		// Track failed batches
		if hasError {
			failedBatches = append(failedBatches, i)
		}
	}

	// Determine error category from error metadata
	errorCategory := "unknown"
	if session.Error != nil {
		if cat, ok := session.Error["category"].(string); ok && cat != "" {
			errorCategory = cat
		}
	}

	failedEntries := totalEntries - successfulEntries
	completionRate := 0.0
	if totalEntries > 0 {
		completionRate = float64(successfulEntries) / float64(totalEntries)
	}

	return map[string]any{
		"totalEntries":      totalEntries,
		"successfulEntries": successfulEntries,
		"failedEntries":     failedEntries,
		"totalBatches":      totalBatches,
		"failedBatches":     failedBatches,
		"silentFailBatches": silentFailBatches,
		"completionRate":    completionRate,
		"errorCategory":     errorCategory,
		"failureReason":     getErrorValue(session.Error, "message"),
	}
}

// getErrorValue safely extracts a value from error map
func getErrorValue(errMap map[string]any, key string) string {
	if errMap == nil {
		return ""
	}
	if val, ok := errMap[key].(string); ok {
		return val
	}
	return ""
}

func (l *TranslationRunLogger) buildFilePath(runID string, timestamp time.Time) string {
	dayKey := timestamp.Format("2006-01-02")
	fileKey := timestamp.Format("2006-01-02T15-04-05")
	return filepath.Join(l.logDir, dayKey, fileKey+"-"+runID+".json")
}

func (l *TranslationRunLogger) persist(session *runSession) error {
	if err := os.MkdirAll(filepath.Dir(session.FilePath), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Clean(session.FilePath), data, 0o644)
}

func cloneMap(input map[string]any) map[string]any {
	if input == nil {
		return nil
	}

	cloned := make(map[string]any, len(input))
	for key, value := range input {
		cloned[key] = value
	}

	return cloned
}
