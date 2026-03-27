package providerdefaults

import "context"

type Service struct {
	env map[string]string
}

func NewService(env map[string]string) Service {
	return Service{env: env}
}

func (s Service) ReadProviderDefaults(context.Context) map[string]any {
	defaultProvider := s.env["VITE_DEFAULT_PROVIDER"]
	switch defaultProvider {
	case "openai-compatible", "claude-compatible", "baidu":
	default:
		defaultProvider = "openai-compatible"
	}

	return map[string]any{
		"defaultProvider": defaultProvider,
		"providers": map[string]any{
			"openai-compatible": map[string]any{
				"profileName":     "Default OpenAI",
				"apiEndpoint":     s.env["OPENAI_API_ENDPOINT"],
				"apiKey":          s.env["OPENAI_API_KEY"],
				"model":           fallback(s.env["VITE_OPENAI_MODEL"], "gpt-4o-mini"),
				"disableThinking": "",
			},
			"claude-compatible": map[string]any{
				"profileName": "Default Claude",
				"apiEndpoint": s.env["CLAUDE_API_ENDPOINT"],
				"apiKey":      s.env["CLAUDE_API_KEY"],
				"model":       fallback(s.env["VITE_CLAUDE_MODEL"], "claude-3-5-sonnet-latest"),
			},
			"baidu": map[string]any{
				"profileName":              "Default Baidu",
				"apiEndpoint":              s.env["BAIDU_API_ENDPOINT"],
				"appId":                    s.env["BAIDU_APP_ID"],
				"apiKey":                   s.env["BAIDU_API_KEY"],
				"secretKey":                s.env["BAIDU_SECRET_KEY"],
				"modelType":                "llm",
				"reference":                "",
				"punctuationPreprocessing": "",
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
