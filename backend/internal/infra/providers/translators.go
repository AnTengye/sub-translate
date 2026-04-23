package providers

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	apptranslate "srt-translate/internal/app/translate"
)

type OpenAICompatibleTranslator struct {
	Client          *http.Client
	DefaultEndpoint string
	DefaultAPIKey   string
}

type ClaudeCompatibleTranslator struct {
	Client          *http.Client
	DefaultEndpoint string
	DefaultAPIKey   string
}

type GoogleTranslator struct {
	Client          *http.Client
	DefaultEndpoint string
	DefaultAPIKey   string
}

type BaiduTranslator struct {
	Client           *http.Client
	DefaultEndpoint  string
	DefaultAppID     string
	DefaultAPIKey    string
	DefaultSecretKey string
	Now              func() int64
}

// ErrorCategory classifies upstream API errors for appropriate handling
type ErrorCategory string

const (
	ErrAuth          ErrorCategory = "auth"           // 403/401 - permission issues
	ErrRateLimit     ErrorCategory = "rate_limit"     // 429, cooling down
	ErrConcurrency   ErrorCategory = "concurrency"    // Too many concurrent requests
	ErrInvalidFormat ErrorCategory = "invalid_format" // JSON parse errors, unexpected format
	ErrServer        ErrorCategory = "server"         // 5xx errors
	ErrNetwork       ErrorCategory = "network"        // Connection issues, timeouts
	ErrInvalidResult ErrorCategory = "invalid_result" // HTTP 200 but 0 valid translations
)

// ClassifyError categorizes an error based on HTTP status code, response body, and error message
func ClassifyError(statusCode int, body string, err error) ErrorCategory {
	// Check status code first
	if statusCode == 403 || statusCode == 401 {
		return ErrAuth
	}
	if statusCode == 429 {
		return ErrRateLimit
	}
	if statusCode >= 500 {
		return ErrServer
	}

	// Check body content for specific error patterns
	bodyLower := strings.ToLower(body)
	if strings.Contains(bodyLower, "cooling down") {
		return ErrRateLimit
	}
	if strings.Contains(bodyLower, "too many concurrent") {
		return ErrConcurrency
	}
	if strings.Contains(bodyLower, "not assigned") || strings.Contains(bodyLower, "forbidden") {
		return ErrAuth
	}

	// Check error message for parsing issues
	if err != nil {
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "invalid character") || strings.Contains(errStr, "unexpected token") {
			return ErrInvalidFormat
		}
	}

	return ErrNetwork
}

func (t OpenAICompatibleTranslator) Translate(ctx context.Context, request apptranslate.Request) (apptranslate.Result, error) {
	endpoint := normalizeOpenAIEndpoint(stringValue(request.RuntimeOverrides["apiEndpoint"]), stringValue(request.RuntimeOverrides["providerLabel"]))
	if endpoint == "" {
		endpoint = normalizeOpenAIEndpoint(t.DefaultEndpoint, stringValue(request.RuntimeOverrides["providerLabel"]))
	}
	apiKey := firstNonEmpty(stringValue(request.RuntimeOverrides["apiKey"]), t.DefaultAPIKey)
	if apiKey == "" {
		return apptranslate.Result{}, errors.New("服务端未配置 OPENAI_API_KEY")
	}

	system, user, err := buildOperationMessages(request)
	if err != nil {
		return apptranslate.Result{}, err
	}
	model := firstNonEmpty(stringValue(request.Options["model"]), "gpt-4o-mini")
	defaultMaxTokens := 4096
	if request.Operation == "judge" {
		defaultMaxTokens = 8192
	}
	payload := map[string]any{
		"model":       model,
		"temperature": floatValue(request.Options["temperature"], 0.3),
		"max_tokens":  intValue(request.Options["maxTokens"], defaultMaxTokens),
		"stop":        []string{"<|endoftext|>", "<|im_start|>"},
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
	}
	for key, value := range buildThinkingOverride(model, stringValue(request.Options["disableThinking"])) {
		payload[key] = value
	}

	resp, rawBody, err := doJSONRequest(ctx, httpClient(t.Client), http.MethodPost, endpoint+"/chat/completions", map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + apiKey,
	}, payload)
	if err != nil {
		return apptranslate.Result{}, err
	}

	var body struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rawBody, &body); err != nil {
		return apptranslate.Result{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := body.Error.Message
		if message == "" {
			message = resp.Status
		}
		return apptranslate.Result{}, errors.New("API " + strconv.Itoa(resp.StatusCode) + ": " + message)
	}

	rawText := ""
	if len(body.Choices) > 0 {
		rawText = body.Choices[0].Message.Content
	}

	translations, metadata, err := parseOperationResponse(request, rawText)
	if err != nil {
		return apptranslate.Result{}, err
	}

	return apptranslate.Result{
		Translations: translations,
		Debug: map[string]any{
			"request": map[string]any{
				"endpoint": endpoint + "/chat/completions",
				"headers": map[string]any{
					"Content-Type":  "application/json",
					"Authorization": "Bearer [REDACTED]",
				},
				"payload": payload,
			},
			"response": map[string]any{
				"status":  resp.StatusCode,
				"rawText": rawText,
			},
		},
		Metadata: metadata,
	}, nil
}

