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
				Name:        "双路比对",
				Description: "两路候选并行生成，再由评估节点推荐。",
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
						Name:      "评估推荐",
						Type:      "judge",
						Execution: "serial",
						Strategy:  "manual-review",
						Nodes: []domainworkflow.Node{
							{ID: "judge", Label: "评估节点", Type: "judge", Enabled: true},
						},
					},
				},
			},
		},
	}
}
