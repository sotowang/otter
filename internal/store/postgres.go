package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"otter/internal/model"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(dsn string) (*PostgresStore, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Create schema if not exists
	if _, err := db.Exec("CREATE SCHEMA IF NOT EXISTS otter"); err != nil {
		return nil, err
	}

	// Create table if not exists
	query := `
	CREATE TABLE IF NOT EXISTS otter.namespaces (
		name TEXT PRIMARY KEY,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS otter.configs (
		namespace TEXT REFERENCES otter.namespaces(name) ON DELETE CASCADE,
		"group" TEXT,
		key TEXT,
		value TEXT,
		version BIGINT,
		created_at TIMESTAMP WITH TIME ZONE,
		updated_at TIMESTAMP WITH TIME ZONE,
		PRIMARY KEY (namespace, "group", key)
	);
	CREATE TABLE IF NOT EXISTS otter.config_history (
		id SERIAL PRIMARY KEY,
		namespace TEXT,
		"group" TEXT,
		key TEXT,
		value TEXT,
		version BIGINT,
		op_type TEXT,
		created_at TIMESTAMP WITH TIME ZONE
	);
	CREATE TABLE IF NOT EXISTS otter.users (
		id SERIAL PRIMARY KEY,
		username TEXT UNIQUE,
		password TEXT,
		role TEXT DEFAULT 'user',
		status TEXT DEFAULT 'active',
		created_at TIMESTAMP WITH TIME ZONE,
		updated_at TIMESTAMP WITH TIME ZONE
	);
	-- Insert default public namespace if not exists
	INSERT INTO otter.namespaces (name) VALUES ('public') ON CONFLICT DO NOTHING;
	`
	if _, err := db.Exec(query); err != nil {
		return nil, err
	}

	return &PostgresStore{db: db}, nil
}

