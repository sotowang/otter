package main

import (
	"flag"
	"log"
	"net/http"

	"otter/internal/server"
	"otter/internal/store"
)

func main() {
	dsn := flag.String("dsn", "", "PostgreSQL DSN (e.g., postgres://user:password@localhost:5432/otter?sslmode=disable)")
	port := flag.String("port", "8086", "Server port")
	jwtSecret := flag.String("jwt-secret", "default-secret-key", "JWT secret key")
	flag.Parse()

	var s store.Store
	var err error

	if *dsn != "" {
		log.Printf("Using PostgreSQL storage")
		s, err = store.NewPostgresStore(*dsn)
	} else {
		log.Printf("Using In-Memory storage")
		s = store.NewInMemoryStore()
	}

	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}

	// Initialize server
	srv := server.NewServer(s, *jwtSecret)

	// Start HTTP server
	addr := ":" + *port
	log.Printf("Starting otter config center on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
