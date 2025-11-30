package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

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

// ConnectionStats contains connection statistics for the server
type ConnectionStats struct {
	TotalRequests      int64         `json:"total_requests"`
	ActiveConnections  int64         `json:"active_connections"`
	SuccessfulRequests int64         `json:"successful_requests"`
	FailedRequests     int64         `json:"failed_requests"`
	TotalDuration      time.Duration `json:"total_duration"`
	AverageDuration    time.Duration `json:"average_duration"`
	LastRequestTime    time.Time     `json:"last_request_time"`
	ErrorRate          float64       `json:"error_rate"`
}

type Server struct {
	store     store.Store
	watcher   *Watcher
	jwtSecret string
	engine    *gin.Engine
	logger    *zap.Logger

	// Connection statistics
	mu    sync.Mutex
	stats ConnectionStats
}

func NewServer(store store.Store, jwtSecret string, logger *zap.Logger) *Server {
	// Set Gin to release mode in production
	gin.SetMode(gin.ReleaseMode)

	s := &Server{
		store:     store,
		watcher:   NewWatcher(),
		jwtSecret: jwtSecret,
		engine:    gin.New(),
		logger:    logger,
		stats: ConnectionStats{
			LastRequestTime: time.Now(),
		},
	}

	// Initialize default admin user
	s.initAdminUser()

	// Setup Gin middleware
	s.engine.Use(gin.Recovery())
	s.engine.Use(s.statsMiddleware())
	s.setupRoutes()

	return s
}

// statsMiddleware is a Gin middleware that collects connection statistics
func (s *Server) statsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Increment active connections
		s.mu.Lock()
		s.stats.ActiveConnections++
		s.mu.Unlock()

		startTime := time.Now()

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(startTime)

		// Determine if request was successful (status < 500)
		success := c.Writer.Status() < 500

		// Update statistics
		s.mu.Lock()
		s.stats.TotalRequests++
		s.stats.TotalDuration += duration
		s.stats.LastRequestTime = time.Now()

		if success {
			s.stats.SuccessfulRequests++
		} else {
			s.stats.FailedRequests++
		}

		// Calculate average duration
		if s.stats.TotalRequests > 0 {
			s.stats.AverageDuration = s.stats.TotalDuration / time.Duration(s.stats.TotalRequests)
		}

		// Calculate error rate
		if s.stats.TotalRequests > 0 {
			s.stats.ErrorRate = float64(s.stats.FailedRequests) / float64(s.stats.TotalRequests) * 100
		}

		// Decrement active connections
		s.stats.ActiveConnections--
		s.mu.Unlock()
	}
}

// getStatsHandler returns the current connection statistics
func (s *Server) getStatsHandler(c *gin.Context) {
	s.mu.Lock()
	stats := s.stats
	s.mu.Unlock()

	c.JSON(http.StatusOK, stats)
}

// Run starts the HTTP server
func (s *Server) Run(addr string) error {
	return s.engine.Run(addr)
}

