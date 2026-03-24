package api

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/aiturn/everyup/internal/api/handlers"
	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
)

// SetupRoutes configures all API routes
func SetupRoutes(app *fiber.App, scheduler *checker.Scheduler, collectorMgr *collector.CollectorManager, allowOrigins string, serverMode string) {
	// Apply global middleware
	app.Use(middleware.Recovery())
	app.Use(middleware.Logger())
	app.Use(middleware.CORS(allowOrigins, serverMode))
	app.Use(middleware.SecurityHeaders(serverMode))

	// API routes
	api := app.Group("/api/v1")

	// Health endpoints — open to all
	healthHandler := handlers.NewHealthHandler()
	api.Get("/health", healthHandler.Health)
	api.Get("/version", healthHandler.Version)

	// Auth endpoints — public (no token required, rate-limited)
	authHandler := handlers.NewAuthHandler()
	authLimiter := middleware.AuthRateLimiter()
	api.Get("/auth/setup/status", authHandler.SetupStatus)
	api.Post("/auth/setup", authLimiter, authHandler.Setup)
	api.Post("/auth/login", authLimiter, authHandler.Login)
	api.Post("/auth/logout", authHandler.Logout)

	// Ingest routes — API Key auth + rate limited, registered BEFORE JWT group to avoid interception
	logIngestHandler := handlers.NewLogIngestHandler()
	ingest := api.Group("/logs", middleware.IngestRateLimiter(), middleware.ApiKeyAuth())
	ingest.Post("/ingest", logIngestHandler.Ingest)

	// JWT-protected management routes
	local := api.Group("", middleware.JWTAuth())

	// Auth endpoints — protected
	local.Get("/auth/verify", authHandler.Verify)
	local.Get("/auth/me", authHandler.Me)
	local.Post("/auth/reset", authHandler.Reset)

	// Service endpoints
	serviceHandler := handlers.NewServiceHandler(scheduler)
	local.Get("/services", serviceHandler.GetAll)
	local.Get("/services/:id", serviceHandler.GetByID)
	local.Post("/services", serviceHandler.Create)
	local.Put("/services/:id", serviceHandler.Update)
	local.Delete("/services/:id", serviceHandler.Delete)
	local.Post("/services/:id/pause", serviceHandler.Pause)
	local.Post("/services/:id/resume", serviceHandler.Resume)
	local.Post("/services/:id/regenerate-key", serviceHandler.RegenerateKey)

	// Metric endpoints
	metricHandler := handlers.NewMetricHandler()
	local.Get("/services/:id/metrics", metricHandler.GetByServiceID)
	local.Get("/services/:id/metrics/summary", metricHandler.GetSummary)
	local.Get("/services/:id/uptime", metricHandler.GetUptime)

	// Log endpoints
	logHandler := handlers.NewLogHandler()
	local.Get("/logs", logHandler.GetAll)
	local.Get("/services/:id/logs", logHandler.GetByServiceID)

	// Dashboard endpoints
	dashboardHandler := handlers.NewDashboardHandler()
	local.Get("/dashboard/timeline", dashboardHandler.GetTimeline)

	// Incidents
	incidentHandler := handlers.NewIncidentHandler()
	local.Get("/incidents", incidentHandler.GetAll)
	local.Get("/incidents/active", incidentHandler.GetActive)

	// Host endpoints
	hostHandler := handlers.NewHostHandler(collectorMgr)
	local.Get("/hosts", hostHandler.GetAll)
	local.Get("/hosts/:hostId", hostHandler.GetByID)
	local.Post("/hosts", hostHandler.Create)
	local.Put("/hosts/:hostId", hostHandler.Update)
	local.Delete("/hosts/:hostId", hostHandler.Delete)
	local.Post("/hosts/:hostId/pause", hostHandler.Pause)
	local.Post("/hosts/:hostId/resume", hostHandler.Resume)

	// SSH connection test
	sshTestHandler := handlers.NewSSHTestHandler()
	local.Post("/hosts/test-connection", sshTestHandler.TestConnection)

	// Host-scoped system resource monitoring
	systemHandler := handlers.NewSystemHandler(collectorMgr)
	local.Get("/hosts/:hostId/system/info", systemHandler.GetInfo)
	local.Get("/hosts/:hostId/system/metrics", systemHandler.GetMetricsHistory)
	local.Get("/hosts/:hostId/system/processes", systemHandler.GetProcesses)

	// Legacy system endpoints (backward compatibility)
	local.Get("/system/info", systemHandler.GetInfo)
	local.Get("/system/metrics/history", systemHandler.GetMetricsHistory)
	local.Get("/system/processes", systemHandler.GetProcesses)

	// Notifications
	notificationHandler := handlers.NewNotificationHandler()
	local.Get("/notifications", notificationHandler.GetAll)
	local.Post("/notifications", notificationHandler.Create)
	local.Put("/notifications/:id", notificationHandler.Update)
	local.Post("/notifications/:id/test", notificationHandler.Test)
	local.Post("/notifications/:id/toggle", notificationHandler.Toggle)
	local.Delete("/notifications/:id", notificationHandler.Delete)

	// Alert Rules
	alertRuleHandler := handlers.NewAlertRuleHandler()
	local.Get("/alert-rules", alertRuleHandler.GetAll)
	local.Get("/alert-rules/:id", alertRuleHandler.GetByID)
	local.Post("/alert-rules", alertRuleHandler.Create)
	local.Put("/alert-rules/:id", alertRuleHandler.Update)
	local.Delete("/alert-rules/:id", alertRuleHandler.Delete)
	local.Post("/alert-rules/:id/toggle", alertRuleHandler.Toggle)

	// Settings
	settingsHandler := handlers.NewSettingsHandler()
	local.Get("/settings", settingsHandler.Get)
	local.Put("/settings", settingsHandler.Update)

	// Notification History
	notificationHistoryHandler := handlers.NewNotificationHistoryHandler()
	local.Get("/notification-history", notificationHistoryHandler.GetAll)
	local.Get("/notification-history/stats", notificationHistoryHandler.GetStats)
	local.Get("/notification-history/:id", notificationHistoryHandler.GetByID)
	local.Delete("/notification-history/cleanup", notificationHistoryHandler.Cleanup)

	// Serve static files for frontend (SPA fallback)
	app.Use("/", filesystem.New(filesystem.Config{
		Root:         http.Dir("./web"),
		Browse:       false,
		Index:        "index.html",
		NotFoundFile: "index.html",
	}))
}
