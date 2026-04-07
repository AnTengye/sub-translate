package db

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	domainprovider "srt-translate/internal/domain/providercenter"
)

const appConfigID = "app-config"

type AppConfigRecord struct {
	ID              string `gorm:"primaryKey;size:64"`
	DefaultProvider string `gorm:"size:64;not null"`
	GlobalRpmLimit  int    `gorm:"not null;default:0"`
	GlobalRpdLimit  int    `gorm:"not null;default:0"`
	InterruptThreshold int `gorm:"not null;default:3"`
}

type ProviderFamilyRecord struct {
	ID              string `gorm:"primaryKey;size:64"`
	Label           string `gorm:"size:128;not null"`
	Description     string `gorm:"type:text;not null"`
	ActiveProfileID string `gorm:"size:64;not null"`
}

type ProviderProfileRecord struct {
	ID                  string `gorm:"primaryKey;size:64"`
	FamilyID            string `gorm:"index;size:64;not null"`
	Name                string `gorm:"size:128;not null"`
	Enabled             bool   `gorm:"not null"`
	IsDefault           bool   `gorm:"not null"`
	ConnectionJSON      string `gorm:"type:text;not null"`
	SettingsJSON        string `gorm:"type:text;not null"`
	CapabilitiesJSON    string `gorm:"type:text;not null"`
	RpmLimit            int    `gorm:"not null;default:0"`
	RpdLimit            int    `gorm:"not null;default:0"`
	AvailableModelsJSON string `gorm:"type:text;not null"`
	ModelDiscoveryJSON  string `gorm:"type:text;not null"`
	HealthJSON          string `gorm:"type:text;not null"`
}

type ProviderModelRecord struct {
	ID        string `gorm:"primaryKey;size:64"`
	ProfileID string `gorm:"index;size:64;not null"`
	ModelKey  string `gorm:"size:255;not null"`
	Label     string `gorm:"size:255;not null"`
	Enabled   bool   `gorm:"not null"`
	Source    string `gorm:"size:32;not null"`
	RpmLimit  int    `gorm:"not null;default:0"`
	RpdLimit  int    `gorm:"not null;default:0"`
}

type ProviderCenterRepository struct {
	db *gorm.DB
}

func OpenSQLiteForTest(baseDir string) (*gorm.DB, func(), error) {
	dbPath := filepath.Join(baseDir, "provider-center.db")
	gormDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		sqlDB, sqlErr := gormDB.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	}

	return gormDB, cleanup, nil
}

func NewProviderCenterRepository(db *gorm.DB) (*ProviderCenterRepository, error) {
	if err := db.AutoMigrate(
		&AppConfigRecord{},
		&ProviderFamilyRecord{},
		&ProviderProfileRecord{},
		&ProviderModelRecord{},
	); err != nil {
		return nil, err
	}

	return &ProviderCenterRepository{db: db}, nil
}

func (r *ProviderCenterRepository) Read(ctx context.Context) (domainprovider.State, error) {
	var config AppConfigRecord
	if err := r.db.WithContext(ctx).First(&config, "id = ?", appConfigID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domainprovider.State{}, gorm.ErrRecordNotFound
		}
		return domainprovider.State{}, err
	}

	var familyRecords []ProviderFamilyRecord
	if err := r.db.WithContext(ctx).Order("id asc").Find(&familyRecords).Error; err != nil {
		return domainprovider.State{}, err
	}

	var profileRecords []ProviderProfileRecord
	if err := r.db.WithContext(ctx).Order("id asc").Find(&profileRecords).Error; err != nil {
		return domainprovider.State{}, err
	}

	var modelRecords []ProviderModelRecord
	if err := r.db.WithContext(ctx).Order("id asc").Find(&modelRecords).Error; err != nil {
		return domainprovider.State{}, err
	}

	modelsByProfileID := map[string][]domainprovider.Model{}
	for _, record := range modelRecords {
		modelsByProfileID[record.ProfileID] = append(modelsByProfileID[record.ProfileID], domainprovider.Model{
			ID:       record.ModelKey,
			Label:    record.Label,
			Enabled:  record.Enabled,
			Source:   record.Source,
			RpmLimit: record.RpmLimit,
			RpdLimit: record.RpdLimit,
		})
	}

	profilesByFamilyID := map[string][]domainprovider.Profile{}
	for _, record := range profileRecords {
		profile := domainprovider.Profile{
			ID:              record.ID,
			Family:          record.FamilyID,
			Name:            record.Name,
			Enabled:         record.Enabled,
			IsDefault:       record.IsDefault,
			Connection:      map[string]string{},
			Settings:        map[string]string{},
			Capabilities:    map[string]bool{},
			RpmLimit:        record.RpmLimit,
			RpdLimit:        record.RpdLimit,
			Models:          emptyModels(modelsByProfileID[record.ID]),
			AvailableModels: []domainprovider.Model{},
			ModelDiscovery:  domainprovider.ModelDiscovery{},
			Health:          domainprovider.Health{},
		}

		if err := json.Unmarshal([]byte(record.ConnectionJSON), &profile.Connection); err != nil {
			return domainprovider.State{}, err
		}
		if err := json.Unmarshal([]byte(record.SettingsJSON), &profile.Settings); err != nil {
			return domainprovider.State{}, err
		}
		if err := json.Unmarshal([]byte(record.CapabilitiesJSON), &profile.Capabilities); err != nil {
			return domainprovider.State{}, err
		}
		if err := json.Unmarshal([]byte(record.AvailableModelsJSON), &profile.AvailableModels); err != nil {
			return domainprovider.State{}, err
		}
		profile.AvailableModels = emptyModels(profile.AvailableModels)
		if err := json.Unmarshal([]byte(record.ModelDiscoveryJSON), &profile.ModelDiscovery); err != nil {
			return domainprovider.State{}, err
		}
		if err := json.Unmarshal([]byte(record.HealthJSON), &profile.Health); err != nil {
			return domainprovider.State{}, err
		}

		profilesByFamilyID[record.FamilyID] = append(profilesByFamilyID[record.FamilyID], profile)
	}

	families := make(map[string]domainprovider.Family, len(familyRecords))
	for _, record := range familyRecords {
		families[record.ID] = domainprovider.Family{
			ID:              record.ID,
			Label:           record.Label,
			Description:     record.Description,
			ActiveProfileID: record.ActiveProfileID,
			Profiles:        emptyProfiles(profilesByFamilyID[record.ID]),
		}
	}

	return domainprovider.State{
		Version:         1,
		DefaultProvider: config.DefaultProvider,
		Limits: domainprovider.Limits{
			GlobalRpmLimit: config.GlobalRpmLimit,
			GlobalRpdLimit: config.GlobalRpdLimit,
			RateLimitInterruptThreshold: config.InterruptThreshold,
		},
		Families:        families,
	}, nil
}

