package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"otter/internal/model"
)

type Client struct {
	endpoint string
	token    string
	client   *http.Client
}

func NewClient(endpoint string) *Client {
	return &Client{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) WithAuth(token string) *Client {
	c.token = token
	return c
}

func (c *Client) Login(username, password string) error {
	url := fmt.Sprintf("%s/api/v1/login", c.endpoint)
	reqBody, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})

	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login failed: status %d", resp.StatusCode)
	}

	var res map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return err
	}

	c.token = res["token"]
	return nil
}

func (c *Client) GetConfig(namespace, group, key string) (*model.Config, error) {
	url := fmt.Sprintf("%s/api/v1/namespaces/%s/groups/%s/configs/%s", c.endpoint, namespace, group, key)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get config: status %d", resp.StatusCode)
	}

	var cfg model.Config
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Client) WatchConfig(namespace, group, key string, callback func(*model.Config)) {
	go func() {
		// Use a separate client with longer timeout for watching
		watchClient := &http.Client{Timeout: 40 * time.Second}
		url := fmt.Sprintf("%s/api/v1/namespaces/%s/groups/%s/configs/%s/watch", c.endpoint, namespace, group, key)

		for {
			req, err := http.NewRequest(http.MethodGet, url, nil)
			if err != nil {
				time.Sleep(2 * time.Second)
				continue
			}

			if c.token != "" {
				req.Header.Set("Authorization", "Bearer "+c.token)
			}

			resp, err := watchClient.Do(req)
			if err != nil {
				// Log error and retry after delay
				time.Sleep(2 * time.Second)
				continue
			}

			if resp.StatusCode == http.StatusOK {
				var cfg model.Config
				if err := json.NewDecoder(resp.Body).Decode(&cfg); err == nil {
					callback(&cfg)
				}
			} else if resp.StatusCode == http.StatusNotModified {
				// Timeout, just retry
			} else {
				// Error, retry after delay
				time.Sleep(2 * time.Second)
			}
			resp.Body.Close()
		}
	}()
}
