package providers

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	apptranslate "srt-translate/internal/app/translate"
)

const failurePlaceholder = "[翻译失败]"

var arrayContainerKeys = []string{"translations", "results", "data", "items"}
var textValueKeys = []string{"translatedText", "translation", "text", "content", "result", "output", "response", "message", "中文文本", "译文", "翻译", "targetText", "target", "dst", "当前译文", "refined", "corrected", "修正译文", "改正", "翻译结果"}
var sourceKeyPatterns = []string{"原", "source", "original", "src", "原文"}

type JudgeCandidate = apptranslate.JudgeCandidate

func ParseTranslationResponse(text string, count int) []string {
	cleaned := stripResponseArtifacts(text)

	var parsed any
	if err := json.Unmarshal([]byte(cleaned), &parsed); err == nil {
		normalized := normalizeTranslationItems(extractTranslationsPayload(parsed), count)
		if hasSuccessValue(normalized) {
			return normalized
		}
	}

	start := strings.Index(cleaned, "[")
	end := strings.LastIndex(cleaned, "]")
	if start >= 0 && end > start {
		var embedded any
		if err := json.Unmarshal([]byte(cleaned[start:end+1]), &embedded); err == nil {
			normalized := normalizeTranslationItems(extractTranslationsPayload(embedded), count)
			if hasSuccessValue(normalized) {
				return normalized
			}
		}
	}

	lines := []string{}
	for _, line := range strings.Split(cleaned, "\n") {
		trimmed := strings.TrimSpace(stripNumberPrefix(line))
		if trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	if len(lines) >= count {
		return lines[:count]
	}

	result := make([]string, count)
	for index := range result {
		result[index] = failurePlaceholder
	}
	return result
}

func ParseJudgeResponse(text string, candidates []JudgeCandidate) ([]string, map[string]any, error) {
	if len(candidates) == 0 {
		return nil, nil, errors.New("judge candidates required")
	}

	count := len(candidates[0].Texts)
	if count == 0 {
		return nil, nil, errors.New("judge candidates required")
	}

	candidateByKey := make(map[string]JudgeCandidate, len(candidates))
	for _, candidate := range candidates {
		candidateByKey[candidate.Key] = candidate
	}

	cleaned := stripResponseArtifacts(text)
	rawItems, err := extractJudgeItems(cleaned)
	if err != nil {
		return nil, nil, err
	}
	if len(rawItems) < count {
		return nil, nil, errors.New("judge response shorter than candidate count")
	}

	translations := make([]string, count)
	decisions := make([]map[string]any, count)
	for index := 0; index < count; index++ {
		item := rawItems[index]
		winner, ok := extractTextValue(item["winner"], 0)
		if !ok {
			winner, ok = extractTextValue(item["winnerKey"], 0)
		}
		if !ok {
			winner, ok = extractTextValue(item["selected"], 0)
		}
		if !ok {
			return nil, nil, errors.New("judge response missing winner")
		}

		candidate, exists := candidateByKey[winner]
		if !exists || index >= len(candidate.Texts) {
			return nil, nil, errors.New("judge response contains unknown winner")
		}

		reason, _ := extractTextValue(item["reason"], 0)
		translations[index] = candidate.Texts[index]
		decision := map[string]any{
			"winner": winner,
			"label":  candidate.Label,
			"reason": reason,
		}
		if scores, ok := item["scores"].(map[string]any); ok {
			decision["scores"] = scores
		}
		decisions[index] = decision
	}

	return translations, map[string]any{"decisions": decisions}, nil
}

func IsFailureTranslation(text string) bool {
	return text == "" || text == failurePlaceholder
}

func stripResponseArtifacts(text string) string {
	cleaned := text
	for _, pattern := range []string{"<|endoftext|>", "<|im_start|>", "<|im_end|>"} {
		if index := strings.Index(cleaned, pattern); index >= 0 {
			cleaned = cleaned[:index]
		}
	}
	cleaned = strings.ReplaceAll(cleaned, "```json", "")
	cleaned = strings.ReplaceAll(cleaned, "```", "")
	for {
		start := strings.Index(cleaned, "<think>")
		end := strings.Index(cleaned, "</think>")
		if start < 0 || end < 0 || end < start {
			break
		}
		cleaned = cleaned[:start] + cleaned[end+len("</think>"):]
	}
	return strings.TrimSpace(cleaned)
}

func normalizeTranslationItems(values any, count int) []string {
	items, ok := values.([]any)
	if !ok {
		result := make([]string, count)
		for index := range result {
			result[index] = failurePlaceholder
		}
		return result
	}

	if len(items) == 1 && count > 1 {
		if extracted, ok := extractTextValue(items[0], 0); ok {
			expanded := splitStructuredTranslationBlock(extracted, count)
			if len(expanded) >= count {
				return expanded[:count]
			}
		}
	}

	result := make([]string, count)
	for index := 0; index < count; index++ {
		if index >= len(items) {
			result[index] = failurePlaceholder
			continue
		}
		if extracted, ok := extractTextValue(items[index], 0); ok {
			result[index] = extracted
		} else {
			result[index] = failurePlaceholder
		}
	}
	return result
}

func extractTranslationsPayload(value any) any {
	if _, ok := value.([]any); ok {
		return value
	}

	object, ok := value.(map[string]any)
	if !ok {
		return nil
	}

	for _, key := range arrayContainerKeys {
		if items, exists := object[key].([]any); exists {
			return items
		}
	}

	if extracted, ok := extractTextValue(object, 0); ok {
		return []any{extracted}
	}

	return nil
}

func extractTextValue(value any, depth int) (string, bool) {
	switch typed := value.(type) {
	case string:
		trimmed := strings.TrimSpace(typed)
		return trimmed, trimmed != ""
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64), true
	case bool:
		return strconv.FormatBool(typed), true
	case map[string]any:
		if depth > 2 {
			return "", false
		}
		for _, key := range textValueKeys {
			if candidate, ok := extractTextValue(typed[key], depth+1); ok {
				return candidate, true
			}
		}
		// Fallback: collect non-source string values and return the first one
		var nonSourceValues []string
		for key, item := range typed {
			if isSourceKey(key) {
				continue
			}
			if candidate, ok := extractTextValue(item, depth+1); ok {
				nonSourceValues = append(nonSourceValues, candidate)
			}
		}
		if len(nonSourceValues) > 0 {
			return nonSourceValues[0], true
		}
		// Last resort: try any value including source keys
		for _, item := range typed {
			if candidate, ok := extractTextValue(item, depth+1); ok {
				return candidate, true
			}
		}
	}

	return "", false
}

