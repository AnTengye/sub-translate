package workflowtemplates_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	domainworkflow "srt-translate/internal/domain/workflow"
	infraworkflow "srt-translate/internal/infra/workflowtemplates"
)

func TestFileRepositoryReturnsNotFoundForMissingFile(t *testing.T) {
	t.Parallel()

	repository := infraworkflow.NewFileRepository(filepath.Join(t.TempDir(), "workflow.json"))

	_, err := repository.Read(context.Background())
	if err == nil {
		t.Fatal("expected missing file error")
	}

	if err != domainworkflow.ErrStateNotFound {
		t.Fatalf("expected ErrStateNotFound, got %v", err)
	}
}

func TestFileRepositoryPersistsAndReadsState(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "workflow.json")
	repository := infraworkflow.NewFileRepository(path)

	want := domainworkflow.State{
		Version: 1,
		Templates: []domainworkflow.Template{
			{
				ID:          "quality",
				Name:        "Quality",
				Description: "seed",
				Stages: []domainworkflow.Stage{
					{
						ID:        "translate",
						Name:      "Translate",
						Type:      "translate",
						Execution: "serial",
						Strategy:  "fallback",
					},
				},
			},
		},
	}

	if err := repository.Save(context.Background(), want); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected workflow file to exist: %v", err)
	}

	got, err := repository.Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if len(got.Templates) != 1 || got.Templates[0].Stages[0].Strategy != "fallback" {
		t.Fatalf("unexpected read state %#v", got)
	}
}
