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
