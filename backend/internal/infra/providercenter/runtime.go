package providercenterinfra

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	appprovidercenter "srt-translate/internal/app/providercenter"
	domainprovider "srt-translate/internal/domain/providercenter"
)

type HealthChecker struct {
	Client *http.Client
}

func (h HealthChecker) Check(ctx context.Context, profile domainprovider.Profile) (appprovidercenter.HealthCheckResult, error) {
	if profile.Family == "openai-compatible" || profile.Family == "claude-compatible" || profile.Family == "google" {
		if profile.Connection["apiEndpoint"] == "" || profile.Connection["apiKey"] == "" {
			return appprovidercenter.HealthCheckResult{
				Status:  "warning",
				Summary: "缺少 endpoint 或 API Key",
			}, nil
		}

		models, err := fetchDiscoveredModels(ctx, h.Client, profile)
		if err != nil {
			errText := err.Error()
			return appprovidercenter.HealthCheckResult{
				Status:  "failed",
				Summary: "模型路由 /models 不可用",
				Error:   &errText,
			}, nil
		}

		return appprovidercenter.HealthCheckResult{
			Status:  "success",
			Summary: "模型路由 /models 可用，发现 " + strconv.Itoa(len(models)) + " 个模型",
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

type ModelVerifier struct {
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

	if profile.Family != "openai-compatible" && profile.Family != "google" {
		return appprovidercenter.ModelDiscoveryResult{
			Models:                 profile.Models,
			Summary:                "当前 provider 不支持自动发现模型",
			SupportsModelDiscovery: false,
		}, nil
	}

	if profile.Connection["apiKey"] == "" {
		return appprovidercenter.ModelDiscoveryResult{}, errors.New("模型发现失败 400")
	}

	models, err := fetchDiscoveredModels(ctx, d.Client, profile)
	if err != nil {
		return appprovidercenter.ModelDiscoveryResult{}, err
	}

	return appprovidercenter.ModelDiscoveryResult{
		Models:                 models,
		Summary:                "发现 " + strconv.Itoa(len(models)) + " 个模型",
		SupportsModelDiscovery: true,
	}, nil
}

func (v ModelVerifier) CheckModel(
	ctx context.Context,
	profile domainprovider.Profile,
	modelID string,
) (appprovidercenter.ModelCheckResult, error) {
	request, err := buildModelCheckRequest(profile, modelID)
	if err != nil {
		errText := err.Error()
		return appprovidercenter.ModelCheckResult{
			Status:  "error",
			Summary: "模型探测配置不完整",
			Error:   &errText,
		}, nil
	}

	httpClient := clientOrDefault(v.Client)
	resp, body, err := doModelCheckRequest(ctx, httpClient, request)
	if err != nil {
		errText := err.Error()
		return appprovidercenter.ModelCheckResult{
			Status:  "error",
			Summary: "模型探测请求失败",
			Error:   &errText,
		}, nil
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errText := extractUpstreamError(body)
		if errText == "" {
			errText = strings.TrimSpace(string(body))
		}
		if errText == "" {
			errText = resp.Status
		}
		return appprovidercenter.ModelCheckResult{
			Status:  "unavailable",
			Summary: fmt.Sprintf("模型 %s 当前不可用", modelID),
			Error:   &errText,
		}, nil
	}

	return appprovidercenter.ModelCheckResult{
		Status:  "available",
		Summary: fmt.Sprintf("模型 %s 可用", modelID),
	}, nil
}

func fetchDiscoveredModels(ctx context.Context, client *http.Client, profile domainprovider.Profile) ([]domainprovider.Model, error) {
	reqURL, headers, err := buildModelDiscoveryRequest(profile)
	if err != nil {
		return nil, errors.New("模型发现失败 400")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	httpClient := client
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errors.New("模型发现失败 " + strconv.Itoa(resp.StatusCode))
	}

	models, err := decodeDiscoveredModels(resp.Body, profile.Family)
	if err != nil {
		return nil, err
	}
	return models, nil
}

type modelCheckRequest struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    any
}

func buildModelCheckRequest(profile domainprovider.Profile, modelID string) (modelCheckRequest, error) {
	switch profile.Family {
	case "openai-compatible":
		endpoint := normalizeOpenAIEndpoint(strings.TrimSpace(profile.Connection["apiEndpoint"]), profile.Settings["providerLabel"])
		apiKey := strings.TrimSpace(profile.Connection["apiKey"])
		if endpoint == "" || apiKey == "" {
			return modelCheckRequest{}, errors.New("missing endpoint or api key")
		}
		return modelCheckRequest{
			Method: http.MethodPost,
			URL:    strings.TrimRight(endpoint, "/") + "/chat/completions",
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer " + apiKey,
			},
			Body: map[string]any{
				"model":       modelID,
				"temperature": 0,
				"max_tokens":  1,
				"messages": []map[string]string{
					{"role": "user", "content": "ping"},
				},
			},
		}, nil
	case "claude-compatible":
		endpoint := strings.TrimRight(strings.TrimSpace(profile.Connection["apiEndpoint"]), "/")
		apiKey := strings.TrimSpace(profile.Connection["apiKey"])
		if endpoint == "" || apiKey == "" {
			return modelCheckRequest{}, errors.New("missing endpoint or api key")
		}
		return modelCheckRequest{
			Method: http.MethodPost,
			URL:    endpoint + "/messages",
			Headers: map[string]string{
				"Content-Type":      "application/json",
				"x-api-key":         apiKey,
				"anthropic-version": "2023-06-01",
			},
			Body: map[string]any{
				"model":      modelID,
				"max_tokens": 1,
				"messages": []map[string]string{
					{"role": "user", "content": "ping"},
				},
			},
		}, nil
	case "google":
		endpoint := strings.TrimRight(strings.TrimSpace(profile.Connection["apiEndpoint"]), "/")
		if endpoint == "" {
			endpoint = "https://generativelanguage.googleapis.com/v1beta"
		}
		apiKey := strings.TrimSpace(profile.Connection["apiKey"])
		if apiKey == "" {
			return modelCheckRequest{}, errors.New("missing api key")
		}
		return modelCheckRequest{
			Method: http.MethodPost,
			URL:    endpoint + "/" + strings.TrimPrefix(modelID, "/") + ":generateContent?key=" + url.QueryEscape(apiKey),
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: map[string]any{
				"contents": []map[string]any{
					{
						"role": "user",
						"parts": []map[string]string{
							{"text": "ping"},
						},
					},
				},
				"generationConfig": map[string]any{
					"temperature":     0,
					"maxOutputTokens": 1,
				},
			},
		}, nil
	case "baidu":
		endpoint := strings.TrimSpace(profile.Connection["apiEndpoint"])
		appID := strings.TrimSpace(profile.Connection["appId"])
		apiKey := strings.TrimSpace(profile.Connection["apiKey"])
		secretKey := strings.TrimSpace(profile.Connection["secretKey"])
		if endpoint == "" || appID == "" || (apiKey == "" && secretKey == "") {
			return modelCheckRequest{}, errors.New("missing baidu credentials")
		}
		payload := map[string]any{
			"appid": appID,
			"from":  "jp",
			"to":    "zh",
			"q":     "ping",
		}
		if modelID != "" {
			payload["model_type"] = modelID
		}
		headers := map[string]string{"Content-Type": "application/json"}
		if apiKey != "" {
			headers["Authorization"] = "Bearer " + apiKey
		} else {
			salt := strconv.FormatInt(time.Now().UnixMilli(), 10)
			payload["salt"] = salt
			payload["sign"] = md5Hex(appID + "ping" + salt + secretKey)
		}
		return modelCheckRequest{
			Method:  http.MethodPost,
			URL:     endpoint,
			Headers: headers,
			Body:    payload,
		}, nil
	default:
		return modelCheckRequest{}, errors.New("unsupported provider")
	}
}

func doModelCheckRequest(ctx context.Context, client *http.Client, request modelCheckRequest) (*http.Response, []byte, error) {
	var body io.Reader
	if request.Body != nil {
		raw, err := json.Marshal(request.Body)
		if err != nil {
			return nil, nil, err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, request.Method, request.URL, body)
	if err != nil {
		return nil, nil, err
	}
	for key, value := range request.Headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}
	return resp, rawBody, nil
}

func clientOrDefault(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	return &http.Client{Timeout: 30 * time.Second}
}

func extractUpstreamError(body []byte) string {
	var payload struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err == nil && payload.Error.Message != "" {
		return payload.Error.Message
	}
	return ""
}

func md5Hex(value string) string {
	sum := md5.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

func buildModelDiscoveryRequest(profile domainprovider.Profile) (string, map[string]string, error) {
	endpoint := strings.TrimRight(strings.TrimSpace(profile.Connection["apiEndpoint"]), "/")
	headers := map[string]string{}

	switch profile.Family {
	case "openai-compatible":
		endpoint = normalizeOpenAIEndpoint(endpoint, profile.Settings["providerLabel"])
		if endpoint == "" {
			return "", nil, errors.New("missing endpoint")
		}
		headers["Authorization"] = "Bearer " + profile.Connection["apiKey"]
		return endpoint + "/models", headers, nil
	case "claude-compatible":
		if endpoint == "" {
			return "", nil, errors.New("missing endpoint")
		}
		headers["x-api-key"] = profile.Connection["apiKey"]
		headers["anthropic-version"] = "2023-06-01"
		return endpoint + "/models", headers, nil
	case "google":
		if endpoint == "" {
			endpoint = "https://generativelanguage.googleapis.com/v1beta"
		}
		return endpoint + "/models?key=" + profile.Connection["apiKey"], headers, nil
	default:
		if endpoint == "" {
			return "", nil, errors.New("missing endpoint")
		}
		return endpoint + "/models", headers, nil
	}
}

func decodeDiscoveredModels(body io.Reader, family string) ([]domainprovider.Model, error) {
	if family == "google" {
		var payload struct {
			Models []struct {
				Name string `json:"name"`
			} `json:"models"`
		}
		if err := json.NewDecoder(body).Decode(&payload); err != nil {
			return nil, err
		}
		models := make([]domainprovider.Model, 0, len(payload.Models))
		for _, item := range payload.Models {
			if item.Name == "" {
				continue
			}
			models = append(models, domainprovider.Model{
				ID:      item.Name,
				Label:   item.Name,
				Enabled: true,
				Source:  "auto",
			})
		}
		return models, nil
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		return nil, err
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
	return models, nil
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
