package store

import (
	"context"
	"fmt"
	"sync"

	"otter/internal/model"
)

// InMemoryStore implements Store using an in-memory map.
type InMemoryStore struct {
	data       sync.Map // map[string]*model.Config
	history    sync.Map // map[string][]*model.ConfigHistory
	users      sync.Map // map[string]*model.User (key: username)
	namespaces sync.Map // map[string]bool (key: namespace)
}

func NewInMemoryStore() *InMemoryStore {
	store := &InMemoryStore{}
	// Add default public namespace
	store.namespaces.Store("public", true)
	return store
}

func (s *InMemoryStore) CreateUser(ctx context.Context, user *model.User) error {
	if _, ok := s.users.Load(user.Username); ok {
		return fmt.Errorf("user already exists")
	}
	s.users.Store(user.Username, user)
	return nil
}

func (s *InMemoryStore) GetUser(ctx context.Context, username string) (*model.User, error) {
	val, ok := s.users.Load(username)
	if !ok {
		return nil, ErrNotFound
	}
	return val.(*model.User), nil
}

func (s *InMemoryStore) Get(ctx context.Context, namespace, group, key string) (*model.Config, error) {
	val, ok := s.data.Load(namespace + "/" + group + "/" + key)
	if !ok {
		return nil, ErrNotFound
	}
	return val.(*model.Config), nil
}

func (s *InMemoryStore) Put(ctx context.Context, config *model.Config) error {
	// Set default type if not provided
	if config.Type == "" {
		config.Type = "text"
	}
	s.data.Store(config.Namespace+"/"+config.Group+"/"+config.Key, config)
	return nil
}

func (s *InMemoryStore) Delete(ctx context.Context, namespace, group, key string) error {
	s.data.Delete(namespace + "/" + group + "/" + key)
	return nil
}

func (s *InMemoryStore) List(ctx context.Context, namespace, group string) ([]*model.Config, error) {
	var configs []*model.Config
	s.data.Range(func(key, value any) bool {
		cfg := value.(*model.Config)
		if cfg.Namespace == namespace && cfg.Group == group {
			configs = append(configs, cfg)
		}
		return true
	})
	return configs, nil
}

func (s *InMemoryStore) CreateHistory(ctx context.Context, history *model.ConfigHistory) error {
	key := history.Namespace + "/" + history.Group + "/" + history.Key
	val, _ := s.history.LoadOrStore(key, []*model.ConfigHistory{})
	histories := val.([]*model.ConfigHistory)
	histories = append(histories, history)
	s.history.Store(key, histories)
	return nil
}

func (s *InMemoryStore) ListHistory(ctx context.Context, namespace, group, key string) ([]*model.ConfigHistory, error) {
	val, ok := s.history.Load(namespace + "/" + group + "/" + key)
	if !ok {
		return []*model.ConfigHistory{}, nil
	}
	return val.([]*model.ConfigHistory), nil
}

func (s *InMemoryStore) ListNamespaces(ctx context.Context) ([]string, error) {
	var namespaces []string
	s.namespaces.Range(func(key, value any) bool {
		namespaces = append(namespaces, key.(string))
		return true
	})
	return namespaces, nil
}

func (s *InMemoryStore) CreateNamespace(ctx context.Context, namespace string) error {
	if namespace == "" {
		return fmt.Errorf("namespace cannot be empty")
	}
	if _, ok := s.namespaces.Load(namespace); ok {
		return fmt.Errorf("namespace already exists")
	}
	s.namespaces.Store(namespace, true)
	return nil
}

func (s *InMemoryStore) DeleteNamespace(ctx context.Context, namespace string) error {
	if namespace == "" {
		return fmt.Errorf("namespace cannot be empty")
	}
	if namespace == "public" {
		return fmt.Errorf("cannot delete default public namespace")
	}
	
	// Check if there are any configs in this namespace
	var hasConfigs bool
	s.data.Range(func(key, value any) bool {
		cfg := value.(*model.Config)
		if cfg.Namespace == namespace {
			hasConfigs = true
			return false
		}
		return true
	})
	
	if hasConfigs {
		return fmt.Errorf("cannot delete namespace with existing configs")
	}
	
	s.namespaces.Delete(namespace)
	return nil
}