func (s *Server) initAdminUser() {
	ctx := context.Background()
	_, err := s.store.GetUser(ctx, "admin")
	if err == store.ErrNotFound {
		s.store.CreateUser(ctx, &model.User{
			Username:  "admin",
			Password:  "admin", // Default password
			Role:      "admin",
			Status:    "active",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
		s.logger.Info("Created default admin user", zap.String("username", "admin"), zap.String("password", "admin"))
	}
}

// setupRoutes configures all HTTP routes
func (s *Server) setupRoutes() {
	// Use Gin middleware
	s.engine.Use(s.corsMiddleware())

	// Serve static files
	s.engine.StaticFile("/", "./web/index.html")
	s.engine.Static("/static", "./web/static")

	// API Routes
	api := s.engine.Group("/api/v1")
	{
		// Public routes
		api.POST("/login", s.loginHandler)
		api.POST("/refresh", s.refreshTokenHandler)

		// Connection stats route (public for monitoring)
		api.GET("/stats", s.getStatsHandler)

		// Protected routes
		protected := api.Group("/")
		protected.Use(s.ginAuthMiddleware())
		{
			// Namespace routes
			protected.GET("/namespaces", s.listNamespacesHandler)
			protected.POST("/namespaces", s.createNamespaceHandler)
			protected.DELETE("/namespaces/:namespace", s.deleteNamespaceHandler)

			// Config routes
			protected.GET("/namespaces/:namespace/groups/:group/configs", s.listConfigsHandler)
			protected.GET("/namespaces/:namespace/groups/:group/configs/:key", s.getConfigHandler)
			protected.PUT("/namespaces/:namespace/groups/:group/configs/:key", s.putConfigHandler)
			protected.DELETE("/namespaces/:namespace/groups/:group/configs/:key", s.deleteConfigHandler)
			protected.GET("/namespaces/:namespace/groups/:group/configs/:key/watch", s.watchConfigHandler)

			// History routes
			protected.GET("/namespaces/:namespace/groups/:group/configs/:key/history", s.listHistoryHandler)
			protected.POST("/namespaces/:namespace/groups/:group/configs/:key/rollback", s.rollbackConfigHandler)

			// User routes
			protected.GET("/users", s.listUsersHandler)
			protected.POST("/users", s.createUserHandler)
			protected.PUT("/users/:username", s.updateUserHandler)
			protected.DELETE("/users/:username", s.deleteUserHandler)
		}
	}
}

// corsMiddleware handles CORS headers
func (s *Server) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// ginAuthMiddleware wraps the existing authMiddleware for Gin
func (s *Server) ginAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Convert Gin context to http.ResponseWriter and *http.Request
		// and use the existing authMiddleware
		s.authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			// If we get here, the token is valid
			// Set the username from context to Gin context
			if username, ok := r.Context().Value("username").(string); ok {
				c.Set("username", username)
			}
			c.Next()
		})(c.Writer, c.Request)
	}
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

