package main

import (
	"fmt"

	"github.com/sotowang/otter/pkg/client"
	"github.com/sotowang/otter/pkg/model"
)

func main() {
	c := client.NewClient("http://localhost:8086")

	// Login
	if err := c.Login("admin", "admin"); err != nil {
		panic(err)
	}
	fmt.Println("Login successful")

	namespace := "public"
	group := "DEFAULT_GROUP"
	key := "sdk_test_key"

	// Watch for changes
	c.WatchConfig(namespace, group, key, func(cfg *model.Config) {
		fmt.Printf("Config Updated: %s = %s (Version: %d)\n", cfg.Key, cfg.Value, cfg.Version)
	})

	fmt.Println("Watching for config changes...")

	// Keep main alive
	select {}
}
