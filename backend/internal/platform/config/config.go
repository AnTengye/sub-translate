package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                    string
	DistDir                 string
	DatabasePath            string
	LogDir                  string
	TranslateMaxConcurrency int
	ProviderRequestTimeout  time.Duration
	ReadTimeout             time.Duration
	WriteTimeout            time.Duration
	Env                     map[string]string
}

func LoadFromEnv() Config {
	env := map[string]string{
		"VITE_DEFAULT_PROVIDER": os.Getenv("VITE_DEFAULT_PROVIDER"),
		"VITE_OPENAI_MODEL":     os.Getenv("VITE_OPENAI_MODEL"),
		"VITE_CLAUDE_MODEL":     os.Getenv("VITE_CLAUDE_MODEL"),
		"OPENAI_API_ENDPOINT":   os.Getenv("OPENAI_API_ENDPOINT"),
		"OPENAI_API_KEY":        os.Getenv("OPENAI_API_KEY"),
		"CLAUDE_API_ENDPOINT":   os.Getenv("CLAUDE_API_ENDPOINT"),
		"CLAUDE_API_KEY":        os.Getenv("CLAUDE_API_KEY"),
		"BAIDU_API_ENDPOINT":    os.Getenv("BAIDU_API_ENDPOINT"),
		"BAIDU_APP_ID":          os.Getenv("BAIDU_APP_ID"),
		"BAIDU_API_KEY":         os.Getenv("BAIDU_API_KEY"),
		"BAIDU_SECRET_KEY":      os.Getenv("BAIDU_SECRET_KEY"),
	}

	return Config{
		Port:                    fallback(os.Getenv("PORT"), "3000"),
		DistDir:                 fallback(os.Getenv("DIST_DIR"), "frontend/dist"),
		DatabasePath:            fallback(os.Getenv("DATABASE_PATH"), "data/app.db"),
		LogDir:                  fallback(os.Getenv("LOG_DIR"), "logs/translations"),
		TranslateMaxConcurrency: parseInt(os.Getenv("TRANSLATE_MAX_CONCURRENCY"), 10),
		ProviderRequestTimeout:  parseDuration(os.Getenv("PROVIDER_REQUEST_TIMEOUT"), 90*time.Second),
		ReadTimeout:             parseDuration(os.Getenv("HTTP_READ_TIMEOUT"), 15*time.Second),
		WriteTimeout:            parseDuration(os.Getenv("HTTP_WRITE_TIMEOUT"), 120*time.Second),
		Env:                     env,
	}
}

func fallback(value string, fallbackValue string) string {
	if value == "" {
		return fallbackValue
	}
	return value
}

func parseInt(value string, fallbackValue int) int {
	if value == "" {
		return fallbackValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallbackValue
	}

	return parsed
}

func parseDuration(value string, fallbackValue time.Duration) time.Duration {
	if value == "" {
		return fallbackValue
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallbackValue
	}

	return parsed
}
