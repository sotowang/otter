package model

import "time"

// Config represents a configuration item.
type Config struct {
	Namespace string    `json:"namespace"`
	Group     string    `json:"group"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Type      string    `json:"type"` // 配置类型：text, properties, json, yaml, yml, xml
	Version   int64     `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
