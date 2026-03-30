package providercenter

import (
	"context"
	"errors"

	"gorm.io/gorm"
	domain "srt-translate/internal/domain/providercenter"
)

type Repository interface {
	Read(context.Context) (domain.State, error)
	Save(context.Context, domain.State) error
}

type HealthCheckResult struct {
	Status  string  `json:"status"`
	Summary string  `json:"summary"`
	Error   *string `json:"error"`
}

type ModelDiscoveryResult struct {
	Models                 []domain.Model `json:"models"`
	Summary                string         `json:"summary"`
	SupportsModelDiscovery bool           `json:"supportsModelDiscovery"`
}

type HealthChecker interface {
	Check(context.Context, domain.Profile) (HealthCheckResult, error)
}

type ModelDiscoverer interface {
	Discover(context.Context, domain.Profile) (ModelDiscoveryResult, error)
}

type Dependencies struct {
	DefaultProvider string
	Env             map[string]string
	Repository      Repository
	HealthChecker   HealthChecker
	ModelDiscoverer ModelDiscoverer
}

type Service struct {
	defaultProvider string
	env             map[string]string
	repository      Repository
	healthChecker   HealthChecker
	modelDiscoverer ModelDiscoverer
}

func NewService(deps Dependencies) *Service {
	defaultProvider := deps.DefaultProvider
	if defaultProvider == "" {
		defaultProvider = "openai-compatible"
	}

	return &Service{
		defaultProvider: defaultProvider,
		env:             deps.Env,
		repository:      deps.Repository,
		healthChecker:   deps.HealthChecker,
		modelDiscoverer: deps.ModelDiscoverer,
	}
}

func (s *Service) Read(ctx context.Context) (domain.State, error) {
	if s.repository == nil {
		return seedState(s.defaultProvider, s.env), nil
	}

	state, err := s.repository.Read(ctx)
	if err == nil {
		return state, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.State{}, err
	}

	seeded := seedState(s.defaultProvider, s.env)
	if saveErr := s.repository.Save(ctx, seeded); saveErr != nil {
		return domain.State{}, saveErr
	}

	return seeded, nil
}

func (s *Service) Save(ctx context.Context, nextState domain.State) (domain.State, error) {
	if s.repository == nil {
		return nextState, nil
	}

	if err := s.repository.Save(ctx, nextState); err != nil {
		return domain.State{}, err
	}

	return nextState, nil
}

func (s *Service) Check(ctx context.Context, family string, profileID string, draft *domain.Profile) (domain.Profile, HealthCheckResult, error) {
	state, profile, shouldPersist, err := s.loadCheckProfile(ctx, family, profileID, draft)
	if err != nil {
		return domain.Profile{}, HealthCheckResult{}, err
	}

	if s.healthChecker == nil {
		return *profile, HealthCheckResult{
			Status:  profile.Health.Status,
			Summary: profile.Health.Summary,
			Error:   profile.Health.Error,
		}, nil
	}

	result, err := s.healthChecker.Check(ctx, *profile)
	if err != nil {
		return domain.Profile{}, HealthCheckResult{}, err
	}

	profile.Health = domain.Health{
		Status:  result.Status,
		Summary: result.Summary,
		Error:   result.Error,
	}
	if shouldPersist {
		if err := s.saveProfile(ctx, state, *profile); err != nil {
			return domain.Profile{}, HealthCheckResult{}, err
		}
	}

	return *profile, result, nil
}

func (s *Service) DiscoverModels(ctx context.Context, family string, profileID string, draft *domain.Profile) (domain.Profile, ModelDiscoveryResult, error) {
	state, profile, shouldPersist, err := s.loadCheckProfile(ctx, family, profileID, draft)
	if err != nil {
		return domain.Profile{}, ModelDiscoveryResult{}, err
	}

	if s.modelDiscoverer == nil {
		return *profile, ModelDiscoveryResult{
			Models:                 profile.AvailableModels,
			Summary:                "当前 provider 仅支持手动模型管理",
			SupportsModelDiscovery: false,
		}, nil
	}

	result, err := s.modelDiscoverer.Discover(ctx, *profile)
	if err != nil {
		return domain.Profile{}, ModelDiscoveryResult{}, err
	}

	profile.AvailableModels = result.Models
	profile.ModelDiscovery.SupportsModelDiscovery = result.SupportsModelDiscovery
	profile.ModelDiscovery.LastStatus = "success"
	profile.ModelDiscovery.LastError = nil
	if shouldPersist {
		if err := s.saveProfile(ctx, state, *profile); err != nil {
			return domain.Profile{}, ModelDiscoveryResult{}, err
		}
	}

	return *profile, result, nil
}

func (s *Service) loadCheckProfile(
	ctx context.Context,
	family string,
	profileID string,
	draft *domain.Profile,
) (domain.State, *domain.Profile, bool, error) {
	if draft == nil {
		state, profile, err := s.loadProfile(ctx, family, profileID)
		return state, profile, true, err
	}

	if family != "" && draft.Family != "" && draft.Family != family {
		return domain.State{}, nil, false, errors.New("Provider Profile 标识格式无效")
	}
	if profileID != "" && draft.ID != "" && draft.ID != profileID {
		return domain.State{}, nil, false, errors.New("Provider Profile 标识格式无效")
	}

	profileCopy := *draft
	if profileCopy.Family == "" {
		profileCopy.Family = family
	}
	if profileCopy.ID == "" {
		profileCopy.ID = profileID
	}
	if profileCopy.Family == "" || profileCopy.ID == "" {
		return domain.State{}, nil, false, errors.New("Provider Profile 标识格式无效")
	}

	return domain.State{}, &profileCopy, false, nil
}

