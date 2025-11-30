package store

import (
	"context"
	"database/sql"
	"fmt"

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

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Create table if not exists
	query := `
	CREATE TABLE IF NOT EXISTS namespaces (
		name TEXT PRIMARY KEY,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS configs (
		namespace TEXT REFERENCES namespaces(name) ON DELETE CASCADE,
		"group" TEXT,
		key TEXT,
		value TEXT,
		version BIGINT,
		created_at TIMESTAMP WITH TIME ZONE,
		updated_at TIMESTAMP WITH TIME ZONE,
		PRIMARY KEY (namespace, "group", key)
	);
	CREATE TABLE IF NOT EXISTS config_history (
		id SERIAL PRIMARY KEY,
		namespace TEXT,
		"group" TEXT,
		key TEXT,
		value TEXT,
		version BIGINT,
		op_type TEXT,
		created_at TIMESTAMP WITH TIME ZONE
	);
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username TEXT UNIQUE,
		password TEXT,
		created_at TIMESTAMP WITH TIME ZONE
	);
	-- Insert default public namespace if not exists
	INSERT INTO namespaces (name) VALUES ('public') ON CONFLICT DO NOTHING;
	`
	if _, err := db.Exec(query); err != nil {
		return nil, err
	}

	return &PostgresStore{db: db}, nil
}

// ... (existing methods) ...
func (s *PostgresStore) CreateUser(ctx context.Context, user *model.User) error {
	query := `INSERT INTO users (username, password, created_at) VALUES ($1, $2, $3)`
	_, err := s.db.ExecContext(ctx, query, user.Username, user.Password, user.CreatedAt)
	return err
}

func (s *PostgresStore) GetUser(ctx context.Context, username string) (*model.User, error) {
	query := `SELECT id, username, password, created_at FROM users WHERE username = $1`
	row := s.db.QueryRowContext(ctx, query, username)

	var u model.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) Get(ctx context.Context, namespace, group, key string) (*model.Config, error) {
	query := `SELECT namespace, "group", key, value, version, created_at, updated_at FROM configs WHERE namespace = $1 AND "group" = $2 AND key = $3`
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
	INSERT INTO configs (namespace, "group", key, value, version, created_at, updated_at)
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
	query := `DELETE FROM configs WHERE namespace = $1 AND "group" = $2 AND key = $3`
	_, err := s.db.ExecContext(ctx, query, namespace, group, key)
	return err
}

func (s *PostgresStore) List(ctx context.Context, namespace, group string) ([]*model.Config, error) {
	query := `SELECT namespace, "group", key, value, version, created_at, updated_at FROM configs WHERE namespace = $1 AND "group" = $2`
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
	INSERT INTO config_history (namespace, "group", key, value, version, op_type, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := s.db.ExecContext(ctx, query, history.Namespace, history.Group, history.Key, history.Value, history.Version, history.OpType, history.CreatedAt)
	return err
}

func (s *PostgresStore) ListHistory(ctx context.Context, namespace, group, key string) ([]*model.ConfigHistory, error) {
	query := `SELECT id, namespace, "group", key, value, version, op_type, created_at FROM config_history WHERE namespace = $1 AND "group" = $2 AND key = $3 ORDER BY version DESC`
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
	query := `SELECT name FROM namespaces ORDER BY name`
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
	query := `INSERT INTO namespaces (name) VALUES ($1)`
	_, err := s.db.ExecContext(ctx, query, namespace)
	return err
}

func (s *PostgresStore) DeleteNamespace(ctx context.Context, namespace string) error {
	if namespace == "public" {
		return fmt.Errorf("cannot delete default public namespace")
	}

	query := `DELETE FROM namespaces WHERE name = $1`
	_, err := s.db.ExecContext(ctx, query, namespace)
	return err
}
