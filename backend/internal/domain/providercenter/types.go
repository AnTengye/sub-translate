package providercenter

type Model struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
	Source  string `json:"source"`
}

type Health struct {
	Status        string  `json:"status"`
	Summary       string  `json:"summary"`
	LastCheckedAt *string `json:"lastCheckedAt"`
	Error         *string `json:"error"`
}

type ModelDiscovery struct {
	SourceMode             string  `json:"sourceMode"`
	SupportsModelDiscovery bool    `json:"supportsModelDiscovery"`
	LastCheckedAt          *string `json:"lastCheckedAt"`
	LastStatus             string  `json:"lastStatus"`
	LastError              *string `json:"lastError"`
}

type Profile struct {
	ID              string            `json:"id"`
	Family          string            `json:"family"`
	Name            string            `json:"name"`
	Enabled         bool              `json:"enabled"`
	IsDefault       bool              `json:"isDefault"`
	Connection      map[string]string `json:"connection"`
	Settings        map[string]string `json:"settings"`
	Capabilities    map[string]bool   `json:"capabilities"`
	Models          []Model           `json:"models"`
	AvailableModels []Model           `json:"availableModels,omitempty"`
	ModelDiscovery  ModelDiscovery    `json:"modelDiscovery"`
	Health          Health            `json:"health"`
}

type Family struct {
	ID              string    `json:"id"`
	Label           string    `json:"label"`
	Description     string    `json:"description"`
	ActiveProfileID string    `json:"activeProfileId"`
	Profiles        []Profile `json:"profiles"`
}

type State struct {
	Version         int               `json:"version"`
	DefaultProvider string            `json:"defaultProvider"`
	Families        map[string]Family `json:"families"`
}
