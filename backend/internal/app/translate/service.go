package translate

import (
	"context"
	"errors"
	"fmt"

	domainprovider "srt-translate/internal/domain/providercenter"
)

// InvalidResultError represents a case where HTTP 200 was returned but no valid translations were produced
type InvalidResultError struct {
	StatusCode int
	RawBody    string
	Message    string
}

func (e *InvalidResultError) Error() string {
	return fmt.Sprintf("invalid result (HTTP %d): %s", e.StatusCode, e.Message)
}

func (e *InvalidResultError) IsInvalidResult() bool { return true }

type TranslateInput struct {
	RunID            string
	ProfileID        string
	Operation        string
	Texts            []string
	ContextTexts     []string
	DraftTexts       []string
	CandidateSets    []JudgeCandidate
	Batch            map[string]any
	Options          map[string]any
	RuntimeOverrides map[string]any
}

type JudgeCandidate struct {
	Key   string
	Label string
	Texts []string
}

type Request struct {
	RunID            string
	ProfileID        string
	Operation        string
	Texts            []string
	ContextTexts     []string
	DraftTexts       []string
	CandidateSets    []JudgeCandidate
	Batch            map[string]any
	Options          map[string]any
	RuntimeOverrides map[string]any
}

type Result struct {
	Translations  []string
	Debug         map[string]any
	Metadata      map[string]any
	ErrorCategory string `json:"errorCategory,omitempty"` // NEW: Classified error type
	RawErrorBody  string `json:"rawErrorBody,omitempty"`  // NEW: Original error response body
}

type Translator interface {
	Translate(context.Context, Request) (Result, error)
}

type ProviderCenterReader interface {
	Read(context.Context) (domainprovider.State, error)
}

type RpmWaiter interface {
	Wait(ctx context.Context, key string, rpm int, rpd int) error
}

type Dependencies struct {
	ProviderCenterReader       ProviderCenterReader
	OpenAICompatibleTranslator Translator
	ClaudeCompatibleTranslator Translator
	GoogleTranslator           Translator
	BaiduTranslator            Translator
	MaxConcurrency             int
	RpmLimiter                 RpmWaiter
}

type Service struct {
	providerCenterReader       ProviderCenterReader
	openAICompatibleTranslator Translator
	claudeCompatibleTranslator Translator
	googleTranslator           Translator
	baiduTranslator            Translator
	semaphore                  chan struct{}
	rpmLimiter                 RpmWaiter
}

func NewService(deps Dependencies) *Service {
	service := &Service{
		providerCenterReader:       deps.ProviderCenterReader,
		openAICompatibleTranslator: deps.OpenAICompatibleTranslator,
		claudeCompatibleTranslator: deps.ClaudeCompatibleTranslator,
		googleTranslator:           deps.GoogleTranslator,
		baiduTranslator:            deps.BaiduTranslator,
		rpmLimiter:                 deps.RpmLimiter,
	}
	if deps.MaxConcurrency > 0 {
		service.semaphore = make(chan struct{}, deps.MaxConcurrency)
	}
	return service
}

func (s *Service) Translate(ctx context.Context, provider string, input TranslateInput) (Result, error) {
	release, err := s.acquire(ctx)
	if err != nil {
		return Result{}, err
	}
	defer release()

	request := Request{
		RunID:            input.RunID,
		ProfileID:        input.ProfileID,
		Operation:        input.Operation,
		Texts:            input.Texts,
		ContextTexts:     input.ContextTexts,
		DraftTexts:       cloneStrings(input.DraftTexts),
		CandidateSets:    cloneCandidateSets(input.CandidateSets),
		Batch:            cloneMap(input.Batch),
		Options:          cloneMap(input.Options),
		RuntimeOverrides: cloneMap(input.RuntimeOverrides),
	}

	profile, err := s.resolveProfile(ctx, provider, input.ProfileID)
	if err != nil {
		return Result{}, err
	}

	mergeProfileIntoRequest(profile, &request)

	if err := s.waitForRpm(ctx, profile, &request); err != nil {
		return Result{}, err
	}

	translator, err := s.resolveTranslator(provider)
	if err != nil {
		return Result{}, err
	}

	return translator.Translate(ctx, request)
}

func (s *Service) waitForRpm(ctx context.Context, profile *domainprovider.Profile, request *Request) error {
	if s.rpmLimiter == nil || profile == nil {
		return nil
	}

	modelID := stringVal(request.Options["model"])
	if modelID == "" {
		modelID = stringVal(request.Options["modelType"])
	}
	if modelID == "" {
		return nil
	}

	globalRpm := 0
	globalRpd := 0
	if s.providerCenterReader != nil {
		if state, err := s.providerCenterReader.Read(ctx); err == nil {
			globalRpm = state.Limits.GlobalRpmLimit
			globalRpd = state.Limits.GlobalRpdLimit
		}
	}

	for _, model := range profile.Models {
		if model.ID == modelID {
			rpmLimit := model.RpmLimit
			if rpmLimit <= 0 {
				rpmLimit = profile.RpmLimit
			}
			if rpmLimit <= 0 {
				rpmLimit = globalRpm
			}
			rpdLimit := model.RpdLimit
			if rpdLimit <= 0 {
				rpdLimit = profile.RpdLimit
			}
			if rpdLimit <= 0 {
				rpdLimit = globalRpd
			}
			if rpmLimit <= 0 && rpdLimit <= 0 {
				return nil
			}
			key := profile.ID + ":" + model.ID
			return s.rpmLimiter.Wait(ctx, key, rpmLimit, rpdLimit)
		}
	}

	return nil
}

