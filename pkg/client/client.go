package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/sotowang/otter/pkg/model"
)

// ClientConfig contains configuration for the client

type ClientConfig struct {
	// Endpoint is the server endpoint URL
	Endpoint string
	// Token is the authentication token
	Token string
	// ConnectionPoolSize is the maximum number of connections in the pool
	ConnectionPoolSize int
	// ConnectionIdleTimeout is the time after which idle connections are closed
	ConnectionIdleTimeout time.Duration
	// RequestTimeout is the timeout for each HTTP request
	RequestTimeout time.Duration
	// WatchTimeout is the timeout for watch requests
	WatchTimeout time.Duration
}

// ConnectionStats contains connection statistics
type ConnectionStats struct {
	TotalRequests      int64         `json:"total_requests"`
	SuccessfulRequests int64         `json:"successful_requests"`
	FailedRequests     int64         `json:"failed_requests"`
	TotalDuration      time.Duration `json:"total_duration"`
	AverageDuration    time.Duration `json:"average_duration"`
	LastRequestTime    time.Time     `json:"last_request_time"`
	ErrorRate          float64       `json:"error_rate"`
}

// Client represents a client for the Otter config center

type Client struct {
	endpoint     string
	token        string
	refreshToken string
	client       *http.Client
	config       ClientConfig

	// Connection statistics
	mu    sync.Mutex
	stats ConnectionStats
}

// NewClient creates a new client with default configuration

func NewClient(endpoint string) *Client {
	return NewClientWithConfig(ClientConfig{
		Endpoint:              endpoint,
		ConnectionPoolSize:    10,
		ConnectionIdleTimeout: 60 * time.Second,
		RequestTimeout:        10 * time.Second,
		WatchTimeout:          40 * time.Second,
	})
}

// NewClientWithConfig creates a new client with custom configuration

func NewClientWithConfig(config ClientConfig) *Client {
	// Set default values if not provided
	if config.ConnectionPoolSize <= 0 {
		config.ConnectionPoolSize = 10
	}
	if config.ConnectionIdleTimeout <= 0 {
		config.ConnectionIdleTimeout = 60 * time.Second
	}
	if config.RequestTimeout <= 0 {
		config.RequestTimeout = 10 * time.Second
	}
	if config.WatchTimeout <= 0 {
		config.WatchTimeout = 40 * time.Second
	}

	// Create HTTP client with connection pool
	transport := &http.Transport{
		MaxIdleConns:          config.ConnectionPoolSize,
		MaxIdleConnsPerHost:   config.ConnectionPoolSize,
		IdleConnTimeout:       config.ConnectionIdleTimeout,
		MaxConnsPerHost:       config.ConnectionPoolSize * 2, // Allow temporary burst
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   config.RequestTimeout,
	}

	return &Client{
		endpoint: config.Endpoint,
		token:    config.Token,
		client:   client,
		config:   config,
		stats: ConnectionStats{
			LastRequestTime: time.Now(),
		},
	}
}

// WithAuth sets the authentication token

func (c *Client) WithAuth(token string) *Client {
	c.token = token
	return c
}

// updateStats updates connection statistics based on request result
func (c *Client) updateStats(startTime time.Time, success bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	duration := time.Since(startTime)
	c.stats.TotalRequests++
	c.stats.TotalDuration += duration
	c.stats.LastRequestTime = time.Now()

	if success {
		c.stats.SuccessfulRequests++
	} else {
		c.stats.FailedRequests++
	}

	// Calculate average duration
	if c.stats.TotalRequests > 0 {
		c.stats.AverageDuration = c.stats.TotalDuration / time.Duration(c.stats.TotalRequests)
	}

	// Calculate error rate
	if c.stats.TotalRequests > 0 {
		c.stats.ErrorRate = float64(c.stats.FailedRequests) / float64(c.stats.TotalRequests) * 100
	}
}

// GetConnectionStats returns current connection statistics
func (c *Client) GetConnectionStats() ConnectionStats {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.stats
}

