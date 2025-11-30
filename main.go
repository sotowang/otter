package main

import (
	"flag"

	"go.uber.org/zap"

	"otter/internal/server"
	"otter/internal/store"
)

func main() {
	dsn := flag.String("dsn", "", "PostgreSQL DSN (e.g., postgres://user:password@localhost:5432/otter?sslmode=disable)")
	port := flag.String("port", "8086", "Server port")
	jwtSecret := flag.String("jwt-secret", "default-secret-key", "JWT secret key")
	flag.Parse()

	// Initialize zap logger
	logger, err := zap.NewProduction()
	if err != nil {
		panic("Failed to initialize logger")
	}
	defer logger.Sync()

	var s store.Store

	if *dsn != "" {
		logger.Info("Using PostgreSQL storage")
		s, err = store.NewPostgresStore(*dsn)
	} else {
		logger.Info("Using In-Memory storage")
		s = store.NewInMemoryStore()
	}

	if err != nil {
		logger.Fatal("Failed to initialize store", zap.Error(err))
	}

	// Initialize server
	srv := server.NewServer(s, *jwtSecret, logger)

	// Start HTTP server
	addr := ":" + *port
	logger.Info("Starting otter config center", zap.String("port", *port))
	if err := srv.Run(addr); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}