func stringVal(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func (s *Service) acquire(ctx context.Context) (func(), error) {
	if s.semaphore == nil {
		return func() {}, nil
	}

	select {
	case s.semaphore <- struct{}{}:
		return func() { <-s.semaphore }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (s *Service) resolveTranslator(provider string) (Translator, error) {
	switch provider {
	case "openai-compatible":
		if s.openAICompatibleTranslator == nil {
			return nil, errors.New("不支持的翻译引擎")
		}
		return s.openAICompatibleTranslator, nil
	case "claude-compatible":
		if s.claudeCompatibleTranslator == nil {
			return nil, errors.New("不支持的翻译引擎")
		}
		return s.claudeCompatibleTranslator, nil
	case "google":
		if s.googleTranslator == nil {
			return nil, errors.New("不支持的翻译引擎")
		}
		return s.googleTranslator, nil
	case "baidu":
		if s.baiduTranslator == nil {
			return nil, errors.New("不支持的翻译引擎")
		}
		return s.baiduTranslator, nil
	default:
		return nil, errors.New("不支持的翻译引擎")
	}
}

func (s *Service) resolveProfile(ctx context.Context, family string, profileID string) (*domainprovider.Profile, error) {
	if s.providerCenterReader == nil {
		return nil, nil
	}

	state, err := s.providerCenterReader.Read(ctx)
	if err != nil {
		return nil, err
	}

	group, ok := state.Families[family]
	if !ok {
		return nil, nil
	}

	resolvedProfileID := profileID
	if resolvedProfileID == "" {
		resolvedProfileID = group.ActiveProfileID
	}

	for _, profile := range group.Profiles {
		if profile.ID == resolvedProfileID {
			profileCopy := profile
			return &profileCopy, nil
		}
	}

	return nil, nil
}

func mergeProfileIntoRequest(profile *domainprovider.Profile, request *Request) {
	if profile == nil {
		return
	}

	for key, value := range profile.Settings {
		if value == "" {
			continue
		}
		if _, exists := request.Options[key]; !exists {
			request.Options[key] = value
		}
	}

	switch profile.Family {
	case "openai-compatible", "claude-compatible":
		if endpoint := profile.Connection["apiEndpoint"]; endpoint != "" {
			if _, exists := request.RuntimeOverrides["apiEndpoint"]; !exists {
				request.RuntimeOverrides["apiEndpoint"] = endpoint
			}
		}
		if apiKey := profile.Connection["apiKey"]; apiKey != "" {
			if _, exists := request.RuntimeOverrides["apiKey"]; !exists {
				request.RuntimeOverrides["apiKey"] = apiKey
			}
		}
		if providerLabel := profile.Settings["providerLabel"]; providerLabel != "" {
			if _, exists := request.RuntimeOverrides["providerLabel"]; !exists {
				request.RuntimeOverrides["providerLabel"] = providerLabel
			}
		}
	case "google":
		for _, key := range []string{"apiEndpoint", "apiKey"} {
			if value := profile.Connection[key]; value != "" {
				if _, exists := request.RuntimeOverrides[key]; !exists {
					request.RuntimeOverrides[key] = value
				}
			}
		}
	case "baidu":
		for _, key := range []string{"apiEndpoint", "appId", "apiKey", "secretKey"} {
			if value := profile.Connection[key]; value != "" {
				if _, exists := request.RuntimeOverrides[key]; !exists {
					request.RuntimeOverrides[key] = value
				}
			}
		}
	}
}

func cloneMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}

	cloned := make(map[string]any, len(input))
	for key, value := range input {
		cloned[key] = value
	}

	return cloned
}

func cloneStrings(input []string) []string {
	if input == nil {
		return nil
	}

	cloned := make([]string, len(input))
	copy(cloned, input)
	return cloned
}

func cloneCandidateSets(input []JudgeCandidate) []JudgeCandidate {
	if input == nil {
		return nil
	}

	cloned := make([]JudgeCandidate, len(input))
	for index, candidate := range input {
		cloned[index] = JudgeCandidate{
			Key:   candidate.Key,
			Label: candidate.Label,
			Texts: cloneStrings(candidate.Texts),
		}
	}
	return cloned
}

// BatchResult tracks the outcome of a single batch execution
type BatchResult struct {
	SuccessCount int
	FailureCount int
	TotalCount   int
	HasError     bool
	ErrorType    string
}

// StageCompletionReport validates whether a stage can safely transition to the next
type StageCompletionReport struct {
	TotalEntries      int
	SuccessfulEntries int
	FailedEntries     int
	SilentFailures    int
	FailedBatches     []int
	SilentFailBatches []int
	IsComplete        bool
	Blockers          []string
}

// ValidateStageCompletion checks if a stage has completed successfully enough to proceed
func ValidateStageCompletion(results []BatchResult, totalEntries int) StageCompletionReport {
	report := StageCompletionReport{
		TotalEntries: totalEntries,
	}

	for i, batch := range results {
		if batch.SuccessCount == 0 && batch.TotalCount > 0 {
			report.SilentFailures += batch.TotalCount
			report.SilentFailBatches = append(report.SilentFailBatches, i)
			report.Blockers = append(report.Blockers,
				fmt.Sprintf("batch %d: 0/%d silent failure", i, batch.TotalCount))
		}
		report.FailedEntries += batch.FailureCount
		report.SuccessfulEntries += batch.SuccessCount
		if batch.HasError || batch.FailureCount > 0 {
			report.FailedBatches = append(report.FailedBatches, i)
		}
	}

	// Allow transition if no silent failures and failure rate < 50%
	report.IsComplete = report.SilentFailures == 0 && report.FailedEntries < totalEntries/2
	return report
}
