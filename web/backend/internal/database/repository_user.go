package database

import (
	"database/sql"
	"fmt"

	"github.com/aiturn/everyup/internal/models"
)

// UserRepository handles all user DB operations.
type UserRepository struct{}

func NewUserRepository() *UserRepository { return &UserRepository{} }

// Count returns the total number of users.
func (r *UserRepository) Count() (int, error) {
	var n int
	err := DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

// Create inserts a new user and returns it.
func (r *UserRepository) Create(username, passwordHash, role string) (*models.User, error) {
	res, err := DB.Exec(
		`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
		username, passwordHash, role,
	)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	id, _ := res.LastInsertId()
	return r.FindByID(id)
}

// FindByUsername returns a user by username, or sql.ErrNoRows if not found.
func (r *UserRepository) FindByUsername(username string) (*models.User, error) {
	u := &models.User{}
	err := DB.QueryRow(
		`SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// FindByID returns a user by ID.
func (r *UserRepository) FindByID(id int64) (*models.User, error) {
	u := &models.User{}
	err := DB.QueryRow(
		`SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?`,
		id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// DeleteAll removes all users from the database (used for account reset).
func (r *UserRepository) DeleteAll() error {
	_, err := DB.Exec(`DELETE FROM users`)
	return err
}

// Upsert creates the user if not found, or updates the password hash if the user already exists.
func (r *UserRepository) Upsert(username, passwordHash, role string) (*models.User, error) {
	existing, err := r.FindByUsername(username)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if err == sql.ErrNoRows {
		return r.Create(username, passwordHash, role)
	}
	_, err = DB.Exec(
		`UPDATE users SET password_hash = ? WHERE username = ?`,
		passwordHash, existing.Username,
	)
	if err != nil {
		return nil, fmt.Errorf("update password: %w", err)
	}
	return r.FindByUsername(existing.Username)
}
