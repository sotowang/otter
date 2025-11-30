package model

import "time"

// ConfigHistory represents a historical version of a configuration.
type ConfigHistory struct {
	ID        int64     `json:"id"`
	Namespace string    `json:"namespace"`
	Group     string    `json:"group"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Version   int64     `json:"version"`
	OpType    string    `json:"op_type"` // CREATE, UPDATE, DELETE
	CreatedAt time.Time `json:"created_at"`
}
