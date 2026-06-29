package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/aiturn/everyup/agent/internal/agent"
	"github.com/aiturn/everyup/agent/internal/config"
	"github.com/aiturn/everyup/agent/internal/proxy"
)

func main() {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	switch cfg.Mode {
	case "proxy":
		app, err := proxy.New(proxy.Config{
			ListenAddr:   cfg.ProxyListenAddr,
			UpstreamURL:  cfg.ProxyUpstreamURL,
			ServiceName:  cfg.ProxyServiceName,
			OTLPEndpoint: cfg.ProxyOTLPEndpoint,
			HTTPTimeout:  cfg.HTTPTimeout,
			CaptureConfig: proxy.CaptureConfig{
				Enabled:       cfg.CaptureEnabled,
				Routes:        cfg.CaptureRoutes,
				ExcludeRoutes: cfg.CaptureExcludeRoutes,
				MaxBodyBytes:  cfg.CaptureMaxBodyBytes,
				OnStatus:      cfg.CaptureOnStatus,
				OnSlow:        cfg.CaptureOnSlow,
				MaskKeys:      cfg.CaptureMaskKeys,
				RegexPresets:  cfg.CaptureRegexPresets,
			},
		})
		if err != nil {
			log.Fatalf("failed to create proxy: %v", err)
		}
		if err := app.Run(ctx); err != nil {
			log.Fatalf("proxy stopped with error: %v", err)
		}
	default:
		app, err := agent.New(cfg)
		if err != nil {
			log.Fatalf("failed to create agent: %v", err)
		}
		if err := app.Run(ctx); err != nil {
			log.Fatalf("agent stopped with error: %v", err)
		}
	}
}
