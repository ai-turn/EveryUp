package models

import "time"

// User represents a local authenticated user.
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // never serialised
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}
