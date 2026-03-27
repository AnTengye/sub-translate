package providercenter_test

import (
	"context"
	"testing"

	"srt-translate/internal/app/providercenter"
	domainprovider "srt-translate/internal/domain/providercenter"
)

func TestReadSeedsDefaultProviderCenterState(t *testing.T) {
	t.Parallel()

	service := providercenter.NewService(providercenter.Dependencies{
		DefaultProvider: "openai-compatible",
		Env: map[string]string{
			"OPENAI_API_ENDPOINT": "https://api.example.com/v1",
			"OPENAI_API_KEY":      "openai-key",
			"VITE_OPENAI_MODEL":   "gpt-4o-mini",
		},
	})

	state, err := service.Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	family, ok := state.Families["openai-compatible"]
	if !ok {
		t.Fatalf("expected openai-compatible family to exist")
	}

	if family.ID != "openai-compatible" {
		t.Fatalf("expected family id openai-compatible, got %q", family.ID)
	}

	if len(family.Profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(family.Profiles))
	}

	if family.Profiles[0].Connection["apiEndpoint"] != "https://api.example.com/v1" {
		t.Fatalf("expected env endpoint to seed profile, got %q", family.Profiles[0].Connection["apiEndpoint"])
	}
}

type stubRepository struct {
	state domainprovider.State
}

func (s *stubRepository) Read(context.Context) (domainprovider.State, error) {
	return s.state, nil
}

func (s *stubRepository) Save(_ context.Context, state domainprovider.State) error {
	s.state = state
	return nil
}

type stubHealthChecker struct {
	status  string
	summary string
	errText string
}

func (s stubHealthChecker) Check(context.Context, domainprovider.Profile) (providercenter.HealthCheckResult, error) {
	result := providercenter.HealthCheckResult{
		Status:  s.status,
		Summary: s.summary,
	}
	if s.errText != "" {
		result.Error = &s.errText
	}
	return result, nil
}

type stubModelDiscoverer struct {
	models                 []domainprovider.Model
	summary                string
	supportsModelDiscovery bool
}

func (s stubModelDiscoverer) Discover(context.Context, domainprovider.Profile) (providercenter.ModelDiscoveryResult, error) {
	return providercenter.ModelDiscoveryResult{
		Models:                 s.models,
		Summary:                s.summary,
		SupportsModelDiscovery: s.supportsModelDiscovery,
	}, nil
}

func TestSavePersistsProviderCenterState(t *testing.T) {
	t.Parallel()

	repository := &stubRepository{}
	service := providercenter.NewService(providercenter.Dependencies{
		DefaultProvider: "openai-compatible",
		Repository:      repository,
	})

	input := domainprovider.State{
		Version:         1,
		DefaultProvider: "baidu",
		Families: map[string]domainprovider.Family{
			"baidu": {
				ID:              "baidu",
				Label:           "Baidu",
				Description:     "百度",
				ActiveProfileID: "baidu-default",
				Profiles: []domainprovider.Profile{
					{
						ID:        "baidu-default",
						Family:    "baidu",
						Name:      "Default Baidu",
						Enabled:   true,
						IsDefault: true,
						Connection: map[string]string{
							"appId": "app-id",
						},
						Settings:       map[string]string{},
						Capabilities:   map[string]bool{},
						Models:         []domainprovider.Model{},
						ModelDiscovery: domainprovider.ModelDiscovery{},
						Health:         domainprovider.Health{},
					},
				},
			},
		},
	}

	saved, err := service.Save(context.Background(), input)
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	if saved.DefaultProvider != "baidu" {
		t.Fatalf("expected saved default provider baidu, got %q", saved.DefaultProvider)
	}

	if repository.state.DefaultProvider != "baidu" {
		t.Fatalf("expected repository save to persist baidu, got %q", repository.state.DefaultProvider)
	}
}

func TestDiscoverModelsKeepsSavedModelsAndExposesAvailableModels(t *testing.T) {
	t.Parallel()

	repository := &stubRepository{
		state: domainprovider.State{
			Version:         1,
			DefaultProvider: "openai-compatible",
			Families: map[string]domainprovider.Family{
				"openai-compatible": {
					ID:              "openai-compatible",
					Label:           "OpenAI Compatible",
					Description:     "desc",
					ActiveProfileID: "profile-1",
					Profiles: []domainprovider.Profile{
						{
							ID:        "profile-1",
							Family:    "openai-compatible",
							Name:      "Default OpenAI",
							Enabled:   true,
							IsDefault: true,
							Connection: map[string]string{
								"apiEndpoint": "https://api.example.com/v1",
								"apiKey":      "key",
							},
							Settings:     map[string]string{"model": "gpt-4o-mini"},
							Capabilities: map[string]bool{"supportsModelDiscovery": true},
							Models: []domainprovider.Model{
								{ID: "gpt-4o-mini", Label: "gpt-4o-mini", Enabled: true, Source: "manual"},
							},
							ModelDiscovery: domainprovider.ModelDiscovery{
								SourceMode:             "auto",
								SupportsModelDiscovery: true,
								LastStatus:             "idle",
							},
							Health: domainprovider.Health{
								Status:  "idle",
								Summary: "未检查",
							},
						},
					},
				},
			},
		},
	}

	service := providercenter.NewService(providercenter.Dependencies{
		DefaultProvider: "openai-compatible",
		Repository:      repository,
		ModelDiscoverer: stubModelDiscoverer{
			models: []domainprovider.Model{
				{ID: "gpt-4.1-mini", Label: "gpt-4.1-mini", Enabled: true, Source: "auto"},
			},
			summary:                "发现 1 个模型",
			supportsModelDiscovery: true,
		},
	})

	_, result, err := service.DiscoverModels(context.Background(), "openai-compatible", "profile-1")
	if err != nil {
		t.Fatalf("DiscoverModels() error = %v", err)
	}

	if len(result.Models) != 1 || result.Models[0].ID != "gpt-4.1-mini" {
		t.Fatalf("expected discovered models, got %#v", result.Models)
	}

	profile := repository.state.Families["openai-compatible"].Profiles[0]
	if len(profile.Models) != 1 || profile.Models[0].ID != "gpt-4o-mini" {
		t.Fatalf("expected saved models to remain unchanged, got %#v", profile.Models)
	}

	if len(profile.AvailableModels) != 1 || profile.AvailableModels[0].ID != "gpt-4.1-mini" {
		t.Fatalf("expected available models to be updated, got %#v", profile.AvailableModels)
	}
}