// handleNamespaces handles namespace-related API requests
func (s *Server) handleNamespaces(w http.ResponseWriter, r *http.Request) {
	// Path: /api/v1/namespaces/:namespace
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/namespaces")
	trimmedPath := strings.Trim(path, "/")

	// Handle root namespaces path
	if trimmedPath == "" {
		switch r.Method {
		case http.MethodGet:
			// GET /api/v1/namespaces - list all namespaces
			s.listNamespaces(w, r)
			return
		case http.MethodPost:
			// POST /api/v1/namespaces - create new namespace
			s.createNamespace(w, r)
			return
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
	}

	// Handle namespace-specific paths
	parts := strings.Split(trimmedPath, "/")
	if len(parts) != 1 {
		http.NotFound(w, r)
		return
	}

	namespace := parts[0]
	switch r.Method {
	case http.MethodDelete:
		// DELETE /api/v1/namespaces/:namespace - delete namespace
		s.deleteNamespace(w, r, namespace)
		return
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

// listNamespaces returns all namespaces
func (s *Server) listNamespaces(w http.ResponseWriter, r *http.Request) {
	namespaces, err := s.store.ListNamespaces(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(namespaces)
}

// createNamespace creates a new namespace
func (s *Server) createNamespace(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "namespace name cannot be empty", http.StatusBadRequest)
		return
	}

	if err := s.store.CreateNamespace(r.Context(), req.Name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"name": req.Name})
}

// deleteNamespace deletes a namespace
func (s *Server) deleteNamespace(w http.ResponseWriter, r *http.Request, namespace string) {
	if err := s.store.DeleteNamespace(r.Context(), namespace); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Gin handlers

// loginHandler handles user login
func (s *Server) loginHandler(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get user from store
	user, err := s.store.GetUser(c.Request.Context(), req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check password (in production, this should be a proper password comparison)
	if user.Password != req.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT tokens
	accessToken, refreshToken, expiresIn, err := s.generateTokens(req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"expires_in":    expiresIn,
	})
}

// listNamespacesHandler returns all namespaces
func (s *Server) listNamespacesHandler(c *gin.Context) {
	namespaces, err := s.store.ListNamespaces(c.Request.Context())
	if err != nil {
		s.logger.Error("Failed to list namespaces", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, namespaces)
}

// createNamespaceHandler creates a new namespace
func (s *Server) createNamespaceHandler(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Namespace name cannot be empty"})
		return
	}

	if err := s.store.CreateNamespace(c.Request.Context(), req.Name); err != nil {
		s.logger.Error("Failed to create namespace", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"name": req.Name})
}

// deleteNamespaceHandler deletes a namespace
func (s *Server) deleteNamespaceHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	if err := s.store.DeleteNamespace(c.Request.Context(), namespace); err != nil {
		s.logger.Error("Failed to delete namespace", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// listConfigsHandler returns all configs for a namespace and group
func (s *Server) listConfigsHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")

	configs, err := s.store.List(c.Request.Context(), namespace, group)
	if err != nil {
		s.logger.Error("Failed to list configs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, configs)
}

// getConfigHandler returns a specific config
func (s *Server) getConfigHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	config, err := s.store.Get(c.Request.Context(), namespace, group, key)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
			return
		}
		s.logger.Error("Failed to get config", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, config)
}

// putConfigHandler creates or updates a config
func (s *Server) putConfigHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	var req struct {
		Value string `json:"value" binding:"required"`
		Type  string `json:"type"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate config type
	validTypes := map[string]bool{
		"": true, "text": true, "properties": true, "json": true, "yaml": true, "yml": true, "xml": true,
	}
	if !validTypes[req.Type] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config type"})
		return
	}

	// Set default type if not provided
	configType := req.Type
	if configType == "" {
		configType = "text"
	}

	// Validate JSON format if type is json
	if configType == "json" {
		// Check if value is valid JSON
		var jsonObj map[string]interface{}
		if err := json.Unmarshal([]byte(req.Value), &jsonObj); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			return
		}

		// Check for duplicate keys using a custom parser
		// Standard json.Unmarshal automatically handles duplicates by keeping the last value
		// So we need to use a custom parser to detect duplicates
		decoder := json.NewDecoder(strings.NewReader(req.Value))
		decoder.UseNumber()

		// Check if it's an object
		token, err := decoder.Token()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			return
		}

		// Must be an object start
		if delim, ok := token.(json.Delim); !ok || delim != '{' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "JSON must be an object"})
			return
		}

		// Track keys to detect duplicates
		keys := make(map[string]bool)

		// Iterate through all key-value pairs
		for decoder.More() {
			token, err := decoder.Token()
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
				return
			}

			// Must be a string key
			keyStr, ok := token.(string)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "JSON keys must be strings"})
				return
			}

			// Check for duplicate key
			if keys[keyStr] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "JSON contains duplicate keys"})
				return
			}
			keys[keyStr] = true

			// Skip the value
			if err := decoder.Decode(&jsonObj); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
				return
			}
		}

		// Must end with object close
		token, err = decoder.Token()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			return
		}

		// Check if it's an object end
		delim, ok := token.(json.Delim)
		if !ok || delim != '}' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			return
		}
	}

	config := &model.Config{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     req.Value,
		Type:      configType,
		Version:   time.Now().UnixNano(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.Put(c.Request.Context(), config); err != nil {
		s.logger.Error("Failed to put config", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create history
	history := &model.ConfigHistory{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     req.Value,
		Version:   config.Version,
		OpType:    "UPDATE",
		CreatedAt: time.Now(),
	}
	_ = s.store.CreateHistory(c.Request.Context(), history)

	// Notify watchers
	s.watcher.Notify(config)

	c.JSON(http.StatusCreated, config)
}

// deleteConfigHandler deletes a config
func (s *Server) deleteConfigHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	if err := s.store.Delete(c.Request.Context(), namespace, group, key); err != nil {
		s.logger.Error("Failed to delete config", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
	_ = s.store.CreateHistory(c.Request.Context(), history)

	// Notify watchers about deletion
	s.watcher.Notify(&model.Config{Namespace: namespace, Group: group, Key: key, Value: "", Version: -1})

	c.Status(http.StatusNoContent)
}

// watchConfigHandler handles config watching via long polling
func (s *Server) watchConfigHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	// Long polling: wait for update or timeout
	ch := s.watcher.Subscribe(namespace, group, key)

	select {
	case cfg := <-ch:
		c.JSON(http.StatusOK, cfg)
	case <-time.After(30 * time.Second):
		c.Status(http.StatusNotModified)
	case <-c.Request.Context().Done():
		return
	}
}

// listHistoryHandler returns config history
func (s *Server) listHistoryHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	histories, err := s.store.ListHistory(c.Request.Context(), namespace, group, key)
	if err != nil {
		s.logger.Error("Failed to list history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, histories)
}

// rollbackConfigHandler rolls back a config to a specific version
func (s *Server) rollbackConfigHandler(c *gin.Context) {
	namespace := c.Param("namespace")
	group := c.Param("group")
	key := c.Param("key")

	var req struct {
		Version int64 `json:"version" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Find the history record
	histories, err := s.store.ListHistory(c.Request.Context(), namespace, group, key)
	if err != nil {
		s.logger.Error("Failed to list history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}

	// Restore config
	config := &model.Config{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     target.Value,
		Version:   time.Now().UnixNano(), // New version for the rollback
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.Put(c.Request.Context(), config); err != nil {
		s.logger.Error("Failed to restore config", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create history for rollback
	history := &model.ConfigHistory{
		Namespace: namespace,
		Group:     group,
		Key:       key,
		Value:     target.Value,
		Version:   config.Version,
		OpType:    "ROLLBACK",
		CreatedAt: time.Now(),
	}
	_ = s.store.CreateHistory(c.Request.Context(), history)

	// Notify watchers
	s.watcher.Notify(config)

	c.JSON(http.StatusOK, config)
}

// User management handlers

// listUsersHandler returns all users
func (s *Server) listUsersHandler(c *gin.Context) {
	users, err := s.store.ListUsers(c.Request.Context())
	if err != nil {
		s.logger.Error("Failed to list users", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// createUserHandler creates a new user
func (s *Server) createUserHandler(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role" binding:"required,oneof=admin user"`
		Status   string `json:"status" binding:"required,oneof=active inactive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Check if user already exists
	_, err := s.store.GetUser(c.Request.Context(), req.Username)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	} else if err != store.ErrNotFound {
		s.logger.Error("Failed to check user existence", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create new user
	user := &model.User{
		Username:  req.Username,
		Password:  req.Password, // In production, this should be hashed
		Role:      req.Role,
		Status:    req.Status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.store.CreateUser(c.Request.Context(), user); err != nil {
		s.logger.Error("Failed to create user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// updateUserHandler updates an existing user
func (s *Server) updateUserHandler(c *gin.Context) {
	username := c.Param("username")

	var req struct {
		Password string `json:"password"`
		Role     string `json:"role" binding:"required,oneof=admin user"`
		Status   string `json:"status" binding:"required,oneof=active inactive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get existing user
	user, err := s.store.GetUser(c.Request.Context(), username)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		s.logger.Error("Failed to get user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update user fields
	if req.Password != "" {
		user.Password = req.Password // In production, this should be hashed
	}
	user.Role = req.Role
	user.Status = req.Status
	user.UpdatedAt = time.Now()

	if err := s.store.UpdateUser(c.Request.Context(), user); err != nil {
		s.logger.Error("Failed to update user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// deleteUserHandler deletes a user
func (s *Server) deleteUserHandler(c *gin.Context) {
	username := c.Param("username")

	// Prevent deleting admin user
	if username == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete admin user"})
		return
	}

	if err := s.store.DeleteUser(c.Request.Context(), username); err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		s.logger.Error("Failed to delete user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