// TokenResponse represents the server response for login and refresh

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// RefreshToken refreshes the access token using the refresh token
func (c *Client) RefreshToken() error {
	if c.refreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	startTime := time.Now()
	url := fmt.Sprintf("%s/api/v1/refresh", c.endpoint)
	reqBody, _ := json.Marshal(map[string]string{
		"refresh_token": c.refreshToken,
	})

	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		c.updateStats(startTime, false)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.updateStats(startTime, false)
		return fmt.Errorf("refresh token failed: status %d", resp.StatusCode)
	}

	var res TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		c.updateStats(startTime, false)
		return err
	}

	c.token = res.AccessToken
	c.refreshToken = res.RefreshToken
	c.updateStats(startTime, true)
	return nil
}

// Login authenticates with the server and gets a token

func (c *Client) Login(username, password string) error {
	startTime := time.Now()
	url := fmt.Sprintf("%s/api/v1/login", c.endpoint)
	reqBody, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})

	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		c.updateStats(startTime, false)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.updateStats(startTime, false)
		return fmt.Errorf("login failed: status %d", resp.StatusCode)
	}

	var res TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		c.updateStats(startTime, false)
		return err
	}

	c.token = res.AccessToken
	c.refreshToken = res.RefreshToken
	c.updateStats(startTime, true)
	return nil
}

// GetConfig retrieves a configuration item

func (c *Client) GetConfig(namespace, group, key string) (*model.Config, error) {
	startTime := time.Now()
	url := fmt.Sprintf("%s/api/v1/namespaces/%s/groups/%s/configs/%s", c.endpoint, namespace, group, key)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		c.updateStats(startTime, false)
		return nil, err
	}

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		c.updateStats(startTime, false)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.updateStats(startTime, false)
		return nil, fmt.Errorf("failed to get config: status %d", resp.StatusCode)
	}

	var cfg model.Config
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		c.updateStats(startTime, false)
		return nil, err
	}
	c.updateStats(startTime, true)
	return &cfg, nil
}

// WatchConfig watches for changes to a configuration item

func (c *Client) WatchConfig(namespace, group, key string, callback func(*model.Config)) {
	go func() {
		url := fmt.Sprintf("%s/api/v1/namespaces/%s/groups/%s/configs/%s/watch", c.endpoint, namespace, group, key)

		for {
			startTime := time.Now()

			// Create a new request each time to ensure we use the latest token
			req, err := http.NewRequest(http.MethodGet, url, nil)
			if err != nil {
				c.updateStats(startTime, false)
				time.Sleep(2 * time.Second)
				continue
			}

			if c.token != "" {
				req.Header.Set("Authorization", "Bearer "+c.token)
			}

			// Create a custom client with watch timeout for this request only
			watchClient := &http.Client{
				Transport: c.client.Transport, // Reuse the same connection pool
				Timeout:   c.config.WatchTimeout,
			}

			resp, err := watchClient.Do(req)
			if err != nil {
				// Log error and retry after delay
				c.updateStats(startTime, false)
				time.Sleep(2 * time.Second)
				continue
			}

			if resp.StatusCode == http.StatusOK {
				var cfg model.Config
				if err := json.NewDecoder(resp.Body).Decode(&cfg); err == nil {
					callback(&cfg)
				}
				c.updateStats(startTime, true)
			} else if resp.StatusCode == http.StatusNotModified {
				// Timeout, just retry
				c.updateStats(startTime, true) // Treat timeout as successful for stats
			} else if resp.StatusCode == http.StatusUnauthorized {
				// Token expired, try to refresh
				c.updateStats(startTime, false)
				if err := c.RefreshToken(); err == nil {
					// Refresh successful, continue with next iteration
					resp.Body.Close()
					continue
				}
				// Refresh failed, retry after longer delay
				time.Sleep(5 * time.Second)
			} else {
				// Other error, retry after delay
				c.updateStats(startTime, false)
				time.Sleep(2 * time.Second)
			}
			resp.Body.Close()
		}
	}()
}
