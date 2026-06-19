package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/aiturn/everyup/agent/internal/agent"
	"github.com/aiturn/everyup/agent/internal/config"
)

func main() {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app, err := agent.New(cfg)
	if err != nil {
		log.Fatalf("failed to create agent: %v", err)
	}

	if err := app.Run(ctx); err != nil {
		log.Fatalf("agent stopped with error: %v", err)
	}
}
