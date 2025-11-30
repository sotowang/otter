package store

import (
	"context"
	"fmt"
	"sync"
	"time"

	"otter/internal/model"
)

// TokenBlacklistEntry represents a token blacklist entry
type TokenBlacklistEntry struct {
	ExpiresAt time.Time
}

// InMemoryStore implements Store using an in-memory map.
type InMemoryStore struct {
	data           sync.Map // map[string]*model.Config
	history        sync.Map // map[string][]*model.ConfigHistory
	users          sync.Map // map[string]*model.User (key: username)
	namespaces     sync.Map // map[string]bool (key: namespace)
	tokenBlacklist sync.Map // map[string]*TokenBlacklistEntry (key: token)
}

func NewInMemoryStore() *InMemoryStore {
	store := &InMemoryStore{}
	// Add default public namespace
	store.namespaces.Store("public", true)
	// Start background cleanup for expired tokens
	go store.startTokenCleanup()
	return store
}

// startTokenCleanup starts a background goroutine to clean up expired tokens
func (s *InMemoryStore) startTokenCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.CleanupExpiredTokens(context.Background())
	}
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

func (s *InMemoryStore) ListUsers(ctx context.Context) ([]*model.User, error) {
	var users []*model.User
	s.users.Range(func(key, value any) bool {
		users = append(users, value.(*model.User))
		return true
	})
	return users, nil
}

func (s *InMemoryStore) UpdateUser(ctx context.Context, user *model.User) error {
	if _, ok := s.users.Load(user.Username); !ok {
		return ErrNotFound
	}
	s.users.Store(user.Username, user)
	return nil
}

func (s *InMemoryStore) DeleteUser(ctx context.Context, username string) error {
	if _, ok := s.users.Load(username); !ok {
		return ErrNotFound
	}
	s.users.Delete(username)
	return nil
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

// AddTokenToBlacklist adds a token to the blacklist
func (s *InMemoryStore) AddTokenToBlacklist(ctx context.Context, token string, expiresAt time.Time) error {
	entry := &TokenBlacklistEntry{
		ExpiresAt: expiresAt,
	}
	s.tokenBlacklist.Store(token, entry)
	return nil
}

// IsTokenBlacklisted checks if a token is blacklisted
func (s *InMemoryStore) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	val, ok := s.tokenBlacklist.Load(token)
	if !ok {
		return false, nil
	}

	entry := val.(*TokenBlacklistEntry)
	// Check if token has expired
	if time.Now().After(entry.ExpiresAt) {
		// Token has expired, remove it from blacklist
		s.tokenBlacklist.Delete(token)
		return false, nil
	}

	return true, nil
}

// CleanupExpiredTokens removes expired tokens from the blacklist
func (s *InMemoryStore) CleanupExpiredTokens(ctx context.Context) error {
	now := time.Now()
	// Cleanup expired blacklist entries
	s.tokenBlacklist.Range(func(key, value any) bool {
		entry := value.(*TokenBlacklistEntry)
		if now.After(entry.ExpiresAt) {
			s.tokenBlacklist.Delete(key)
		}
		return true
	})
	return nil
}

// TokenUsageRecord represents a token usage record
type TokenUsageRecord struct {
	Count     int64
	LastUsage time.Time
	ExpiresAt time.Time
}

// Token usage tracking
var tokenUsage sync.Map // map[string]*TokenUsageRecord

// IncrementTokenUsage increments the token usage count
func (s *InMemoryStore) IncrementTokenUsage(ctx context.Context, token string) (int64, error) {
	now := time.Now()

	// Get or create usage record
	val, _ := tokenUsage.LoadOrStore(token, &TokenUsageRecord{
		Count:     0,
		LastUsage: now,
		ExpiresAt: now.Add(1 * time.Minute), // Default window: 1 minute
	})

	record := val.(*TokenUsageRecord)

	// Check if record has expired
	if now.After(record.ExpiresAt) {
		// Reset expired record
		record = &TokenUsageRecord{
			Count:     0,
			LastUsage: now,
			ExpiresAt: now.Add(1 * time.Minute),
		}
		tokenUsage.Store(token, record)
	}

	// Increment count
	record.Count++
	record.LastUsage = now

	return record.Count, nil
}

// CheckTokenRateLimit checks if a token has exceeded the rate limit
func (s *InMemoryStore) CheckTokenRateLimit(ctx context.Context, token string, limit int64, duration time.Duration) (bool, error) {
	now := time.Now()

	// Get usage record
	val, ok := tokenUsage.Load(token)
	if !ok {
		// No usage record, allow request
		return true, nil
	}

	record := val.(*TokenUsageRecord)

	// Check if record has expired
	if now.After(record.ExpiresAt) {
		// Expired record, allow request
		return true, nil
	}

	// Check if count exceeds limit
	return record.Count < limit, nil
}

// ResetTokenUsage resets the token usage count
func (s *InMemoryStore) ResetTokenUsage(ctx context.Context, token string) error {
	tokenUsage.Delete(token)
	return nil
}