func (t ClaudeCompatibleTranslator) Translate(ctx context.Context, request apptranslate.Request) (apptranslate.Result, error) {
	endpoint := strings.TrimRight(firstNonEmpty(stringValue(request.RuntimeOverrides["apiEndpoint"]), t.DefaultEndpoint), "/")
	apiKey := firstNonEmpty(stringValue(request.RuntimeOverrides["apiKey"]), t.DefaultAPIKey)
	if apiKey == "" {
		return apptranslate.Result{}, errors.New("服务端未配置 CLAUDE_API_KEY")
	}

	system, user, err := buildOperationMessages(request)
	if err != nil {
		return apptranslate.Result{}, err
	}
	payload := map[string]any{
		"model":      firstNonEmpty(stringValue(request.Options["model"]), "claude-3-5-sonnet-latest"),
		"max_tokens": 2048,
		"system":     system,
		"messages": []map[string]string{
			{"role": "user", "content": user},
		},
	}

	resp, rawBody, err := doJSONRequest(ctx, httpClient(t.Client), http.MethodPost, endpoint+"/messages", map[string]string{
		"Content-Type":      "application/json",
		"x-api-key":         apiKey,
		"anthropic-version": "2023-06-01",
	}, payload)
	if err != nil {
		return apptranslate.Result{}, err
	}

	var body struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rawBody, &body); err != nil {
		return apptranslate.Result{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := body.Error.Message
		if message == "" {
			message = resp.Status
		}
		return apptranslate.Result{}, errors.New("Claude API " + strconv.Itoa(resp.StatusCode) + ": " + message)
	}

	rawText := "[]"
	if len(body.Content) > 0 && body.Content[0].Text != "" {
		rawText = body.Content[0].Text
	}

	translations, metadata, err := parseOperationResponse(request, rawText)
	if err != nil {
		return apptranslate.Result{}, err
	}

	return apptranslate.Result{
		Translations: translations,
		Debug: map[string]any{
			"request": map[string]any{
				"endpoint": endpoint + "/messages",
				"headers": map[string]any{
					"Content-Type":      "application/json",
					"x-api-key":         "[REDACTED]",
					"anthropic-version": "2023-06-01",
				},
				"payload": payload,
			},
			"response": map[string]any{
				"status":  resp.StatusCode,
				"rawText": rawText,
			},
		},
		Metadata: metadata,
	}, nil
}

