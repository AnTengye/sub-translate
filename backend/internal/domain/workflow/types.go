package workflow

import "errors"

var ErrStateNotFound = errors.New("workflow templates not found")

type Target struct {
	Family    string `json:"family"`
	ProfileID string `json:"profileId"`
	ModelID   string `json:"modelId"`
}

type Node struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Type    string `json:"type"`
	Enabled bool   `json:"enabled"`
	Prompt  string `json:"prompt"`
	Target  Target `json:"target"`
}

type Stage struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Execution string `json:"execution"`
	Strategy  string `json:"strategy"`
	Nodes     []Node `json:"nodes"`
}

type Template struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Scenario    string  `json:"scenario"`
	Stages      []Stage `json:"stages"`
}

type State struct {
	Version   int        `json:"version"`
	Templates []Template `json:"templates"`
}
