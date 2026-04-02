package workflowtemplates

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	domainworkflow "srt-translate/internal/domain/workflow"
)

type FileRepository struct {
	path string
}

func NewFileRepository(path string) *FileRepository {
	return &FileRepository{path: path}
}

func (r *FileRepository) Read(context.Context) (domainworkflow.State, error) {
	data, err := os.ReadFile(r.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return domainworkflow.State{}, domainworkflow.ErrStateNotFound
		}
		return domainworkflow.State{}, err
	}

	var state domainworkflow.State
	if err := json.Unmarshal(data, &state); err != nil {
		return domainworkflow.State{}, err
	}
	if state.Version == 0 {
		state.Version = 1
	}
	if state.Templates == nil {
		state.Templates = []domainworkflow.Template{}
	}
	return state, nil
}

func (r *FileRepository) Save(_ context.Context, state domainworkflow.State) error {
	if state.Version == 0 {
		state.Version = 1
	}
	if state.Templates == nil {
		state.Templates = []domainworkflow.Template{}
	}

	if err := os.MkdirAll(filepath.Dir(r.path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Clean(r.path), data, 0o644)
}