func (t GoogleTranslator) Translate(ctx context.Context, request apptranslate.Request) (apptranslate.Result, error) {
	endpoint := strings.TrimRight(firstNonEmpty(stringValue(request.RuntimeOverrides["apiEndpoint"]), t.DefaultEndpoint), "/")
	if endpoint == "" {
		endpoint = "https://generativelanguage.googleapis.com/v1beta"
	}
	apiKey := firstNonEmpty(stringValue(request.RuntimeOverrides["apiKey"]), t.DefaultAPIKey)
	if apiKey == "" {
		return apptranslate.Result{}, errors.New("服务端未配置 GOOGLE_API_KEY")
	}

	system, user, err := buildOperationMessages(request)
	if err != nil {
		return apptranslate.Result{}, err
	}
	model := firstNonEmpty(stringValue(request.Options["model"]), "models/gemini-2.5-flash")
	payload := map[string]any{
		"systemInstruction": map[string]any{
			"parts": []map[string]string{
				{"text": system},
			},
		},
		"contents": []map[string]any{
			{
				"role": "user",
				"parts": []map[string]string{
					{"text": user},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature":     floatValue(request.Options["temperature"], 0.3),
			"maxOutputTokens": intValue(request.Options["maxTokens"], 4096),
		},
	}
	if stringValue(request.Options["disableThinking"]) == "true" && supportsGoogleThinkingConfig(model) {
		generationConfig := payload["generationConfig"].(map[string]any)
		generationConfig["thinkingConfig"] = map[string]any{"thinkingBudget": 0}
	}

	url := endpoint + "/" + strings.TrimPrefix(model, "/") + ":generateContent?key=" + apiKey
	resp, rawBody, err := doJSONRequest(ctx, httpClient(t.Client), http.MethodPost, url, map[string]string{
		"Content-Type": "application/json",
	}, payload)
	if err != nil {
		return apptranslate.Result{}, err
	}

	rawText, errorMessage, err := extractGoogleResponseText(rawBody)
	if err != nil {
		return apptranslate.Result{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if errorMessage == "" {
			errorMessage = resp.Status
		}
		return apptranslate.Result{}, errors.New("Google API " + strconv.Itoa(resp.StatusCode) + ": " + errorMessage)
	}

	translations, metadata, err := parseOperationResponse(request, rawText)
	if err != nil {
		return apptranslate.Result{}, err
	}

	return apptranslate.Result{
		Translations: translations,
		Debug: map[string]any{
			"request": map[string]any{
				"endpoint": endpoint + "/" + strings.TrimPrefix(model, "/") + ":generateContent?key=[REDACTED]",
				"headers": map[string]any{
					"Content-Type": "application/json",
				},
				"payload": payload,
			},
			"response": map[string]any{
				"status":  resp.StatusCode,
				"rawText": rawText,
			},
		},
		Metadata: metadata,
	}, nil
}

func (t BaiduTranslator) Translate(ctx context.Context, request apptranslate.Request) (apptranslate.Result, error) {
	endpoint := firstNonEmpty(stringValue(request.RuntimeOverrides["apiEndpoint"]), t.DefaultEndpoint)
	appID := firstNonEmpty(stringValue(request.RuntimeOverrides["appId"]), t.DefaultAppID)
	runtimeAPIKey := stringValue(request.RuntimeOverrides["apiKey"])
	runtimeSecretKey := stringValue(request.RuntimeOverrides["secretKey"])
	apiKey := runtimeAPIKey
	if apiKey == "" && runtimeSecretKey == "" {
		apiKey = t.DefaultAPIKey
	}
	secretKey := firstNonEmpty(runtimeSecretKey, t.DefaultSecretKey)
	if appID == "" {
		return apptranslate.Result{}, errors.New("服务端未配置 BAIDU_APP_ID")
	}

	punctuationEnabled := truthyValue(request.Options["punctuationPreprocessing"])
	normalizedTexts := make([]string, len(request.Texts))
	for index, text := range request.Texts {
		if punctuationEnabled {
			normalizedTexts[index] = replaceWithTokens(text)
		} else {
			normalizedTexts[index] = text
		}
	}

	query := strings.Join(normalizedTexts, "\n")
	payload := map[string]any{
		"appid": appID,
		"from":  "jp",
		"to":    "zh",
		"q":     query,
	}
	if value := stringValue(request.Options["modelType"]); value != "" {
		payload["model_type"] = value
	}
	if value := stringValue(request.Options["reference"]); value != "" {
		payload["reference"] = value
	}

	headers := map[string]string{"Content-Type": "application/json"}
	if apiKey != "" {
		headers["Authorization"] = "Bearer " + apiKey
	} else if secretKey != "" {
		nowFn := t.Now
		if nowFn == nil {
			nowFn = func() int64 { return time.Now().UnixMilli() }
		}
		salt := strconv.FormatInt(nowFn(), 10)
		payload["salt"] = salt
		payload["sign"] = md5Hex(appID + query + salt + secretKey)
	} else {
		return apptranslate.Result{}, errors.New("服务端未配置 BAIDU_API_KEY 或 BAIDU_SECRET_KEY")
	}

	resp, rawBody, err := doJSONRequest(ctx, httpClient(t.Client), http.MethodPost, endpoint, headers, payload)
	if err != nil {
		return apptranslate.Result{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return apptranslate.Result{}, errors.New("百度翻译 " + strconv.Itoa(resp.StatusCode))
	}

	var body struct {
		ErrorCode   string `json:"error_code"`
		ErrorMsg    string `json:"error_msg"`
		TransResult []struct {
			Src string `json:"src"`
			Dst string `json:"dst"`
		} `json:"trans_result"`
	}
	if err := json.Unmarshal(rawBody, &body); err != nil {
		return apptranslate.Result{}, err
	}
	if body.ErrorCode != "" {
		return apptranslate.Result{}, errors.New("百度翻译错误 " + body.ErrorCode + ": " + body.ErrorMsg)
	}

	translations, err := alignBaiduTranslations(normalizedTexts, body.TransResult, punctuationEnabled)
	if err != nil {
		return apptranslate.Result{}, err
	}

	debugHeaders := map[string]any{
		"Content-Type": "application/json",
	}
	if _, ok := headers["Authorization"]; ok {
		debugHeaders["Authorization"] = "Bearer [REDACTED]"
	}

	return apptranslate.Result{
		Translations: translations,
		Debug: map[string]any{
			"request": map[string]any{
				"endpoint": endpoint,
				"headers":  debugHeaders,
				"payload":  payload,
			},
			"response": map[string]any{
				"status":  resp.StatusCode,
				"rawText": string(rawBody),
			},
		},
	}, nil
}

func buildTranslationMessages(texts []string, contextTexts []string, prompt string) (string, string) {
	system := "你是专业的日语字幕翻译员，将日语字幕精准翻译成简体中文。\n规则：保持自然流畅的中文表达；字幕简洁不冗长；人名、专有名词前后一致。\n必须严格返回JSON数组格式，如：[\"翻译1\",\"翻译2\"]，不含任何说明或代码块。"
	if prompt != "" {
		system += "\n补充要求：" + prompt
	}

	contextBlock := ""
	if len(contextTexts) > 0 {
		lines := make([]string, 0, len(contextTexts))
		for index, text := range contextTexts {
			lines = append(lines, strconv.Itoa(index+1)+". "+text)
		}
		contextBlock = "\n【前文参考（勿重复翻译，仅用于保持人名、剧情连贯）】\n" + strings.Join(lines, "\n") + "\n"
	}

	lines := make([]string, 0, len(texts))
	for index, text := range texts {
		lines = append(lines, strconv.Itoa(index+1)+". "+text)
	}

	user := contextBlock + "\n【待翻译字幕】\n" + strings.Join(lines, "\n") + "\n\n以JSON数组返回翻译结果："
	return system, user
}

func buildReviewMessages(texts []string, draftTexts []string, contextTexts []string, prompt string) (string, string) {
	system := "你是专业的中文字幕校对员。请参考原文日语和当前中文字幕，对中文字幕进行润色校对。\n规则：修正错译、漏译和不自然表达；保持字幕简洁；不要添加解释；必须严格返回 JSON 数组。"
	if prompt != "" {
		system += "\n补充要求：" + prompt
	}

	contextBlock := ""
	if len(contextTexts) > 0 {
		contextBlock = "\n【前文中文字幕参考】\n" + strings.Join(contextTexts, "\n")
	}

	lines := make([]string, 0, len(texts))
	for index, text := range texts {
		draft := ""
		if index < len(draftTexts) {
			draft = draftTexts[index]
		}
		lines = append(lines, strconv.Itoa(index+1)+". 原文："+text+"\n   当前译文："+draft)
	}

	user := contextBlock + "\n【待校对字幕】\n" + strings.Join(lines, "\n") + "\n\n请仅返回润色后的 JSON 数组："
	return system, user
}

func buildJudgeMessages(texts []string, candidates []apptranslate.JudgeCandidate, prompt string) (string, string) {
	count := len(texts)
	system := "你是专业字幕评审。请在多个中文字幕候选中选出更适合作为最终字幕的版本。\n" +
		"规则：只从给定候选中选择，不要自行改写；" +
		"必须为每一条字幕都返回一个评审对象，输出数组长度必须严格等于输入条数（" + strconv.Itoa(count) + "条）；" +
		"对象至少包含 winner 和 reason 字段；winner 必须是候选 key；不得跳过、合并或省略任何条目。"
	if prompt != "" {
		system += "\n补充要求：" + prompt
	}

	lines := make([]string, 0, len(texts))
	for index, text := range texts {
		builder := []string{strconv.Itoa(index+1) + ". 原文：" + text}
		for _, candidate := range candidates {
			value := ""
			if index < len(candidate.Texts) {
				value = candidate.Texts[index]
			}
			builder = append(builder, "   候选 "+candidate.Key+"（"+candidate.Label+"）："+value)
		}
		lines = append(lines, strings.Join(builder, "\n"))
	}

	user := "【待评估字幕（共" + strconv.Itoa(count) + "条，必须返回" + strconv.Itoa(count) + "个对象）】\n" +
		strings.Join(lines, "\n") +
		"\n\n请返回长度为" + strconv.Itoa(count) + "的 JSON 数组，例如：[{\"winner\":\"A\",\"reason\":\"更自然\",\"scores\":{\"A\":9.1,\"B\":8.4}}]"
	return system, user
}

func buildOperationMessages(request apptranslate.Request) (string, string, error) {
	switch request.Operation {
	case "", "translate":
		system, user := buildTranslationMessages(request.Texts, request.ContextTexts, stringValue(request.Options["prompt"]))
		return system, user, nil
	case "review":
		system, user := buildReviewMessages(request.Texts, request.DraftTexts, request.ContextTexts, stringValue(request.Options["prompt"]))
		return system, user, nil
	case "judge":
		system, user := buildJudgeMessages(request.Texts, request.CandidateSets, stringValue(request.Options["prompt"]))
		return system, user, nil
	default:
		return "", "", errors.New("不支持的工作流节点操作")
	}
}

func parseOperationResponse(request apptranslate.Request, rawText string) ([]string, map[string]any, error) {
	switch request.Operation {
	case "", "translate", "review":
		return ParseTranslationResponse(rawText, len(request.Texts)), nil, nil
	case "judge":
		return ParseJudgeResponse(rawText, request.CandidateSets)
	default:
		return nil, nil, errors.New("不支持的工作流节点操作")
	}
}

func buildThinkingOverride(model string, disableThinking string) map[string]any {
	if disableThinking != "true" {
		return map[string]any{}
	}

	normalized := strings.ToLower(strings.TrimSpace(model))
	if strings.Contains(normalized, "deepseek") {
		return map[string]any{"thinking": map[string]any{"type": "disabled"}}
	}
	if strings.Contains(normalized, "qwen") || strings.Contains(normalized, "qwq") || strings.Contains(normalized, "kimi") || strings.Contains(normalized, "moonshot") {
		return map[string]any{"enable_thinking": false}
	}
	if strings.Contains(normalized, "gemma") {
		return map[string]any{"thinking_budget": 0}
	}
	return map[string]any{}
}

func supportsGoogleThinkingConfig(model string) bool {
	normalized := strings.ToLower(strings.TrimSpace(model))
	return strings.Contains(normalized, "gemini-2.5") || strings.Contains(normalized, "gemini-3")
}

func extractGoogleResponseText(rawBody []byte) (string, string, error) {
	var payload struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return "", "", err
	}

	for _, candidate := range payload.Candidates {
		for _, part := range candidate.Content.Parts {
			if strings.TrimSpace(part.Text) != "" {
				return part.Text, payload.Error.Message, nil
			}
		}
	}

	return "[]", payload.Error.Message, nil
}

func httpClient(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	return &http.Client{Timeout: 90 * time.Second}
}

func doJSONRequest(ctx context.Context, client *http.Client, method string, url string, headers map[string]string, payload any) (*http.Response, []byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	var lastResp *http.Response
	var lastRawBody []byte
	var lastErr error

	const maxAttempts = 3

	for attempt := 0; attempt < maxAttempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
		if err != nil {
			return nil, nil, err
		}
		for key, value := range headers {
			req.Header.Set(key, value)
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			if attempt < maxAttempts-1 && isRetryableError(err) {
				select {
				case <-ctx.Done():
					return nil, nil, ctx.Err()
				case <-time.After(time.Duration(attempt+1) * time.Second):
					continue
				}
			}
			return nil, nil, err
		}

		rawBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			if attempt < maxAttempts-1 && isRetryableError(err) {
				select {
				case <-ctx.Done():
					return nil, nil, ctx.Err()
				case <-time.After(time.Duration(attempt+1) * time.Second):
					continue
				}
			}
			return nil, nil, err
		}

		if resp.StatusCode == 429 && attempt < maxAttempts-1 {
			lastErr = errors.New("HTTP 429: rate limit")
			lastResp = resp
			lastRawBody = rawBody
			delay := parseRetryAfter(resp.Header.Get("Retry-After"), time.Duration(10*(attempt+1))*time.Second)
			select {
			case <-ctx.Done():
				return nil, nil, ctx.Err()
			case <-time.After(delay):
				continue
			}
		}

		if resp.StatusCode >= 500 {
			lastErr = errors.New("HTTP " + strconv.Itoa(resp.StatusCode))
			lastResp = resp
			lastRawBody = rawBody
			if attempt < maxAttempts-1 {
				select {
				case <-ctx.Done():
					return nil, nil, ctx.Err()
				case <-time.After(time.Duration(attempt+1) * time.Second):
					continue
				}
			}
			return resp, rawBody, nil
		}

		return resp, rawBody, nil
	}

	if lastResp != nil {
		return lastResp, lastRawBody, nil
	}
	return nil, nil, lastErr
}

func parseRetryAfter(header string, fallback time.Duration) time.Duration {
	if header == "" {
		return fallback
	}
	if seconds, err := strconv.ParseFloat(header, 64); err == nil && seconds > 0 {
		delay := time.Duration(seconds * float64(time.Second))
		if delay > 2*time.Minute {
			return 2 * time.Minute
		}
		return delay
	}
	return fallback
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	errStr := strings.ToLower(err.Error())
	if strings.Contains(errStr, "connection reset") || strings.Contains(errStr, "broken pipe") {
		return true
	}
	return false
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func stringValue(value any) string {
	if typed, ok := value.(string); ok {
		return typed
	}
	return ""
}

func floatValue(value any, fallback float64) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case string:
		parsed, err := strconv.ParseFloat(typed, 64)
		if err == nil {
			return parsed
		}
	}
	return fallback
}

