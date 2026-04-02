package workflowtemplates_test

import (
	"context"
	"errors"
	"testing"

	appworkflow "srt-translate/internal/app/workflowtemplates"
	domainworkflow "srt-translate/internal/domain/workflow"
)

type fakeRepository struct {
	state   domainworkflow.State
	readErr error
	saved   domainworkflow.State
}

func (f *fakeRepository) Read(context.Context) (domainworkflow.State, error) {
	if f.readErr != nil {
		return domainworkflow.State{}, f.readErr
	}
	return f.state, nil
}

func (f *fakeRepository) Save(_ context.Context, state domainworkflow.State) error {
	f.saved = state
	f.state = state
	return nil
}

func TestReadSeedsDefaultTemplatesWhenRepositoryIsEmpty(t *testing.T) {
	t.Parallel()

	repository := &fakeRepository{readErr: domainworkflow.ErrStateNotFound}
	service := appworkflow.NewService(appworkflow.Dependencies{
		Repository: repository,
	})

	state, err := service.Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if len(state.Templates) < 2 {
		t.Fatalf("expected at least 2 seeded templates, got %d", len(state.Templates))
	}

	if repository.saved.Version != 1 {
		t.Fatalf("expected seeded state to be saved, got version %d", repository.saved.Version)
	}
}

func TestSavePersistsProvidedWorkflowTemplates(t *testing.T) {
	t.Parallel()

	repository := &fakeRepository{}
	service := appworkflow.NewService(appworkflow.Dependencies{
		Repository: repository,
	})

	nextState := domainworkflow.State{
		Version: 1,
		Templates: []domainworkflow.Template{
			{ID: "compare", Name: "Compare"},
		},
	}

	state, err := service.Save(context.Background(), nextState)
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	if len(state.Templates) != 1 || state.Templates[0].ID != "compare" {
		t.Fatalf("unexpected saved state %#v", state)
	}

	if repository.saved.Templates[0].Name != "Compare" {
		t.Fatalf("expected repository to receive saved template, got %#v", repository.saved)
	}
}

func TestReadReturnsRepositoryErrors(t *testing.T) {
	t.Parallel()

	service := appworkflow.NewService(appworkflow.Dependencies{
		Repository: &fakeRepository{readErr: errors.New("boom")},
	})

	if _, err := service.Read(context.Background()); err == nil || err.Error() != "boom" {
		t.Fatalf("expected repository error to be returned, got %v", err)
	}
}