func isSourceKey(key string) bool {
	lowerKey := strings.ToLower(key)
	for _, pattern := range sourceKeyPatterns {
		if strings.Contains(lowerKey, pattern) || strings.Contains(key, pattern) {
			return true
		}
	}
	return false
}

func splitStructuredTranslationBlock(text string, count int) []string {
	lines := []string{}
	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			lines = append(lines, trimmed)
		}
	}

	numbered := []string{}
	for _, line := range lines {
		value := stripNumberPrefix(line)
		if value != strings.TrimSpace(line) {
			numbered = append(numbered, value)
		}
	}
	if len(numbered) >= count {
		return numbered
	}

	content := []string{}
	for _, line := range lines {
		if strings.HasPrefix(line, "【") && strings.HasSuffix(line, "】") {
			continue
		}
		content = append(content, line)
	}
	return content
}

func stripNumberPrefix(line string) string {
	trimmed := strings.TrimSpace(line)
	for _, separator := range []string{".", "。", "、", ":", "："} {
		for prefix := 1; prefix <= 99; prefix++ {
			token := strconv.Itoa(prefix) + separator
			if strings.HasPrefix(trimmed, token) {
				return strings.TrimSpace(strings.TrimPrefix(trimmed, token))
			}
		}
	}
	return trimmed
}

func hasSuccessValue(values []string) bool {
	for _, value := range values {
		if value != failurePlaceholder {
			return true
		}
	}
	return false
}

func extractJudgeItems(text string) ([]map[string]any, error) {
	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start >= 0 && end > start {
		text = text[start : end+1]
	}

	var items []map[string]any
	if err := json.Unmarshal([]byte(text), &items); err == nil {
		return items, nil
	}

	var generic []any
	if err := json.Unmarshal([]byte(text), &generic); err != nil {
		return nil, err
	}

	items = make([]map[string]any, 0, len(generic))
	for _, item := range generic {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, errors.New("judge response must be an array of objects")
		}
		items = append(items, object)
	}
	return items, nil
}
