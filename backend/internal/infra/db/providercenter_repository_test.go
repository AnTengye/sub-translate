package db_test

import (
	"context"
	"testing"

	"srt-translate/internal/domain/providercenter"
	"srt-translate/internal/infra/db"
)

func TestProviderCenterRepositorySaveAndRead(t *testing.T) {
	t.Parallel()

	repository, cleanup := newRepository(t)
	defer cleanup()

	expected := providercenter.State{
		Version:         1,
		DefaultProvider: "openai-compatible",
		Families: map[string]providercenter.Family{
			"openai-compatible": {
				ID:              "openai-compatible",
				Label:           "OpenAI Compatible",
				Description:     "desc",
				ActiveProfileID: "profile-1",
				Profiles: []providercenter.Profile{
					{
						ID:        "profile-1",
						Family:    "openai-compatible",
						Name:      "Default OpenAI",
						Enabled:   true,
						IsDefault: true,
						Connection: map[string]string{
							"apiEndpoint": "https://api.example.com/v1",
							"apiKey":      "secret",
						},
						Settings: map[string]string{
							"model": "gpt-4o-mini",
						},
						Capabilities: map[string]bool{
							"supportsModelDiscovery": true,
						},
						Models: []providercenter.Model{
							{
								ID:      "model-1",
								Label:   "gpt-4o-mini",
								Enabled: true,
								Source:  "manual",
							},
						},
						ModelDiscovery: providercenter.ModelDiscovery{
							SourceMode:             "auto",
							SupportsModelDiscovery: true,
							LastStatus:             "idle",
						},
						Health: providercenter.Health{
							Status:  "idle",
							Summary: "未检查",
						},
					},
				},
			},
		},
	}

	if err := repository.Save(context.Background(), expected); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	actual, err := repository.Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if actual.DefaultProvider != expected.DefaultProvider {
		t.Fatalf("expected default provider %q, got %q", expected.DefaultProvider, actual.DefaultProvider)
	}

	family := actual.Families["openai-compatible"]
	if family.ActiveProfileID != "profile-1" {
		t.Fatalf("expected active profile profile-1, got %q", family.ActiveProfileID)
	}

	if len(family.Profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(family.Profiles))
	}

	if family.Profiles[0].Connection["apiEndpoint"] != "https://api.example.com/v1" {
		t.Fatalf("expected saved apiEndpoint, got %q", family.Profiles[0].Connection["apiEndpoint"])
	}

	if len(family.Profiles[0].Models) != 1 || family.Profiles[0].Models[0].ID != "model-1" {
		t.Fatalf("expected saved model, got %#v", family.Profiles[0].Models)
	}
}

func newRepository(t *testing.T) (*db.ProviderCenterRepository, func()) {
	t.Helper()

	sqlDB, cleanup, err := db.OpenSQLiteForTest(t.TempDir())
	if err != nil {
		t.Fatalf("OpenSQLiteForTest() error = %v", err)
	}

	repository, err := db.NewProviderCenterRepository(sqlDB)
	if err != nil {
		cleanup()
		t.Fatalf("NewProviderCenterRepository() error = %v", err)
	}

	return repository, cleanup
}