func (s *Service) loadProfile(ctx context.Context, family string, profileID string) (domain.State, *domain.Profile, error) {
	state, err := s.Read(ctx)
	if err != nil {
		return domain.State{}, nil, err
	}

	group, ok := state.Families[family]
	if !ok {
		return domain.State{}, nil, errors.New("不支持的翻译引擎")
	}

	resolvedProfileID := profileID
	if resolvedProfileID == "" {
		resolvedProfileID = group.ActiveProfileID
	}

	for _, profile := range group.Profiles {
		if profile.ID == resolvedProfileID {
			profileCopy := profile
			return state, &profileCopy, nil
		}
	}

	return domain.State{}, nil, errors.New("Provider Profile 标识格式无效")
}

func (s *Service) saveProfile(ctx context.Context, state domain.State, nextProfile domain.Profile) error {
	group := state.Families[nextProfile.Family]
	for index, profile := range group.Profiles {
		if profile.ID == nextProfile.ID {
			group.Profiles[index] = nextProfile
			state.Families[nextProfile.Family] = group
			_, err := s.Save(ctx, state)
			return err
		}
	}

	return errors.New("Provider Profile 标识格式无效")
}

func seedState(defaultProvider string, env map[string]string) domain.State {
	return domain.State{
		Version:         1,
		DefaultProvider: defaultProvider,
		Families: map[string]domain.Family{
			"openai-compatible": {
				ID:              "openai-compatible",
				Label:           "OpenAI Compatible",
				Description:     "适用于兼容 OpenAI 模型接口的服务。",
				ActiveProfileID: "openai-compatible-default",
				Profiles: []domain.Profile{
					{
						ID:        "openai-compatible-default",
						Family:    "openai-compatible",
						Name:      "Default OpenAI",
						Enabled:   true,
						IsDefault: defaultProvider == "openai-compatible",
						Connection: map[string]string{
							"apiEndpoint": env["OPENAI_API_ENDPOINT"],
							"apiKey":      env["OPENAI_API_KEY"],
						},
						Settings: map[string]string{
							"model":           fallback(env["VITE_OPENAI_MODEL"], "gpt-4o-mini"),
							"disableThinking": "",
						},
						Capabilities: map[string]bool{
							"supportsModelDiscovery":        true,
							"supportsConnectionCheck":       true,
							"supportsManualModelManagement": true,
							"supportsThinkingToggle":        true,
						},
						Models: []domain.Model{},
						ModelDiscovery: domain.ModelDiscovery{
							SourceMode:             "auto",
							SupportsModelDiscovery: true,
							LastStatus:             "idle",
						},
						Health: domain.Health{
							Status:  "idle",
							Summary: "未检查",
						},
					},
				},
			},
			"claude-compatible": {
				ID:              "claude-compatible",
				Label:           "Claude Compatible",
				Description:     "适用于兼容 Anthropic 模型接口的服务。",
				ActiveProfileID: "claude-compatible-default",
				Profiles: []domain.Profile{
					{
						ID:        "claude-compatible-default",
						Family:    "claude-compatible",
						Name:      "Default Claude",
						Enabled:   true,
						IsDefault: defaultProvider == "claude-compatible",
						Connection: map[string]string{
							"apiEndpoint": env["CLAUDE_API_ENDPOINT"],
							"apiKey":      env["CLAUDE_API_KEY"],
						},
						Settings: map[string]string{
							"model": fallback(env["VITE_CLAUDE_MODEL"], "claude-3-5-sonnet-latest"),
						},
						Capabilities: map[string]bool{
							"supportsModelDiscovery":        false,
							"supportsConnectionCheck":       true,
							"supportsManualModelManagement": true,
							"supportsThinkingToggle":        false,
						},
						Models: []domain.Model{},
						ModelDiscovery: domain.ModelDiscovery{
							SourceMode:             "auto",
							SupportsModelDiscovery: false,
							LastStatus:             "idle",
						},
						Health: domain.Health{
							Status:  "idle",
							Summary: "未检查",
						},
					},
				},
			},
			"baidu": {
				ID:              "baidu",
				Label:           "Baidu",
				Description:     "百度大模型翻译服务。",
				ActiveProfileID: "baidu-default",
				Profiles: []domain.Profile{
					{
						ID:        "baidu-default",
						Family:    "baidu",
						Name:      "Default Baidu",
						Enabled:   true,
						IsDefault: defaultProvider == "baidu",
						Connection: map[string]string{
							"apiEndpoint": env["BAIDU_API_ENDPOINT"],
							"appId":       env["BAIDU_APP_ID"],
							"apiKey":      env["BAIDU_API_KEY"],
							"secretKey":   env["BAIDU_SECRET_KEY"],
						},
						Settings: map[string]string{
							"modelType":                "llm",
							"reference":                "",
							"punctuationPreprocessing": "",
						},
						Capabilities: map[string]bool{
							"supportsModelDiscovery":        false,
							"supportsConnectionCheck":       true,
							"supportsManualModelManagement": true,
							"supportsThinkingToggle":        false,
						},
						Models: []domain.Model{},
						ModelDiscovery: domain.ModelDiscovery{
							SourceMode:             "auto",
							SupportsModelDiscovery: false,
							LastStatus:             "idle",
						},
						Health: domain.Health{
							Status:  "idle",
							Summary: "未检查",
						},
					},
				},
			},
		},
	}
}

func fallback(value string, fallbackValue string) string {
	if value == "" {
		return fallbackValue
	}

	return value
}
