package model

import "time"

// User represents a user in the system.
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"password"` // In a real app, this should be hashed
	CreatedAt time.Time `json:"created_at"`
}