func intValue(value any, fallback int) int {
	switch typed := value.(type) {
	case int:
		return typed
	case float64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(typed)
		if err == nil {
			return parsed
		}
	}
	return fallback
}

var punctuationTokenPairs = [][2]string{
	{"。", "__SRT_PUNC_STOP__"},
	{"？", "__SRT_PUNC_FW_QUESTION__"},
	{"?", "__SRT_PUNC_QUESTION__"},
	{"！", "__SRT_PUNC_FW_EXCL__"},
	{"!", "__SRT_PUNC_EXCL__"},
	{"…", "__SRT_PUNC_ELLIPSIS__"},
	{".", "__SRT_PUNC_DOT__"},
}

func truthyValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return typed == "true" || typed == "1"
	case float64:
		return typed == 1
	}
	return false
}

func replaceWithTokens(text string) string {
	result := text
	for _, pair := range punctuationTokenPairs {
		result = strings.ReplaceAll(result, pair[0], pair[1])
	}
	return result
}

func restoreFromTokens(text string) string {
	result := text
	for _, pair := range punctuationTokenPairs {
		result = strings.ReplaceAll(result, pair[1], pair[0])
	}
	return result
}

func alignBaiduTranslations(texts []string, items []struct {
	Src string `json:"src"`
	Dst string `json:"dst"`
}, restore bool) ([]string, error) {
	result := []string{}
	cursor := 0
	for _, expected := range texts {
		combinedSource := ""
		combinedTranslation := ""
		matched := false
		for cursor < len(items) {
			combinedSource += items[cursor].Src
			combinedTranslation += items[cursor].Dst
			cursor++
			if combinedSource == expected {
				if restore {
					combinedTranslation = restoreFromTokens(combinedTranslation)
				}
				result = append(result, combinedTranslation)
				matched = true
				break
			}
			if !strings.HasPrefix(expected, combinedSource) {
				return nil, errors.New("百度翻译结果与原文条目无法对齐")
			}
		}
		if !matched {
			return nil, errors.New("百度翻译结果与原文条目无法对齐")
		}
	}
	if cursor != len(items) {
		return nil, errors.New("百度翻译结果与原文条目无法对齐")
	}
	return result, nil
}

func md5Hex(value string) string {
	sum := md5.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}
