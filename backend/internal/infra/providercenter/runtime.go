package providercenterinfra

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	appprovidercenter "srt-translate/internal/app/providercenter"
	domainprovider "srt-translate/internal/domain/providercenter"
)

type HealthChecker struct{}

func (HealthChecker) Check(_ context.Context, profile domainprovider.Profile) (appprovidercenter.HealthCheckResult, error) {
	if profile.Family == "openai-compatible" || profile.Family == "claude-compatible" {
		if profile.Connection["apiEndpoint"] == "" || profile.Connection["apiKey"] == "" {
			return appprovidercenter.HealthCheckResult{
				Status:  "warning",
				Summary: "缺少 endpoint 或 API Key",
			}, nil
		}
		return appprovidercenter.HealthCheckResult{
			Status:  "success",
			Summary: "连接配置有效，可继续进行模型检查或翻译",
		}, nil
	}

	if profile.Family == "baidu" {
		if profile.Connection["apiEndpoint"] == "" || profile.Connection["appId"] == "" || profile.Connection["apiKey"] == "" || profile.Connection["secretKey"] == "" {
			return appprovidercenter.HealthCheckResult{
				Status:  "warning",
				Summary: "百度配置未完成",
			}, nil
		}
		return appprovidercenter.HealthCheckResult{
			Status:  "success",
			Summary: "百度配置有效，可发起翻译",
		}, nil
	}

	errText := "unknown-provider"
	return appprovidercenter.HealthCheckResult{
		Status:  "failed",
		Summary: "未知 provider",
		Error:   &errText,
	}, nil
}

type ModelDiscoverer struct {
	Client *http.Client
}

func (d ModelDiscoverer) Discover(ctx context.Context, profile domainprovider.Profile) (appprovidercenter.ModelDiscoveryResult, error) {
	if !profile.Capabilities["supportsModelDiscovery"] {
		return appprovidercenter.ModelDiscoveryResult{
			Models:                 profile.Models,
			Summary:                "当前 provider 仅支持手动模型管理",
			SupportsModelDiscovery: false,
		}, nil
	}

	if profile.Family != "openai-compatible" {
		return appprovidercenter.ModelDiscoveryResult{
			Models:                 profile.Models,
			Summary:                "当前 provider 不支持自动发现模型",
			SupportsModelDiscovery: false,
		}, nil
	}

	endpoint := normalizeOpenAIEndpoint(profile.Connection["apiEndpoint"], profile.Settings["providerLabel"])
	if endpoint == "" || profile.Connection["apiKey"] == "" {
		return appprovidercenter.ModelDiscoveryResult{}, errors.New("模型发现失败 400")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"/models", nil)
	if err != nil {
		return appprovidercenter.ModelDiscoveryResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+profile.Connection["apiKey"])

	client := d.Client
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return appprovidercenter.ModelDiscoveryResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return appprovidercenter.ModelDiscoveryResult{}, errors.New("模型发现失败 " + strconv.Itoa(resp.StatusCode))
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return appprovidercenter.ModelDiscoveryResult{}, err
	}

	models := make([]domainprovider.Model, 0, len(payload.Data))
	for _, item := range payload.Data {
		if item.ID == "" {
			continue
		}
		models = append(models, domainprovider.Model{
			ID:      item.ID,
			Label:   item.ID,
			Enabled: true,
			Source:  "auto",
		})
	}

	return appprovidercenter.ModelDiscoveryResult{
		Models:                 models,
		Summary:                "发现 " + strconv.Itoa(len(models)) + " 个模型",
		SupportsModelDiscovery: true,
	}, nil
}

func normalizeOpenAIEndpoint(endpoint string, providerLabel string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if trimmed == "" {
		return trimmed
	}
	if providerLabel == "New API" && !strings.HasSuffix(trimmed, "/v1") && !strings.HasSuffix(trimmed, "/v2") {
		return trimmed + "/v1"
	}
	return trimmed
}
