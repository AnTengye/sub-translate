package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	appprovidercenter "srt-translate/internal/app/providercenter"
	"srt-translate/internal/app/providerdefaults"
	apptranslate "srt-translate/internal/app/translate"
	"srt-translate/internal/infra/db"
	"srt-translate/internal/infra/logging"
	providercenterinfra "srt-translate/internal/infra/providercenter"
	"srt-translate/internal/infra/providers"
	"srt-translate/internal/infra/static"
	"srt-translate/internal/platform/config"
	"srt-translate/internal/platform/id"
	httpserver "srt-translate/internal/transport/http"
)

type translationRunLoggerAdapter struct {
	logger *logging.TranslationRunLogger
	idGen  *id.Snowflake
}

func (a translationRunLoggerAdapter) CreateRun(ctx context.Context, payload httpserver.CreateRunPayload) (string, string, error) {
	runID := payload.RunID
	if runID == "" {
		runID = a.idGen.NextString()
	}
	return a.logger.CreateRun(ctx, logging.CreateRunPayload{
		RunID: runID,
		Request: map[string]any{
			"runId":             runID,
			"fileName":          payload.FileName,
			"provider":          payload.Provider,
			"totalEntries":      payload.TotalEntries,
			"entries":           payload.Entries,
			"providerConfig":    payload.ProviderConfig,
			"translationConfig": payload.TranslationConfig,
			"mode":              payload.Mode,
		},
	})
}

func (a translationRunLoggerAdapter) AppendBatch(ctx context.Context, runID string, payload map[string]any) error {
	return a.logger.AppendBatch(ctx, runID, payload)
}

func (a translationRunLoggerAdapter) FinalizeRun(ctx context.Context, runID string, payload httpserver.FinalizeRunPayload) error {
	return a.logger.FinalizeRun(ctx, runID, logging.FinalizeRunPayload{
		Status:  payload.Status,
		Summary: payload.Summary,
		Error:   payload.Error,
	})
}

func main() {
	cfg := config.LoadFromEnv()
	if err := os.MkdirAll(filepath.Dir(cfg.DatabasePath), 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(cfg.LogDir, 0o755); err != nil {
		log.Fatal(err)
	}

	gormDB, err := gorm.Open(sqlite.Open(cfg.DatabasePath), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	repository, err := db.NewProviderCenterRepository(gormDB)
	if err != nil {
		log.Fatal(err)
	}

	httpClient := &http.Client{
		Timeout: cfg.ProviderRequestTimeout,
		Transport: &http.Transport{
			MaxIdleConns:        20,
			MaxIdleConnsPerHost: 10,
			MaxConnsPerHost:     10,
		},
	}

	providerCenterService := appprovidercenter.NewService(appprovidercenter.Dependencies{
		DefaultProvider: cfg.Env["VITE_DEFAULT_PROVIDER"],
		Env:             cfg.Env,
		Repository:      repository,
		HealthChecker:   providercenterinfra.HealthChecker{},
		ModelDiscoverer: providercenterinfra.ModelDiscoverer{Client: httpClient},
	})

	translateService := apptranslate.NewService(apptranslate.Dependencies{
		ProviderCenterReader: providerCenterService,
		OpenAICompatibleTranslator: providers.OpenAICompatibleTranslator{
			Client:          httpClient,
			DefaultEndpoint: firstNonEmpty(cfg.Env["OPENAI_API_ENDPOINT"], "https://api.openai.com/v1"),
			DefaultAPIKey:   cfg.Env["OPENAI_API_KEY"],
		},
		ClaudeCompatibleTranslator: providers.ClaudeCompatibleTranslator{
			Client:          httpClient,
			DefaultEndpoint: firstNonEmpty(cfg.Env["CLAUDE_API_ENDPOINT"], "https://api.anthropic.com/v1"),
			DefaultAPIKey:   cfg.Env["CLAUDE_API_KEY"],
		},
		BaiduTranslator: providers.BaiduTranslator{
			Client:           httpClient,
			DefaultEndpoint:  firstNonEmpty(cfg.Env["BAIDU_API_ENDPOINT"], "https://fanyi-api.baidu.com/ait/api/aiTextTranslate"),
			DefaultAppID:     cfg.Env["BAIDU_APP_ID"],
			DefaultAPIKey:    cfg.Env["BAIDU_API_KEY"],
			DefaultSecretKey: cfg.Env["BAIDU_SECRET_KEY"],
		},
		MaxConcurrency: cfg.TranslateMaxConcurrency,
	})

	handler := httpserver.NewServer(httpserver.Dependencies{
		StaticFileHandler:      static.SPAHandler{DistDir: cfg.DistDir},
		ProviderDefaultsReader: providerdefaults.NewService(cfg.Env),
		ProviderCenterService:  providerCenterService,
		TranslateService:       translateService,
		TranslationRunLogger: translationRunLoggerAdapter{
			logger: logging.NewTranslationRunLogger(logging.TranslationRunLoggerDependencies{
				LogDir: cfg.LogDir,
			}),
			idGen: id.NewSnowflake(resolveNodeID()),
		},
	})

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	log.Printf("SRT Translate listening on http://localhost:%s", cfg.Port)
	log.Fatal(server.ListenAndServe())
}

func resolveNodeID() int64 {
	addrs, err := net.InterfaceAddrs()
	if err != nil || len(addrs) == 0 {
		return 1
	}
	return int64(len(addrs))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
