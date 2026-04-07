package translate_test

import (
	"context"
	"testing"

	apptranslate "srt-translate/internal/app/translate"
	domainprovider "srt-translate/internal/domain/providercenter"
)

type fakeTranslator struct {
	request apptranslate.Request
	result  apptranslate.Result
}

func (f *fakeTranslator) Translate(_ context.Context, request apptranslate.Request) (apptranslate.Result, error) {
	f.request = request
	return f.result, nil
}

type fakeProviderCenterReader struct {
	state domainprovider.State
}

func (f fakeProviderCenterReader) Read(_ context.Context) (domainprovider.State, error) {
	return f.state, nil
}

type fakeRateLimiter struct {
	key string
	rpm int
	rpd int
}

func (f *fakeRateLimiter) Wait(_ context.Context, key string, rpm int, rpd int) error {
	f.key = key
	f.rpm = rpm
	f.rpd = rpd
	return nil
}

func TestTranslateUsesSavedProfileAndRequestOverrides(t *testing.T) {
	t.Parallel()

	translator := &fakeTranslator{
		result: apptranslate.Result{Translations: []string{"你好"}},
	}
	service := apptranslate.NewService(apptranslate.Dependencies{
		ProviderCenterReader: fakeProviderCenterReader{
			state: domainprovider.State{
				Families: map[string]domainprovider.Family{
					"openai-compatible": {
						ID:              "openai-compatible",
						ActiveProfileID: "profile-1",
						Profiles: []domainprovider.Profile{
							{
								ID:     "profile-1",
								Family: "openai-compatible",
								Connection: map[string]string{
									"apiEndpoint": "https://server-openai.example/v1",
									"apiKey":      "server-key",
								},
								Settings: map[string]string{
									"model":           "server-model",
									"disableThinking": "true",
								},
							},
						},
					},
				},
			},
		},
		OpenAICompatibleTranslator: translator,
	})

	result, err := service.Translate(context.Background(), "openai-compatible", apptranslate.TranslateInput{
		ProfileID: "profile-1",
		Texts:     []string{"こんにちは"},
		Options: map[string]any{
			"temperature": 0.2,
		},
	})
	if err != nil {
		t.Fatalf("Translate() error = %v", err)
	}

	if len(result.Translations) != 1 || result.Translations[0] != "你好" {
		t.Fatalf("unexpected translations %#v", result.Translations)
	}

	if translator.request.Options["model"] != "server-model" {
		t.Fatalf("expected saved model to be merged, got %#v", translator.request.Options["model"])
	}

	if translator.request.RuntimeOverrides["apiEndpoint"] != "https://server-openai.example/v1" {
		t.Fatalf("expected saved endpoint override, got %#v", translator.request.RuntimeOverrides["apiEndpoint"])
	}
}

func TestTranslateUsesGoogleProfileAndTranslator(t *testing.T) {
	t.Parallel()

	translator := &fakeTranslator{
		result: apptranslate.Result{Translations: []string{"你好"}},
	}
	service := apptranslate.NewService(apptranslate.Dependencies{
		ProviderCenterReader: fakeProviderCenterReader{
			state: domainprovider.State{
				Families: map[string]domainprovider.Family{
					"google": {
						ID:              "google",
						ActiveProfileID: "google-profile",
						Profiles: []domainprovider.Profile{
							{
								ID:     "google-profile",
								Family: "google",
								Connection: map[string]string{
									"apiEndpoint": "https://generativelanguage.googleapis.com/v1beta",
									"apiKey":      "google-key",
								},
								Settings: map[string]string{
									"model":           "models/gemini-2.5-flash",
									"disableThinking": "true",
								},
							},
						},
					},
				},
			},
		},
		GoogleTranslator: translator,
	})

	_, err := service.Translate(context.Background(), "google", apptranslate.TranslateInput{
		ProfileID: "google-profile",
		Texts:     []string{"こんにちは"},
	})
	if err != nil {
		t.Fatalf("Translate() error = %v", err)
	}

	if translator.request.Options["model"] != "models/gemini-2.5-flash" {
		t.Fatalf("expected google model to be merged, got %#v", translator.request.Options["model"])
	}
	if translator.request.Options["disableThinking"] != "true" {
		t.Fatalf("expected google disableThinking to be merged, got %#v", translator.request.Options["disableThinking"])
	}
	if translator.request.RuntimeOverrides["apiKey"] != "google-key" {
		t.Fatalf("expected google api key override, got %#v", translator.request.RuntimeOverrides["apiKey"])
	}
}

func TestTranslateFallsBackToProfileAndGlobalRateLimits(t *testing.T) {
	t.Parallel()

	translator := &fakeTranslator{
		result: apptranslate.Result{Translations: []string{"你好"}},
	}
	limiter := &fakeRateLimiter{}
	service := apptranslate.NewService(apptranslate.Dependencies{
		ProviderCenterReader: fakeProviderCenterReader{
			state: domainprovider.State{
				Limits: domainprovider.Limits{
					GlobalRpmLimit: 120,
					GlobalRpdLimit: 2400,
				},
				Families: map[string]domainprovider.Family{
					"openai-compatible": {
						ID:              "openai-compatible",
						ActiveProfileID: "profile-1",
						Profiles: []domainprovider.Profile{
							{
								ID:       "profile-1",
								Family:   "openai-compatible",
								RpmLimit: 60,
								Connection: map[string]string{
									"apiEndpoint": "https://server-openai.example/v1",
									"apiKey":      "server-key",
								},
								Settings: map[string]string{
									"model": "server-model",
								},
								Models: []domainprovider.Model{
									{ID: "server-model", Label: "server-model", Enabled: true, RpmLimit: 0, RpdLimit: 0},
								},
							},
						},
					},
				},
			},
		},
		RpmLimiter:                 limiter,
		OpenAICompatibleTranslator: translator,
	})

	_, err := service.Translate(context.Background(), "openai-compatible", apptranslate.TranslateInput{
		ProfileID: "profile-1",
		Texts:     []string{"こんにちは"},
		Options: map[string]any{
			"model": "server-model",
		},
	})
	if err != nil {
		t.Fatalf("Translate() error = %v", err)
	}

	if limiter.key != "profile-1:server-model" {
		t.Fatalf("expected limiter key profile-1:server-model, got %q", limiter.key)
	}
	if limiter.rpm != 60 {
		t.Fatalf("expected profile rpm fallback 60, got %d", limiter.rpm)
	}
	if limiter.rpd != 2400 {
		t.Fatalf("expected global rpd fallback 2400, got %d", limiter.rpd)
	}
}
