package model

import "time"

// User represents a user in the system.
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"password"` // In a real app, this should be hashed
	Role      string    `json:"role"`      // admin or user
	Status    string    `json:"status"`    // active or inactive
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
