package translate

import (
	"context"
	"errors"

	domainprovider "srt-translate/internal/domain/providercenter"
)

type TranslateInput struct {
	RunID            string
	ProfileID        string
	Texts            []string
	ContextTexts     []string
	Batch            map[string]any
	Options          map[string]any
	RuntimeOverrides map[string]any
}

type Request struct {
	RunID            string
	ProfileID        string
	Texts            []string
	ContextTexts     []string
	Batch            map[string]any
	Options          map[string]any
	RuntimeOverrides map[string]any
}

type Result struct {
	Translations []string
	Debug        map[string]any
}

type Translator interface {
	Translate(context.Context, Request) (Result, error)
}

type ProviderCenterReader interface {
	Read(context.Context) (domainprovider.State, error)
}

type Dependencies struct {
	ProviderCenterReader       ProviderCenterReader
	OpenAICompatibleTranslator Translator
	ClaudeCompatibleTranslator Translator
	BaiduTranslator            Translator
	MaxConcurrency             int
}

type Service struct {
	providerCenterReader       ProviderCenterReader
	openAICompatibleTranslator Translator
	claudeCompatibleTranslator Translator
	baiduTranslator            Translator
	semaphore                  chan struct{}
}

func NewService(deps Dependencies) *Service {
	service := &Service{
		providerCenterReader:       deps.ProviderCenterReader,
		openAICompatibleTranslator: deps.OpenAICompatibleTranslator,
		claudeCompatibleTranslator: deps.ClaudeCompatibleTranslator,
		baiduTranslator:            deps.BaiduTranslator,
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
		Texts:            input.Texts,
		ContextTexts:     input.ContextTexts,
		Batch:            cloneMap(input.Batch),
		Options:          cloneMap(input.Options),
		RuntimeOverrides: cloneMap(input.RuntimeOverrides),
	}

	profile, err := s.resolveProfile(ctx, provider, input.ProfileID)
	if err != nil {
		return Result{}, err
	}

	mergeProfileIntoRequest(profile, &request)

	translator, err := s.resolveTranslator(provider)
	if err != nil {
		return Result{}, err
	}

	return translator.Translate(ctx, request)
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