func (r *ProviderCenterRepository) Save(ctx context.Context, state domainprovider.State) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		config := AppConfigRecord{
			ID:              appConfigID,
			DefaultProvider: state.DefaultProvider,
			GlobalRpmLimit:  state.Limits.GlobalRpmLimit,
			GlobalRpdLimit:  state.Limits.GlobalRpdLimit,
			InterruptThreshold: state.Limits.RateLimitInterruptThreshold,
		}
		if err := tx.Save(&config).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ProviderModelRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ProviderProfileRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ProviderFamilyRecord{}).Error; err != nil {
			return err
		}

		for _, family := range state.Families {
			familyRecord := ProviderFamilyRecord{
				ID:              family.ID,
				Label:           family.Label,
				Description:     family.Description,
				ActiveProfileID: family.ActiveProfileID,
			}
			if err := tx.Create(&familyRecord).Error; err != nil {
				return err
			}

			for _, profile := range family.Profiles {
				connectionJSON, err := marshalJSON(profile.Connection)
				if err != nil {
					return err
				}
				settingsJSON, err := marshalJSON(profile.Settings)
				if err != nil {
					return err
				}
				capabilitiesJSON, err := marshalJSON(profile.Capabilities)
				if err != nil {
					return err
				}
				availableModelsJSON, err := marshalJSON(profile.AvailableModels)
				if err != nil {
					return err
				}
				modelDiscoveryJSON, err := marshalJSON(profile.ModelDiscovery)
				if err != nil {
					return err
				}
				healthJSON, err := marshalJSON(profile.Health)
				if err != nil {
					return err
				}

				profileRecord := ProviderProfileRecord{
					ID:                  profile.ID,
					FamilyID:            family.ID,
					Name:                profile.Name,
					Enabled:             profile.Enabled,
					IsDefault:           profile.IsDefault,
					ConnectionJSON:      connectionJSON,
					SettingsJSON:        settingsJSON,
					CapabilitiesJSON:    capabilitiesJSON,
					RpmLimit:            profile.RpmLimit,
					RpdLimit:            profile.RpdLimit,
					AvailableModelsJSON: availableModelsJSON,
					ModelDiscoveryJSON:  modelDiscoveryJSON,
					HealthJSON:          healthJSON,
				}
				if err := tx.Create(&profileRecord).Error; err != nil {
					return err
				}

				for _, model := range profile.Models {
					modelRecord := ProviderModelRecord{
						ID:        profile.ID + ":" + model.ID,
						ProfileID: profile.ID,
						ModelKey:  model.ID,
						Label:     model.Label,
						Enabled:   model.Enabled,
						Source:    model.Source,
						RpmLimit:  model.RpmLimit,
						RpdLimit:  model.RpdLimit,
					}
					if err := tx.Create(&modelRecord).Error; err != nil {
						return err
					}
				}
			}
		}

		return nil
	})
}

func marshalJSON(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func emptyModels(models []domainprovider.Model) []domainprovider.Model {
	if models == nil {
		return []domainprovider.Model{}
	}
	return models
}

func emptyProfiles(profiles []domainprovider.Profile) []domainprovider.Profile {
	if profiles == nil {
		return []domainprovider.Profile{}
	}
	return profiles
}
