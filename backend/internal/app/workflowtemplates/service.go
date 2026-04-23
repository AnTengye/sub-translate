package workflowtemplates

import (
	"context"
	"errors"

	domainworkflow "srt-translate/internal/domain/workflow"
)

type Repository interface {
	Read(context.Context) (domainworkflow.State, error)
	Save(context.Context, domainworkflow.State) error
}

type Dependencies struct {
	Repository Repository
}

type Service struct {
	repository Repository
}

func NewService(deps Dependencies) *Service {
	return &Service{repository: deps.Repository}
}

func (s *Service) Read(ctx context.Context) (domainworkflow.State, error) {
	if s.repository == nil {
		return defaultState(), nil
	}

	state, err := s.repository.Read(ctx)
	if err == nil {
		return state, nil
	}
	if !errors.Is(err, domainworkflow.ErrStateNotFound) {
		return domainworkflow.State{}, err
	}

	seeded := defaultState()
	if err := s.repository.Save(ctx, seeded); err != nil {
		return domainworkflow.State{}, err
	}
	return seeded, nil
}

func (s *Service) Save(ctx context.Context, nextState domainworkflow.State) (domainworkflow.State, error) {
	if nextState.Version == 0 {
		nextState.Version = 1
	}

	if s.repository == nil {
		return nextState, nil
	}

	if err := s.repository.Save(ctx, nextState); err != nil {
		return domainworkflow.State{}, err
	}

	return nextState, nil
}

func defaultState() domainworkflow.State {
	return domainworkflow.State{
		Version: 1,
		Templates: []domainworkflow.Template{
			{
				ID:          "quality-first",
				Name:        "质量优先",
				Description: "主翻译失败后补偿，再进行一次成品校对。",
				Scenario:    "translation",
				Stages: []domainworkflow.Stage{
					{
						ID:        "translate",
						Name:      "主翻译与补偿",
						Type:      "translate",
						Execution: "serial",
						Strategy:  "fallback",
						Nodes: []domainworkflow.Node{
							{ID: "primary", Label: "主翻译", Type: "translate", Enabled: true},
							{ID: "fallback", Label: "补偿翻译", Type: "translate", Enabled: true},
						},
					},
					{
						ID:        "review",
						Name:      "校对",
						Type:      "review",
						Execution: "serial",
						Strategy:  "replace-current",
						Nodes: []domainworkflow.Node{
							{ID: "reviewer", Label: "校对节点", Type: "review", Enabled: true},
						},
					},
				},
			},
			{
				ID:          "compare-and-judge",
				Name:        "双路对比（对抗式评审）",
				Description: "两路候选并行生成，双维度独立评审，争议条目进入仲裁轮次。",
				Scenario:    "comparison",
				Stages: []domainworkflow.Stage{
					{
						ID:        "translate",
						Name:      "候选翻译",
						Type:      "translate",
						Execution: "parallel",
						Strategy:  "keep-all",
						Nodes: []domainworkflow.Node{
							{ID: "candidate-a", Label: "候选 A", Type: "translate", Enabled: true},
							{ID: "candidate-b", Label: "候选 B", Type: "translate", Enabled: true},
						},
					},
					{
						ID:        "judge",
						Name:      "对抗评审",
						Type:      "judge",
						Execution: "parallel",
						Strategy:  "adversarial",
						Nodes: []domainworkflow.Node{
							{
								ID:             "judge-accuracy",
								Label:          "准确性评审",
								Type:           "judge",
								Enabled:        true,
								JudgeDimension: "accuracy",
								Prompt:         "你是字幕翻译质量评审专家。你的职责是评估语义准确性和完整性，比较候选 A 与候选 B，返回每条字幕的 winner、score、reason。",
							},
							{
								ID:             "judge-fluency",
								Label:          "流畅性评审",
								Type:           "judge",
								Enabled:        true,
								JudgeDimension: "fluency",
								Prompt:         "你是字幕翻译质量评审专家。你的职责是评估自然流畅性和风格适配，比较候选 A 与候选 B，返回每条字幕的 winner、score、reason。",
							},
						},
					},
					{
						ID:        "debate",
						Name:      "争议仲裁",
						Type:      "judge",
						Execution: "serial",
						Strategy:  "tiebreak",
						Nodes: []domainworkflow.Node{
							{
								ID:             "judge-tiebreak",
								Label:          "仲裁节点",
								Type:           "judge",
								Enabled:        true,
								JudgeDimension: "tiebreak",
								Prompt:         "你将收到争议字幕、候选 A/B 与各维度评审理由，请给出最终 winner 和综合 reason。",
							},
						},
					},
				},
			},
		},
	}
}
