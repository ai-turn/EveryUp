package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	// Embed the timezone database so the TZ env var works in the alpine/scratch
	// image (no OS tzdata): without it agent log lines stay UTC while app logs
	// and the web UI render in local time, which reads as a 9-hour clock skew.
	_ "time/tzdata"

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
