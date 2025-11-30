package store

import (
	"context"
	"errors"

	"otter/internal/model"
)

var (
	ErrNotFound = errors.New("config not found")
)

// Store defines the interface for configuration storage.
type Store interface {
	Get(ctx context.Context, namespace, group, key string) (*model.Config, error)
	Put(ctx context.Context, config *model.Config) error
	Delete(ctx context.Context, namespace, group, key string) error
	List(ctx context.Context, namespace, group string) ([]*model.Config, error)

	// Namespace methods
	ListNamespaces(ctx context.Context) ([]string, error)
	CreateNamespace(ctx context.Context, namespace string) error
	DeleteNamespace(ctx context.Context, namespace string) error

	// History methods
	CreateHistory(ctx context.Context, history *model.ConfigHistory) error
	ListHistory(ctx context.Context, namespace, group, key string) ([]*model.ConfigHistory, error)

	// User methods
	CreateUser(ctx context.Context, user *model.User) error
	GetUser(ctx context.Context, username string) (*model.User, error)
	ListUsers(ctx context.Context) ([]*model.User, error)
	UpdateUser(ctx context.Context, user *model.User) error
	DeleteUser(ctx context.Context, username string) error
}
