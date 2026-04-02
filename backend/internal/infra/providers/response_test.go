package providers

import (
	"reflect"
	"testing"
)

func TestParseJudgeResponseResolvesWinningTranslationsAndReasons(t *testing.T) {
	t.Parallel()

	translations, metadata, err := ParseJudgeResponse(`[{"winner":"A","reason":"语气更自然","scores":{"A":9.2,"B":8.1}},{"winner":"B","reason":"术语更准确","scores":{"A":7.9,"B":8.9}}]`, []JudgeCandidate{
		{Key: "A", Label: "候选 A", Texts: []string{"你好", "再见"}},
		{Key: "B", Label: "候选 B", Texts: []string{"您好", "拜拜"}},
	})
	if err != nil {
		t.Fatalf("ParseJudgeResponse() error = %v", err)
	}

	if len(translations) != 2 || translations[0] != "你好" || translations[1] != "拜拜" {
		t.Fatalf("unexpected translations %#v", translations)
	}

	decisions, ok := metadata["decisions"].([]map[string]any)
	if !ok || len(decisions) != 2 {
		t.Fatalf("expected decisions metadata, got %#v", metadata)
	}

	if decisions[0]["winner"] != "A" || decisions[1]["winner"] != "B" {
		t.Fatalf("unexpected decisions %#v", decisions)
	}
}

func TestParseTranslationResponseWithReviewFormatCurrentTranslation(t *testing.T) {
	t.Parallel()

	// Test review response with "当前译文" field - should extract the translation, not the source
	input := `[{"原文":"おかえり。","当前译文":"你回来啦。"},{"原文":"来てたんだ。","当前译文":"你来过啊。"}]`
	expected := []string{"你回来啦。", "你来过啊。"}

	result := ParseTranslationResponse(input, 2)
	if !reflect.DeepEqual(result, expected) {
		t.Errorf("ParseTranslationResponse() = %#v, want %#v", result, expected)
	}
}

func TestParseTranslationResponseFallbackExcludesSourceKeys(t *testing.T) {
	t.Parallel()

	// Test fallback logic where no known key exists, but source-like key should be excluded
	input := `[{"source":"おかえり。","result":"你回来啦。"}]`
	expected := []string{"你回来啦。"}

	result := ParseTranslationResponse(input, 1)
	if !reflect.DeepEqual(result, expected) {
		t.Errorf("ParseTranslationResponse() = %#v, want %#v", result, expected)
	}
}

func TestParseTranslationResponseFallbackExcludesChineseSourceKey(t *testing.T) {
	t.Parallel()

	// Test fallback where "原文" (source) key should be excluded when picking the value
	// Use a non-standard translation key that's not in textValueKeys
	input := `[{"原文":"おかえり。","最终结果":"你回来啦。"}]`
	expected := []string{"你回来啦。"}

	result := ParseTranslationResponse(input, 1)
	if !reflect.DeepEqual(result, expected) {
		t.Errorf("ParseTranslationResponse() = %#v, want %#v", result, expected)
	}
}

func TestIsSourceKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		key      string
		expected bool
	}{
		{"原文", true},
		{"原", true},
		{"source", true},
		{"Source", true},
		{"SOURCE", true},
		{"original", true},
		{"Original", true},
		{"src", true},
		{"sourceText", true},
		{"original_text", true},
		{"译文", false},
		{"translation", false},
		{"result", false},
		{"当前译文", false},
		{"target", false},
	}

	for _, tc := range tests {
		t.Run(tc.key, func(t *testing.T) {
			if got := isSourceKey(tc.key); got != tc.expected {
				t.Errorf("isSourceKey(%q) = %v, want %v", tc.key, got, tc.expected)
			}
		})
	}
}