// ... (existing methods) ...
func (s *PostgresStore) CreateUser(ctx context.Context, user *model.User) error {
	query := `INSERT INTO otter.users (username, password, role, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := s.db.ExecContext(ctx, query, user.Username, user.Password, user.Role, user.Status, user.CreatedAt, user.UpdatedAt)
	return err
}

func (s *PostgresStore) GetUser(ctx context.Context, username string) (*model.User, error) {
	query := `SELECT id, username, password, role, status, created_at, updated_at FROM otter.users WHERE username = $1`
	row := s.db.QueryRowContext(ctx, query, username)

	var u model.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) ListUsers(ctx context.Context) ([]*model.User, error) {
	query := `SELECT id, username, password, role, status, created_at, updated_at FROM otter.users ORDER BY username`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, nil
}

func (s *PostgresStore) UpdateUser(ctx context.Context, user *model.User) error {
	query := `UPDATE otter.users SET password = $1, role = $2, status = $3, updated_at = $4 WHERE username = $5`
	_, err := s.db.ExecContext(ctx, query, user.Password, user.Role, user.Status, user.UpdatedAt, user.Username)
	return err
}

func (s *PostgresStore) DeleteUser(ctx context.Context, username string) error {
	query := `DELETE FROM otter.users WHERE username = $1`
	_, err := s.db.ExecContext(ctx, query, username)
	return err
}

func (s *PostgresStore) Get(ctx context.Context, namespace, group, key string) (*model.Config, error) {
	query := `SELECT namespace, "group", key, value, version, created_at, updated_at FROM otter.configs WHERE namespace = $1 AND "group" = $2 AND key = $3`
	row := s.db.QueryRowContext(ctx, query, namespace, group, key)

	var cfg model.Config
	if err := row.Scan(&cfg.Namespace, &cfg.Group, &cfg.Key, &cfg.Value, &cfg.Version, &cfg.CreatedAt, &cfg.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &cfg, nil
}

func (s *PostgresStore) Put(ctx context.Context, config *model.Config) error {
	query := `
	INSERT INTO otter.configs (namespace, "group", key, value, version, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT(namespace, "group", key) DO UPDATE SET
		value = excluded.value,
		version = excluded.version,
		updated_at = excluded.updated_at;
	`
	_, err := s.db.ExecContext(ctx, query, config.Namespace, config.Group, config.Key, config.Value, config.Version, config.CreatedAt, config.UpdatedAt)
	return err
}

func (s *PostgresStore) Delete(ctx context.Context, namespace, group, key string) error {
	query := `DELETE FROM otter.configs WHERE namespace = $1 AND "group" = $2 AND key = $3`
	_, err := s.db.ExecContext(ctx, query, namespace, group, key)
	return err
}

func (s *PostgresStore) List(ctx context.Context, namespace, group string) ([]*model.Config, error) {
	query := `SELECT namespace, "group", key, value, version, created_at, updated_at FROM otter.configs WHERE namespace = $1 AND "group" = $2`
	rows, err := s.db.QueryContext(ctx, query, namespace, group)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []*model.Config
	for rows.Next() {
		var cfg model.Config
		if err := rows.Scan(&cfg.Namespace, &cfg.Group, &cfg.Key, &cfg.Value, &cfg.Version, &cfg.CreatedAt, &cfg.UpdatedAt); err != nil {
			return nil, err
		}
		configs = append(configs, &cfg)
	}
	return configs, nil
}

func (s *PostgresStore) CreateHistory(ctx context.Context, history *model.ConfigHistory) error {
	query := `
	INSERT INTO otter.config_history (namespace, "group", key, value, version, op_type, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := s.db.ExecContext(ctx, query, history.Namespace, history.Group, history.Key, history.Value, history.Version, history.OpType, history.CreatedAt)
	return err
}

func (s *PostgresStore) ListHistory(ctx context.Context, namespace, group, key string) ([]*model.ConfigHistory, error) {
	query := `SELECT id, namespace, "group", key, value, version, op_type, created_at FROM otter.config_history WHERE namespace = $1 AND "group" = $2 AND key = $3 ORDER BY version DESC`
	rows, err := s.db.QueryContext(ctx, query, namespace, group, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []*model.ConfigHistory
	for rows.Next() {
		var h model.ConfigHistory
		if err := rows.Scan(&h.ID, &h.Namespace, &h.Group, &h.Key, &h.Value, &h.Version, &h.OpType, &h.CreatedAt); err != nil {
			return nil, err
		}
		histories = append(histories, &h)
	}
	return histories, nil
}

func (s *PostgresStore) ListNamespaces(ctx context.Context) ([]string, error) {
	query := `SELECT name FROM otter.namespaces ORDER BY name`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var namespaces []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		namespaces = append(namespaces, name)
	}
	return namespaces, nil
}

func (s *PostgresStore) CreateNamespace(ctx context.Context, namespace string) error {
	query := `INSERT INTO otter.namespaces (name) VALUES ($1)`
	_, err := s.db.ExecContext(ctx, query, namespace)
	return err
}

func (s *PostgresStore) DeleteNamespace(ctx context.Context, namespace string) error {
	if namespace == "public" {
		return fmt.Errorf("cannot delete default public namespace")
	}

	query := `DELETE FROM otter.namespaces WHERE name = $1`
	_, err := s.db.ExecContext(ctx, query, namespace)
	return err
}

// AddTokenToBlacklist adds a token to the blacklist
func (s *PostgresStore) AddTokenToBlacklist(ctx context.Context, token string, expiresAt time.Time) error {
	// For simplicity, we'll use a simple implementation that returns nil
	// In a real implementation, you would store this in a database table
	return nil
}

// IsTokenBlacklisted checks if a token is blacklisted
func (s *PostgresStore) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	// For simplicity, we'll use a simple implementation that returns false
	// In a real implementation, you would check this against a database table
	return false, nil
}

// CleanupExpiredTokens removes expired tokens from the blacklist
func (s *PostgresStore) CleanupExpiredTokens(ctx context.Context) error {
	// For simplicity, we'll use a simple implementation that returns nil
	// In a real implementation, you would clean up expired tokens from a database table
	return nil
}

// IncrementTokenUsage increments the token usage count
func (s *PostgresStore) IncrementTokenUsage(ctx context.Context, token string) (int64, error) {
	// For simplicity, we'll use a simple implementation that returns 1
	// In a real implementation, you would track this in a database table
	return 1, nil
}

// CheckTokenRateLimit checks if a token has exceeded the rate limit
func (s *PostgresStore) CheckTokenRateLimit(ctx context.Context, token string, limit int64, duration time.Duration) (bool, error) {
	// For simplicity, we'll use a simple implementation that returns true
	// In a real implementation, you would check this against a database table
	return true, nil
}

// ResetTokenUsage resets the token usage count
func (s *PostgresStore) ResetTokenUsage(ctx context.Context, token string) error {
	// For simplicity, we'll use a simple implementation that returns nil
	// In a real implementation, you would reset this in a database table
	return nil
}
