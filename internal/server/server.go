package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"otter/internal/model"
	"otter/internal/store"
)

type Watcher struct {
	subscribers sync.Map // map[string][]chan *model.Config (key: namespace/group/key)
}

func NewWatcher() *Watcher {
	return &Watcher{}
}

func (w *Watcher) Subscribe(namespace, group, key string) chan *model.Config {
	ch := make(chan *model.Config, 1)
	fullKey := namespace + "/" + group + "/" + key

	val, _ := w.subscribers.LoadOrStore(fullKey, []chan *model.Config{})
	subs := val.([]chan *model.Config)
	subs = append(subs, ch)
	w.subscribers.Store(fullKey, subs)

	return ch
}

func (w *Watcher) Notify(config *model.Config) {
	fullKey := config.Namespace + "/" + config.Group + "/" + config.Key
	val, ok := w.subscribers.Load(fullKey)
	if !ok {
		return
	}

	subs := val.([]chan *model.Config)
	for _, ch := range subs {
		select {
		case ch <- config:
		default:
		}
	}
	// Clear subscribers after notification (one-time trigger for long polling)
	w.subscribers.Delete(fullKey)
}

type Server struct {
	store     store.Store
	watcher   *Watcher
	jwtSecret string
}

func NewServer(store store.Store, jwtSecret string) *Server {
	s := &Server{
		store:     store,
		watcher:   NewWatcher(),
		jwtSecret: jwtSecret,
	}
	// Initialize default admin user
	s.initAdminUser()
	return s
}

func (s *Server) initAdminUser() {
	ctx := context.Background()
	_, err := s.store.GetUser(ctx, "admin")
	if err == store.ErrNotFound {
		s.store.CreateUser(ctx, &model.User{
			Username:  "admin",
			Password:  "admin", // Default password
			CreatedAt: time.Now(),
		})
		fmt.Println("Created default admin user (admin/admin)")
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		return
	}

	// Serve static files
	if r.URL.Path == "/" || strings.HasPrefix(r.URL.Path, "/static/") || strings.HasSuffix(r.URL.Path, ".js") || strings.HasSuffix(r.URL.Path, ".css") {
		http.FileServer(http.Dir("./web")).ServeHTTP(w, r)
		return
	}

	// API Routes
	if strings.HasPrefix(r.URL.Path, "/api/v1/") {
		// Login endpoint (public)
		if r.URL.Path == "/api/v1/login" && r.Method == http.MethodPost {
			s.login(w, r)
			return
		}

		// Protected endpoints
		s.authMiddleware(s.handleConfigs)(w, r)
		return
	}

	http.NotFound(w, r)
}

func (s *Server) handleConfigs(w http.ResponseWriter, r *http.Request) {
	// Path: /api/v1/namespaces/:namespace/groups/:group/configs/:key
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/namespaces/")
	parts := strings.Split(path, "/")

	// Expected parts:
	// 0: namespace
	// 1: "groups"
	// 2: group
	// 3: "configs"
	// 4: key (optional)

	if len(parts) < 4 || parts[1] != "groups" || parts[3] != "configs" {
		http.NotFound(w, r)
		return
	}

	namespace := parts[0]
	group := parts[2]
	key := ""
	if len(parts) > 4 {
		key = parts[4]
	}

	// Check for watch request
	if key != "" && strings.HasSuffix(r.URL.Path, "/watch") {
		key = strings.TrimSuffix(key, "/watch")
		s.watchConfig(w, r, namespace, group, key)
		return
	}

	// Check for history request
	if key != "" && strings.HasSuffix(r.URL.Path, "/history") {
		key = strings.TrimSuffix(key, "/history")
		s.listHistory(w, r, namespace, group, key)
		return
	}

	// Check for rollback request
	if key != "" && strings.HasSuffix(r.URL.Path, "/rollback") {
		key = strings.TrimSuffix(key, "/rollback")
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.rollbackConfig(w, r, namespace, group, key)
		return
	}

	switch r.Method {
	case http.MethodGet:
		if key == "" {
			s.listConfigs(w, r, namespace, group)
		} else {
			s.getConfig(w, r, namespace, group, key)
		}
	case http.MethodPut:
		if key == "" {
			http.Error(w, "key is required", http.StatusBadRequest)
			return
		}
		s.putConfig(w, r, namespace, group, key)
	case http.MethodDelete:
		if key == "" {
			http.Error(w, "key is required", http.StatusBadRequest)
			return
		}
		s.deleteConfig(w, r, namespace, group, key)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) watchConfig(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	// Long polling: wait for update or timeout
	ch := s.watcher.Subscribe(namespace, group, key)

	select {
	case cfg := <-ch:
		json.NewEncoder(w).Encode(cfg)
	case <-time.After(30 * time.Second):
		w.WriteHeader(http.StatusNotModified)
	case <-r.Context().Done():
		return
	}
}

func (s *Server) getConfig(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	cfg, err := s.store.Get(r.Context(), namespace, group, key)
	if err != nil {
		if err == store.ErrNotFound {
			http.Error(w, "config not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	json.NewEncoder(w).Encode(cfg)
}

func (s *Server) putConfig(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	var req struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	cfg := &model.Config{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     req.Value,
		Version:   time.Now().UnixNano(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.Put(r.Context(), cfg); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create history
	history := &model.ConfigHistory{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     req.Value,
		Version:   cfg.Version,
		OpType:    "UPDATE",
		CreatedAt: time.Now(),
	}
	_ = s.store.CreateHistory(r.Context(), history)

	// Notify watchers
	s.watcher.Notify(cfg)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(cfg)
}

func (s *Server) deleteConfig(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	// Get existing config to save history before delete (optional, but good for record)
	// For now, just record the delete op

	if err := s.store.Delete(r.Context(), namespace, group, key); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create history
	history := &model.ConfigHistory{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     "",
		Version:   time.Now().UnixNano(),
		OpType:    "DELETE",
		CreatedAt: time.Now(),
	}
	_ = s.store.CreateHistory(r.Context(), history)

	// Notify watchers about deletion
	s.watcher.Notify(&model.Config{Namespace: namespace, Group: group, Key: key, Value: "", Version: -1})

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listConfigs(w http.ResponseWriter, r *http.Request, namespace, group string) {
	configs, err := s.store.List(r.Context(), namespace, group)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(configs)
}

func (s *Server) listHistory(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	histories, err := s.store.ListHistory(r.Context(), namespace, group, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(histories)
}

func (s *Server) rollbackConfig(w http.ResponseWriter, r *http.Request, namespace, group, key string) {
	var req struct {
		Version int64 `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Find the history record
	histories, err := s.store.ListHistory(r.Context(), namespace, group, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var target *model.ConfigHistory
	for _, h := range histories {
		if h.Version == req.Version {
			target = h
			break
		}
	}

	if target == nil {
		http.Error(w, "version not found", http.StatusNotFound)
		return
	}

	// Restore config
	cfg := &model.Config{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     target.Value,
		Version:   time.Now().UnixNano(), // New version for the rollback
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.Put(r.Context(), cfg); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create history for rollback
	history := &model.ConfigHistory{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     target.Value,
		Version:   cfg.Version,
		OpType:    "ROLLBACK",
		CreatedAt: time.Now(),
	}
	_ = s.store.CreateHistory(r.Context(), history)

	// Notify watchers
	s.watcher.Notify(cfg)

	json.NewEncoder(w).Encode(cfg)
}
