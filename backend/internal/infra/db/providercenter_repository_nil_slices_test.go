package db_test

import (
	"context"
	"testing"

	"srt-translate/internal/domain/providercenter"
)

func TestProviderCenterRepositoryReadReturnsEmptySlicesInsteadOfNil(t *testing.T) {
	t.Parallel()

	repository, cleanup := newRepository(t)
	defer cleanup()

	input := providercenter.State{
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
						ID:              "profile-1",
						Family:          "openai-compatible",
						Name:            "Default OpenAI",
						Enabled:         true,
						IsDefault:       true,
						Connection:      map[string]string{},
						Settings:        map[string]string{},
						Capabilities:    map[string]bool{},
						Models:          nil,
						AvailableModels: nil,
						ModelDiscovery:  providercenter.ModelDiscovery{},
						Health:          providercenter.Health{},
					},
				},
			},
		},
	}

	if err := repository.Save(context.Background(), input); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	actual, err := repository.Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	profile := actual.Families["openai-compatible"].Profiles[0]
	if profile.Models == nil {
		t.Fatal("expected Models to be empty slice, got nil")
	}
	if profile.AvailableModels == nil {
		t.Fatal("expected AvailableModels to be empty slice, got nil")
	}
}
