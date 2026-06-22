package agent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aiturn/everyup/agent/internal/chatops"
	"github.com/aiturn/everyup/agent/internal/checks"
	"github.com/aiturn/everyup/agent/internal/config"
	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/hostmetrics"
	"github.com/aiturn/everyup/agent/internal/llm"
	"github.com/aiturn/everyup/agent/internal/memory"
	"github.com/aiturn/everyup/agent/internal/notifier"
	"github.com/aiturn/everyup/agent/internal/otelconfig"
	"github.com/aiturn/everyup/agent/internal/runbook"
	"github.com/aiturn/everyup/agent/internal/state"
	"github.com/aiturn/everyup/agent/internal/watchdog"
	"github.com/aiturn/everyup/agent/internal/webclient"
)

type Agent struct {
	cfg            config.Config
	notifier       notifier.Notifier
	httpCheck      *checks.HTTPChecker
	tcpCheck       *checks.TCPChecker
	discoverer     targetDiscoverer
	logReader      serviceLogReader
	actionRunner   serviceActionRunner
	resourceReader serviceResourceReader
	summarizer     llm.Provider
	store          *state.Store
	audit          *state.AuditLogger
	web            *webclient.Client
	webAgentID     string
	runbooks       *runbook.Library
	heartbeat      *watchdog.Heartbeat
	memory         *memory.Store
	hostMetrics    *hostmetrics.Reader

	mu        sync.RWMutex
	states    map[string]*targetState
	silences  map[string]state.Silence
	actions   map[string]state.Action
	webEvents []state.AuditEvent
}

type targetDiscoverer interface {
	ListTargets(ctx context.Context) ([]discovery.Target, error)
}

type serviceLogReader interface {
	TailLogs(ctx context.Context, containerID string, lines int) ([]string, error)
}

type serviceActionRunner interface {
	RestartContainer(ctx context.Context, containerID string, timeoutSeconds int) error
}

type serviceResourceReader interface {
	ContainerStats(ctx context.Context, containerID string) (discovery.ContainerStats, error)
}

type targetState struct {
	lastAlertAt         time.Time
	lastLogAlertAt      time.Time
	lastResourceAlertAt time.Time
	lastHostAlertAt     time.Time
	wasHealthy          bool
	seenResult          bool
	updatedAt           time.Time
	serviceName         string
	checkType           string
	endpoint            string
	lastError           string
	lastStatus          int
	lastLatency         string
}

func New(cfg config.Config) (*Agent, error) {
	var discoverer targetDiscoverer
	var logReader serviceLogReader
	var actionRunner serviceActionRunner
	var resourceReader serviceResourceReader
	if cfg.DockerDiscoveryEnabled {
		docker := discovery.NewDockerClient(cfg.DockerSocketPath, cfg.HTTPTimeout)
		discoverer = docker
		logReader = docker
		actionRunner = docker
		resourceReader = docker
	}
	var summarizer llm.Provider
	if cfg.LLMBaseURL != "" {
		summarizer = llm.NewOpenAICompatible(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMModel, cfg.LLMTimeout, cfg.LLMMaxTokens, nil)
	}
	var web *webclient.Client
	if cfg.WebSyncEnabled || cfg.WebBaseURL != "" {
		web = webclient.New(cfg.WebBaseURL, cfg.AgentAPIKey, cfg.HTTPTimeout, nil)
	}
	var runbooks *runbook.Library
	if cfg.RunbookEnabled {
		library, err := runbook.LoadDefaultLibrary()
		if err != nil {
			log.Printf("failed to load default runbooks: %v", err)
		} else {
			if err := library.LoadDir(cfg.RunbookDir); err != nil {
				log.Printf("failed to load custom runbooks from %s: %v", cfg.RunbookDir, err)
			}
			runbooks = library
			log.Printf("loaded %d runbooks", len(library.Books()))
		}
	}
	var heartbeat *watchdog.Heartbeat
	if cfg.HeartbeatURL != "" {
		heartbeat = watchdog.NewHeartbeat(cfg.HeartbeatURL, cfg.HeartbeatToken, cfg.HTTPTimeout, nil)
	}
	var hostReader *hostmetrics.Reader
	if cfg.HostMetricsEnabled {
		hostReader = hostmetrics.New(cfg.HostMetricsRoot, cfg.HostDiskPath)
	}
	var incidentMemory *memory.Store
	if cfg.MemoryEnabled {
		store, err := memory.Open(cfg.MemoryPath)
		if err != nil {
			log.Printf("failed to open incident memory at %s: %v", cfg.MemoryPath, err)
		} else {
			incidentMemory = store
			log.Printf("incident memory enabled at %s", cfg.MemoryPath)
		}
	}

	agent := &Agent{
		cfg:            cfg,
		notifier:       notifier.NewTelegram(cfg.TelegramAPIBase, cfg.TelegramBotToken, cfg.TelegramChatIDs, nil),
		httpCheck:      checks.NewHTTPChecker(cfg.HTTPTimeout),
		tcpCheck:       checks.NewTCPChecker(cfg.HTTPTimeout),
		discoverer:     discoverer,
		logReader:      logReader,
		actionRunner:   actionRunner,
		resourceReader: resourceReader,
		summarizer:     summarizer,
		store:          state.NewStore(filepath.Join(cfg.DataDir, "agent-state.json")),
		audit:          state.NewAuditLogger(filepath.Join(cfg.DataDir, "audit.jsonl")),
		web:            web,
		webAgentID:     cfg.WebAgentID,
		runbooks:       runbooks,
		heartbeat:      heartbeat,
		memory:         incidentMemory,
		hostMetrics:    hostReader,
		states:         make(map[string]*targetState),
		silences:       make(map[string]state.Silence),
		actions:        make(map[string]state.Action),
		webEvents:      make([]state.AuditEvent, 0),
	}

	return agent, nil
}

func (a *Agent) Run(ctx context.Context) error {
	log.Printf("EveryUp Agent starting: name=%s service=%s", a.cfg.AgentName, a.cfg.ServiceName)
	if err := a.loadState(); err != nil {
		log.Printf("failed to load local state: %v", err)
	}
	a.writeOTelConfig()

	if err := a.notifier.Send(ctx, notifier.Message{
		AlertType:   notifier.AlertTypeSystem,
		Severity:    notifier.SeverityInfo,
		ServiceName: a.cfg.ServiceName,
		Title:       "Agent started",
		Body:        fmt.Sprintf("Agent %s is running.", a.cfg.AgentName),
		Time:        time.Now(),
	}); err != nil {
		log.Printf("failed to send startup notification: %v", err)
	} else {
		a.auditEvent("agent_started", a.cfg.ServiceName, "", fmt.Sprintf("Agent %s is running.", a.cfg.AgentName), nil)
	}
	a.startChatOps(ctx)
	a.startWebSync(ctx)
	a.startHeartbeat(ctx)

	a.runChecks(ctx)
	ticker := time.NewTicker(a.cfg.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			a.runChecks(ctx)
		}
	}
}

func (a *Agent) startWebSync(ctx context.Context) {
	if !a.cfg.WebSyncEnabled {
		log.Printf("EveryUp Web sync disabled")
		return
	}
	if a.web == nil || !a.web.Enabled() {
		log.Printf("EveryUp Web sync is enabled but web client is not configured")
		return
	}

	go func() {
		a.enrollWeb(ctx)
		a.flushWebServices(ctx)
		a.flushWebEvents(ctx)
		ticker := time.NewTicker(a.cfg.WebSyncInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.enrollWeb(ctx)
				a.flushWebServices(ctx)
				a.flushWebEvents(ctx)
				a.flushWebMetrics(ctx)
			}
		}
	}()
	log.Printf("EveryUp Web sync enabled")
}

func (a *Agent) startHeartbeat(ctx context.Context) {
	if a.heartbeat == nil || !a.heartbeat.Enabled() {
		log.Printf("Heartbeat watchdog disabled")
		return
	}

	go a.heartbeat.Run(ctx, a.cfg.HeartbeatInterval, func(err error) {
		log.Printf("heartbeat failed: %v", err)
		a.auditEvent("heartbeat_failed", "", "", err.Error(), nil)
	})
	log.Printf("Heartbeat watchdog enabled")
	a.auditEvent("heartbeat_started", "", "", "heartbeat watchdog enabled", map[string]interface{}{
		"url":      a.cfg.HeartbeatURL,
		"interval": a.cfg.HeartbeatInterval.String(),
	})
}

func (a *Agent) enrollWeb(ctx context.Context) {
	if a.webAgentID != "" {
		return
	}
	enrolled, err := a.web.Enroll(ctx, webclient.EnrollmentRequest{
		AgentName: a.cfg.AgentName,
		Mode:      "standalone",
		Version:   "dev",
	})
	if err != nil {
		log.Printf("EveryUp Web enrollment failed: %v", err)
		a.auditEvent("web_enrollment_failed", "", "", err.Error(), nil)
		return
	}
	a.webAgentID = enrolled.AgentID
	log.Printf("EveryUp Web enrollment complete: agentID=%s", a.webAgentID)
	a.auditEvent("web_enrolled", "", "", "EveryUp Web enrollment complete", map[string]interface{}{
		"agentID": a.webAgentID,
	})
}

func (a *Agent) flushWebEvents(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" {
		return
	}

	a.mu.Lock()
	if len(a.webEvents) == 0 {
		a.mu.Unlock()
		return
	}
	events := append([]state.AuditEvent(nil), a.webEvents...)
	a.webEvents = a.webEvents[:0]
	a.mu.Unlock()

	if err := a.web.SendEvents(ctx, webclient.EventRequest{AgentID: a.webAgentID, Events: events}); err != nil {
		log.Printf("EveryUp Web event sync failed: %v", err)
		a.mu.Lock()
		a.webEvents = append(events, a.webEvents...)
		if len(a.webEvents) > 500 {
			a.webEvents = a.webEvents[len(a.webEvents)-500:]
		}
		a.mu.Unlock()
		return
	}
	log.Printf("synced %d events to EveryUp Web", len(events))
}

func (a *Agent) flushWebServices(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" {
		return
	}

	snapshot := a.ChatOpsSnapshot(ctx)
	services := make([]webclient.ServiceSnapshot, 0, len(snapshot.Services))
	for _, service := range snapshot.Services {
		services = append(services, webclient.ServiceSnapshot{
			Key:         service.Key,
			Name:        service.Name,
			CheckType:   service.CheckType,
			Endpoint:    service.Endpoint,
			Healthy:     service.Healthy,
			Seen:        service.Seen,
			Silenced:    service.Silenced,
			LastError:   service.LastError,
			LastStatus:  service.LastStatus,
			LastLatency: service.LastLatency,
			UpdatedAt:   service.UpdatedAt,
		})
	}

	err := a.web.SendServices(ctx, webclient.ServiceSnapshotRequest{
		AgentID:    a.webAgentID,
		AgentName:  snapshot.AgentName,
		ObservedAt: snapshot.Now,
		Services:   services,
	})
	if err != nil {
		log.Printf("EveryUp Web service sync failed: %v", err)
		a.auditEvent("web_services_sync_failed", "", "", err.Error(), map[string]interface{}{
			"serviceCount": len(services),
		})
		return
	}
	log.Printf("synced %d services to EveryUp Web", len(services))
}

func (a *Agent) flushWebMetrics(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" || a.hostMetrics == nil {
		return
	}
	snapshot, err := a.hostMetrics.Snapshot(ctx)
	if err != nil {
		log.Printf("EveryUp Web metrics snapshot failed: %v", err)
		return
	}
	if err := a.web.SendMetrics(ctx, webclient.MetricsRequest{
		AgentID:    a.webAgentID,
		CPUUsage:   snapshot.CPUPercent,
		MemTotal:   snapshot.MemTotalGB,
		MemUsed:    snapshot.MemUsedGB,
		MemUsage:   snapshot.MemoryPercent,
		DiskTotal:  snapshot.DiskTotalGB,
		DiskUsed:   snapshot.DiskUsedGB,
		DiskUsage:  snapshot.DiskPercent,
		RecordedAt: time.Now(),
	}); err != nil {
		log.Printf("EveryUp Web metrics sync failed: %v", err)
	}
}

func (a *Agent) startChatOps(ctx context.Context) {
	if !a.cfg.ChatOpsEnabled {
		log.Printf("Telegram ChatOps disabled")
		return
	}
	handler := chatops.NewHandler(a, a)
	bot := chatops.NewTelegramBot(a.cfg.TelegramAPIBase, a.cfg.TelegramBotToken, a.cfg.TelegramChatIDs, handler, nil)
	go func() {
		if err := bot.Run(ctx); err != nil {
			log.Printf("Telegram ChatOps stopped: %v", err)
		}
	}()
	log.Printf("Telegram ChatOps enabled for %d allowed chats", len(a.cfg.TelegramChatIDs))
}

func (a *Agent) writeOTelConfig() {
	if !a.cfg.OTelConfigEnabled {
		log.Printf("OTel config generation disabled")
		return
	}

	err := otelconfig.WriteFile(otelconfig.Options{
		ServiceName:         a.cfg.ServiceName,
		OutputPath:          a.cfg.OTelConfigPath,
		ConfDir:             a.cfg.OTelConfDir,
		FileLogInclude:      a.cfg.OTelFileLogPaths,
		WebOTLPEndpoint:     a.cfg.WebOTLPEndpoint,
		WebAPIKey:           a.cfg.WebAPIKey,
		HostMetricsEnabled:  true,
		DockerStatsEnabled:  true,
		FileLogEnabled:      true,
		OTLPReceiverEnabled: true,
	})
	if err != nil {
		log.Printf("failed to generate OTel collector config: %v", err)
		a.auditEvent("otel_config_failed", a.cfg.ServiceName, "", err.Error(), map[string]interface{}{
			"path": a.cfg.OTelConfigPath,
		})
		return
	}

	log.Printf("generated OTel collector config at %s", a.cfg.OTelConfigPath)
	a.auditEvent("otel_config_generated", a.cfg.ServiceName, "", "generated OTel collector config", map[string]interface{}{
		"path": a.cfg.OTelConfigPath,
	})
}

func (a *Agent) runChecks(ctx context.Context) {
	targets := a.targets(ctx)
	if len(targets) == 0 {
		log.Printf("no health check targets found; set EVERYUP_HEALTH_URL or add Docker labels")
		a.runHostResourceCheck(ctx)
		return
	}

	for _, target := range targets {
		a.runCheck(ctx, target)
		a.runLogKeywordCheck(ctx, target)
		a.runResourceThresholdCheck(ctx, target)
	}
	a.runHostResourceCheck(ctx)
}

func (a *Agent) targets(ctx context.Context) []discovery.Target {
	targets := make([]discovery.Target, 0)
	if a.cfg.HealthURL != "" {
		targets = append(targets, discovery.Target{
			ID:          "env:" + a.cfg.ServiceName,
			ServiceName: a.cfg.ServiceName,
			HealthType:  "http",
			HealthURL:   a.cfg.HealthURL,
		})
	}

	if a.discoverer == nil {
		return targets
	}

	discovered, err := a.discoverer.ListTargets(ctx)
	if err != nil {
		log.Printf("docker discovery failed: %v", err)
		return targets
	}

	seen := make(map[string]bool, len(targets)+len(discovered))
	for _, target := range targets {
		seen[targetKey(target)] = true
	}
	for _, target := range discovered {
		key := targetKey(target)
		if seen[key] {
			continue
		}
		seen[key] = true
		targets = append(targets, target)
	}
	return targets
}

func (a *Agent) runCheck(ctx context.Context, target discovery.Target) {
	if target.HealthType == "tcp" {
		a.runTCPCheck(ctx, target)
		return
	}

	result := a.httpCheck.Check(ctx, target.HealthURL)
	log.Printf("health check: service=%s url=%s healthy=%t status=%d latency=%s error=%s",
		target.ServiceName, result.URL, result.Healthy, result.StatusCode, result.Latency, result.Error)

	now := time.Now()
	state := a.observeTarget(target, result.Healthy, result.StatusCode, result.Latency, result.Error)
	if result.Healthy {
		if state.seenResult && !state.wasHealthy {
			err := a.send(ctx, notifier.Message{
				AlertType:   notifier.AlertTypeHealthCheck,
				Severity:    notifier.SeverityInfo,
				ServiceName: target.ServiceName,
				Title:       "Service recovered",
				Body:        fmt.Sprintf("%s recovered in %s.", target.HealthURL, result.Latency.Round(time.Millisecond)),
				Time:        now,
			})
			if err != nil {
				a.auditEvent("recovery_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
					"url": target.HealthURL,
				})
			} else {
				a.auditEvent("recovery_sent", target.ServiceName, targetKey(target), "service recovered", map[string]interface{}{
					"url":     target.HealthURL,
					"latency": result.Latency.String(),
				})
			}
		}
		a.setTargetResult(target, state.lastAlertAt, true, true, now)
		a.saveState()
		return
	}

	shouldAlert := !state.seenResult || state.wasHealthy || now.Sub(state.lastAlertAt) >= a.cfg.AlertCooldown
	lastAlertAt := state.lastAlertAt
	if shouldAlert && a.isSilenced(target, now) {
		lastAlertAt = now
		a.auditEvent("alert_suppressed", target.ServiceName, targetKey(target), "target is silenced", map[string]interface{}{
			"url": target.HealthURL,
		})
	} else if shouldAlert {
		body := failureBody(result)
		body = a.enrichAlertBody(ctx, target, body, map[string]string{
			"statusCode": fmt.Sprintf("%d", result.StatusCode),
			"latency":    result.Latency.String(),
		})
		err := a.send(ctx, notifier.Message{
			AlertType:   notifier.AlertTypeHealthCheck,
			Severity:    notifier.SeverityCritical,
			ServiceName: target.ServiceName,
			Title:       "Service unhealthy",
			Body:        body,
			Time:        now,
		})
		lastAlertAt = now
		if err != nil {
			a.auditEvent("alert_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
				"url": target.HealthURL,
			})
		} else {
			a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
				"url":        target.HealthURL,
				"statusCode": result.StatusCode,
				"latency":    result.Latency.String(),
			})
		}
	}
	a.setTargetResult(target, lastAlertAt, false, true, now)
	a.saveState()
}

func (a *Agent) runTCPCheck(ctx context.Context, target discovery.Target) {
	result := a.tcpCheck.Check(ctx, target.HealthURL)
	log.Printf("tcp check: service=%s address=%s healthy=%t latency=%s error=%s",
		target.ServiceName, result.Address, result.Healthy, result.Latency, result.Error)

	now := time.Now()
	state := a.observeTarget(target, result.Healthy, 0, result.Latency, result.Error)
	if result.Healthy {
		if state.seenResult && !state.wasHealthy {
			err := a.send(ctx, notifier.Message{
				AlertType:   notifier.AlertTypeHealthCheck,
				Severity:    notifier.SeverityInfo,
				ServiceName: target.ServiceName,
				Title:       "Service recovered",
				Body:        fmt.Sprintf("%s recovered in %s.", target.HealthURL, result.Latency.Round(time.Millisecond)),
				Time:        now,
			})
			if err != nil {
				a.auditEvent("recovery_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
					"address": target.HealthURL,
				})
			} else {
				a.auditEvent("recovery_sent", target.ServiceName, targetKey(target), "service recovered", map[string]interface{}{
					"address": target.HealthURL,
					"latency": result.Latency.String(),
				})
			}
		}
		a.setTargetResult(target, state.lastAlertAt, true, true, now)
		a.saveState()
		return
	}

	shouldAlert := !state.seenResult || state.wasHealthy || now.Sub(state.lastAlertAt) >= a.cfg.AlertCooldown
	lastAlertAt := state.lastAlertAt
	if shouldAlert && a.isSilenced(target, now) {
		lastAlertAt = now
		a.auditEvent("alert_suppressed", target.ServiceName, targetKey(target), "target is silenced", map[string]interface{}{
			"address": target.HealthURL,
		})
	} else if shouldAlert {
		body := fmt.Sprintf("%s failed: %s", result.Address, result.Error)
		body = a.enrichAlertBody(ctx, target, body, map[string]string{
			"latency": result.Latency.String(),
		})
		err := a.send(ctx, notifier.Message{
			AlertType:   notifier.AlertTypeHealthCheck,
			Severity:    notifier.SeverityCritical,
			ServiceName: target.ServiceName,
			Title:       "Service unhealthy",
			Body:        body,
			Time:        now,
		})
		lastAlertAt = now
		if err != nil {
			a.auditEvent("alert_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
				"address": result.Address,
			})
		} else {
			a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
				"address": result.Address,
				"latency": result.Latency.String(),
			})
		}
	}
	a.setTargetResult(target, lastAlertAt, false, true, now)
	a.saveState()
}

func (a *Agent) observeTarget(target discovery.Target, healthy bool, statusCode int, latency time.Duration, errText string) targetState {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{wasHealthy: true}
		a.states[key] = state
	}
	state.serviceName = target.ServiceName
	state.checkType = target.HealthType
	state.endpoint = target.HealthURL
	state.lastStatus = statusCode
	state.lastLatency = latency.Round(time.Millisecond).String()
	state.lastError = errText
	if healthy {
		state.lastError = ""
	}
	return *state
}

func (a *Agent) setTargetResult(target discovery.Target, lastAlertAt time.Time, wasHealthy bool, seenResult bool, updatedAt time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{}
		a.states[key] = state
	}
	state.lastAlertAt = lastAlertAt
	state.wasHealthy = wasHealthy
	state.seenResult = seenResult
	state.updatedAt = updatedAt
}

func (a *Agent) loadState() error {
	snapshot, err := a.store.Load()
	if err != nil {
		return err
	}
	for key, persisted := range snapshot.Targets {
		a.states[key] = &targetState{
			lastAlertAt:         persisted.LastAlertAt,
			lastLogAlertAt:      persisted.LastLogAlertAt,
			lastResourceAlertAt: persisted.LastResourceAlertAt,
			lastHostAlertAt:     persisted.LastHostAlertAt,
			wasHealthy:          persisted.WasHealthy,
			seenResult:          persisted.SeenResult,
			updatedAt:           persisted.UpdatedAt,
		}
	}
	a.silences = snapshot.Silences
	a.actions = snapshot.Actions
	log.Printf("loaded %d persisted target states, %d silences, and %d actions", len(a.states), len(a.silences), len(a.actions))
	return nil
}

func (a *Agent) saveState() {
	a.mu.RLock()
	defer a.mu.RUnlock()
	snapshot := state.Snapshot{
		Version:  1,
		Targets:  make(map[string]state.TargetState, len(a.states)),
		Silences: make(map[string]state.Silence, len(a.silences)),
		Actions:  make(map[string]state.Action, len(a.actions)),
	}
	for key, current := range a.states {
		snapshot.Targets[key] = state.TargetState{
			LastAlertAt:         current.lastAlertAt,
			LastLogAlertAt:      current.lastLogAlertAt,
			LastResourceAlertAt: current.lastResourceAlertAt,
			LastHostAlertAt:     current.lastHostAlertAt,
			WasHealthy:          current.wasHealthy,
			SeenResult:          current.seenResult,
			UpdatedAt:           current.updatedAt,
		}
	}
	for key, silence := range a.silences {
		snapshot.Silences[key] = silence
	}
	for key, action := range a.actions {
		snapshot.Actions[key] = action
	}
	if err := a.store.Save(snapshot); err != nil {
		log.Printf("failed to save local state: %v", err)
	}
}

func (a *Agent) runLogKeywordCheck(ctx context.Context, target discovery.Target) {
	if a.logReader == nil || target.ID == "" || strings.HasPrefix(target.ID, "env:") {
		return
	}
	keywords := logKeywords(target.Labels)
	if len(keywords) == 0 {
		return
	}
	lines := logLineLimit(target.Labels)
	logLines, err := a.logReader.TailLogs(ctx, target.ID, lines)
	if err != nil {
		a.auditEvent("log_keyword_scan_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
			"lines": lines,
		})
		return
	}
	keyword, line, ok := matchLogKeyword(logLines, keywords)
	if !ok {
		return
	}

	now := time.Now()
	state := a.targetState(target)
	if state.lastLogAlertAt.IsZero() || now.Sub(state.lastLogAlertAt) >= a.cfg.AlertCooldown {
		if a.isSilenced(target, now) {
			a.setLogAlertAt(target, now)
			a.auditEvent("alert_suppressed", target.ServiceName, targetKey(target), "log keyword target is silenced", map[string]interface{}{
				"keyword": keyword,
			})
			a.saveState()
			return
		}
		body := fmt.Sprintf("Log keyword %q matched for %s:\n%s", keyword, target.ServiceName, trimText(line, 700))
		if err := a.send(ctx, notifier.Message{
			AlertType:   notifier.AlertTypeHealthCheck,
			Severity:    notifier.SeverityCritical,
			ServiceName: target.ServiceName,
			Title:       "Log keyword matched",
			Body:        body,
			Time:        now,
		}); err != nil {
			a.auditEvent("alert_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
				"source":  "log_keyword",
				"keyword": keyword,
			})
		} else {
			a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
				"source":  "log_keyword",
				"keyword": keyword,
				"line":    trimText(line, 700),
			})
		}
		a.setLogAlertAt(target, now)
		a.saveState()
	}
}

func (a *Agent) runResourceThresholdCheck(ctx context.Context, target discovery.Target) {
	if a.resourceReader == nil || target.ID == "" || strings.HasPrefix(target.ID, "env:") {
		return
	}
	cpuThreshold, memoryThreshold := resourceThresholds(target.Labels)
	if cpuThreshold == 0 && memoryThreshold == 0 {
		return
	}
	stats, err := a.resourceReader.ContainerStats(ctx, target.ID)
	if err != nil {
		a.auditEvent("resource_threshold_scan_failed", target.ServiceName, targetKey(target), err.Error(), nil)
		return
	}
	violations := make([]string, 0, 2)
	if cpuThreshold > 0 && stats.CPUPercent >= cpuThreshold {
		violations = append(violations, fmt.Sprintf("cpu %.1f%% >= %.1f%%", stats.CPUPercent, cpuThreshold))
	}
	if memoryThreshold > 0 && stats.MemoryPercent >= memoryThreshold {
		violations = append(violations, fmt.Sprintf("memory %.1f%% >= %.1f%%", stats.MemoryPercent, memoryThreshold))
	}
	if len(violations) == 0 {
		return
	}

	now := time.Now()
	state := a.targetState(target)
	if !state.lastResourceAlertAt.IsZero() && now.Sub(state.lastResourceAlertAt) < a.cfg.AlertCooldown {
		return
	}
	if a.isSilenced(target, now) {
		a.setResourceAlertAt(target, now)
		a.auditEvent("alert_suppressed", target.ServiceName, targetKey(target), "resource threshold target is silenced", map[string]interface{}{
			"violations": violations,
		})
		a.saveState()
		return
	}

	body := fmt.Sprintf("Resource threshold exceeded for %s:\n%s", target.ServiceName, strings.Join(violations, "\n"))
	if err := a.send(ctx, notifier.Message{
		AlertType:   notifier.AlertTypeHealthCheck,
		Severity:    notifier.SeverityCritical,
		ServiceName: target.ServiceName,
		Title:       "Resource threshold exceeded",
		Body:        body,
		Time:        now,
	}); err != nil {
		a.auditEvent("alert_send_failed", target.ServiceName, targetKey(target), err.Error(), map[string]interface{}{
			"source":     "resource_threshold",
			"violations": violations,
		})
	} else {
		a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
			"source":        "resource_threshold",
			"violations":    violations,
			"cpuPercent":    stats.CPUPercent,
			"memoryPercent": stats.MemoryPercent,
		})
	}
	a.setResourceAlertAt(target, now)
	a.saveState()
}

func (a *Agent) runHostResourceCheck(ctx context.Context) {
	if a.hostMetrics == nil {
		return
	}
	cpuThreshold := a.cfg.HostCPUPercent
	memoryThreshold := a.cfg.HostMemoryPercent
	diskThreshold := a.cfg.HostDiskPercent
	if cpuThreshold == 0 && memoryThreshold == 0 && diskThreshold == 0 {
		return
	}
	snapshot, err := a.hostMetrics.Snapshot(ctx)
	if err != nil {
		a.auditEvent("host_resource_scan_failed", a.cfg.ServiceName, "host:metrics", err.Error(), nil)
		return
	}
	violations := hostResourceViolations(snapshot, cpuThreshold, memoryThreshold, diskThreshold)
	if len(violations) == 0 {
		return
	}

	now := time.Now()
	if !a.hostAlertDue(now) {
		return
	}
	body := fmt.Sprintf("Host resource threshold exceeded:\n%s", strings.Join(violations, "\n"))
	if err := a.send(ctx, notifier.Message{
		AlertType:   notifier.AlertTypeHealthCheck,
		Severity:    notifier.SeverityCritical,
		ServiceName: "host",
		Title:       "Host resource threshold exceeded",
		Body:        body,
		Time:        now,
	}); err != nil {
		a.auditEvent("alert_send_failed", "host", "host:metrics", err.Error(), map[string]interface{}{
			"source":     "host_resource_threshold",
			"violations": violations,
		})
	} else {
		a.auditEvent("alert_sent", "host", "host:metrics", body, map[string]interface{}{
			"source":        "host_resource_threshold",
			"violations":    violations,
			"cpuPercent":    snapshot.CPUPercent,
			"memoryPercent": snapshot.MemoryPercent,
			"diskPercent":   snapshot.DiskPercent,
		})
	}
	a.setHostAlertAt(now)
	a.saveState()
}

func hostResourceViolations(snapshot hostmetrics.Snapshot, cpuThreshold, memoryThreshold, diskThreshold float64) []string {
	violations := make([]string, 0, 3)
	if cpuThreshold > 0 && snapshot.CPUPercent >= cpuThreshold {
		violations = append(violations, fmt.Sprintf("host cpu %.1f%% >= %.1f%%", snapshot.CPUPercent, cpuThreshold))
	}
	if memoryThreshold > 0 && snapshot.MemoryPercent >= memoryThreshold {
		violations = append(violations, fmt.Sprintf("host memory %.1f%% >= %.1f%%", snapshot.MemoryPercent, memoryThreshold))
	}
	if diskThreshold > 0 && snapshot.DiskPercent >= diskThreshold {
		violations = append(violations, fmt.Sprintf("host disk %.1f%% >= %.1f%%", snapshot.DiskPercent, diskThreshold))
	}
	return violations
}

func (a *Agent) targetState(target discovery.Target) targetState {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if state, ok := a.states[targetKey(target)]; ok {
		return *state
	}
	return targetState{}
}

func (a *Agent) hostAlertDue(now time.Time) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	state, ok := a.states["host:metrics"]
	if !ok || state.lastHostAlertAt.IsZero() {
		return true
	}
	return now.Sub(state.lastHostAlertAt) >= a.cfg.AlertCooldown
}

func (a *Agent) setHostAlertAt(at time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	state, ok := a.states["host:metrics"]
	if !ok {
		state = &targetState{serviceName: "host", checkType: "hostmetrics", endpoint: a.cfg.HostMetricsRoot}
		a.states["host:metrics"] = state
	}
	state.lastHostAlertAt = at
	state.updatedAt = at
}

func (a *Agent) setLogAlertAt(target discovery.Target, at time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{serviceName: target.ServiceName, checkType: target.HealthType, endpoint: target.HealthURL}
		a.states[key] = state
	}
	state.lastLogAlertAt = at
}

func (a *Agent) setResourceAlertAt(target discovery.Target, at time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{serviceName: target.ServiceName, checkType: target.HealthType, endpoint: target.HealthURL}
		a.states[key] = state
	}
	state.lastResourceAlertAt = at
}

func (a *Agent) isSilenced(target discovery.Target, now time.Time) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	silence, ok := a.silences[targetKey(target)]
	if !ok {
		return false
	}
	if silence.Until.IsZero() {
		return true
	}
	if now.Before(silence.Until) {
		return true
	}
	delete(a.silences, targetKey(target))
	return false
}

func (a *Agent) ChatOpsSnapshot(ctx context.Context) chatops.Snapshot {
	a.mu.RLock()
	defer a.mu.RUnlock()

	services := make([]chatops.ServiceStatus, 0, len(a.states))
	now := time.Now()
	for key, current := range a.states {
		silenced := false
		if silence, ok := a.silences[key]; ok {
			silenced = silence.Until.IsZero() || now.Before(silence.Until)
		}
		services = append(services, chatops.ServiceStatus{
			Key:         key,
			Name:        valueOrDefault(current.serviceName, key),
			CheckType:   current.checkType,
			Endpoint:    current.endpoint,
			Healthy:     current.wasHealthy,
			Seen:        current.seenResult,
			Silenced:    silenced,
			LastError:   current.lastError,
			LastStatus:  current.lastStatus,
			LastLatency: current.lastLatency,
			UpdatedAt:   current.updatedAt,
		})
	}

	return chatops.Snapshot{
		AgentName: a.cfg.AgentName,
		Now:       now,
		Services:  services,
	}
}

func (a *Agent) ExplainService(ctx context.Context, serviceRef string) string {
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}

	raw := serviceExplanation(service)
	raw += a.runbookAdviceForService(service, raw)
	if a.summarizer == nil {
		return raw
	}

	summary, err := a.summarizer.Summarize(ctx, llm.IncidentContext{
		ServiceName: service.Name,
		TargetKey:   service.Key,
		CheckType:   service.CheckType,
		Endpoint:    service.Endpoint,
		Severity:    severityForService(service),
		Message:     raw,
		ObservedAt:  time.Now(),
		Attributes: map[string]string{
			"lastError":   service.LastError,
			"lastStatus":  fmt.Sprintf("%d", service.LastStatus),
			"lastLatency": service.LastLatency,
			"silenced":    fmt.Sprintf("%t", service.Silenced),
		},
	})
	if err != nil {
		a.auditEvent("chatops_explain_degraded", service.Name, service.Key, err.Error(), nil)
		return raw + "\n\nAI explanation unavailable; showing latest local state."
	}
	a.auditEvent("chatops_explain_generated", service.Name, service.Key, summary.Title, map[string]interface{}{
		"risk":       summary.Risk,
		"confidence": summary.Confidence,
	})
	return raw + llm.FormatSummary(summary)
}

func (a *Agent) SilenceService(ctx context.Context, serviceRef string, duration time.Duration, reason string) string {
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}

	now := time.Now()
	silence := state.Silence{
		Until:     now.Add(duration),
		Reason:    reason,
		CreatedAt: now,
	}

	a.mu.Lock()
	a.silences[service.Key] = silence
	a.mu.Unlock()
	a.saveState()

	message := fmt.Sprintf("Silenced %s until %s", service.Name, silence.Until.Format(time.RFC3339))
	if reason != "" {
		message += "\nReason: " + reason
	}
	a.auditEvent("silence_created", service.Name, service.Key, message, map[string]interface{}{
		"duration": duration.String(),
		"reason":   reason,
	})
	return message
}

func (a *Agent) ServiceLogs(ctx context.Context, serviceRef string, lines int) string {
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}
	if a.logReader == nil {
		return "Docker logs are not available. Enable Docker discovery and mount the Docker socket."
	}
	if service.Key == "" || strings.HasPrefix(service.Key, "env:") {
		return fmt.Sprintf("Service %s is not backed by a discovered Docker container.", service.Name)
	}

	logLines, err := a.logReader.TailLogs(ctx, service.Key, lines)
	if err != nil {
		a.auditEvent("chatops_logs_failed", service.Name, service.Key, err.Error(), map[string]interface{}{
			"lines": lines,
		})
		return fmt.Sprintf("Failed to read logs for %s: %v", service.Name, err)
	}
	if len(logLines) == 0 {
		return fmt.Sprintf("No recent logs for %s.", service.Name)
	}

	a.auditEvent("chatops_logs_read", service.Name, service.Key, "read docker logs", map[string]interface{}{
		"lines": lines,
	})
	return formatLogs(service.Name, logLines)
}

func (a *Agent) RequestRestart(ctx context.Context, chatID, serviceRef string) string {
	if !a.cfg.ActionsEnabled {
		return "Actions are disabled. Set EVERYUP_ACTIONS_ENABLED=true to enable approved actions."
	}
	if !a.actionAllowed("restart") {
		return "Restart action is not allowed. Add restart to EVERYUP_ACTION_ALLOWLIST."
	}
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}
	if service.Key == "" || strings.HasPrefix(service.Key, "env:") {
		return fmt.Sprintf("Service %s is not backed by a discovered Docker container.", service.Name)
	}

	token, err := newActionToken()
	if err != nil {
		a.auditEvent("action_request_failed", service.Name, service.Key, err.Error(), nil)
		return "Failed to create action token."
	}
	now := time.Now()
	action := state.Action{
		Token:       token,
		Type:        "restart",
		ServiceKey:  service.Key,
		ServiceName: service.Name,
		Status:      "pending",
		DryRun:      a.cfg.ActionDryRun,
		RequestedBy: chatID,
		CreatedAt:   now,
		ExpiresAt:   now.Add(a.cfg.ActionConfirmTTL),
	}

	a.mu.Lock()
	a.actions[token] = action
	a.mu.Unlock()
	a.saveState()

	a.auditEvent("action_requested", service.Name, service.Key, "restart requested", map[string]interface{}{
		"token":       token,
		"requestedBy": chatID,
		"dryRun":      action.DryRun,
	})
	mode := "will restart"
	if action.DryRun {
		mode = "dry-run only"
	}
	return fmt.Sprintf("Restart requested for %s (%s).\nToken: %s\nExpires: %s\nConfirm with: /confirm %s", service.Name, mode, token, action.ExpiresAt.Format(time.RFC3339), token)
}

func (a *Agent) ConfirmAction(ctx context.Context, chatID, token string) string {
	token = strings.TrimSpace(token)
	now := time.Now()

	a.mu.Lock()
	action, ok := a.actions[token]
	if !ok {
		a.mu.Unlock()
		return "No pending action found for that token."
	}
	if action.Status != "pending" {
		a.mu.Unlock()
		return fmt.Sprintf("Action %s is already %s.", token, action.Status)
	}
	if !action.ExpiresAt.IsZero() && now.After(action.ExpiresAt) {
		action.Status = "expired"
		action.Message = "confirmation token expired"
		a.actions[token] = action
		a.mu.Unlock()
		a.saveState()
		return "Action token expired."
	}
	action.ConfirmedAt = now
	a.actions[token] = action
	a.mu.Unlock()

	var message string
	if action.DryRun {
		message = fmt.Sprintf("Dry-run confirmed for %s. No container was restarted.", action.ServiceName)
		action.Status = "dry_run"
		action.Message = message
	} else if a.actionRunner == nil {
		message = "Docker actions are not available. Mount the Docker socket and enable Docker discovery."
		action.Status = "failed"
		action.Message = message
	} else {
		err := a.actionRunner.RestartContainer(ctx, action.ServiceKey, 10)
		if err != nil {
			message = fmt.Sprintf("Restart failed for %s: %v", action.ServiceName, err)
			action.Status = "failed"
			action.Message = err.Error()
		} else {
			message = fmt.Sprintf("Restarted %s.", action.ServiceName)
			action.Status = "completed"
			action.Message = message
		}
	}

	a.mu.Lock()
	a.actions[token] = action
	a.mu.Unlock()
	a.saveState()
	a.auditEvent("action_confirmed", action.ServiceName, action.ServiceKey, message, map[string]interface{}{
		"token":       token,
		"confirmedBy": chatID,
		"status":      action.Status,
		"dryRun":      action.DryRun,
	})
	return message
}

func (a *Agent) PendingActions(ctx context.Context) string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	now := time.Now()
	pending := make([]state.Action, 0)
	for _, action := range a.actions {
		if action.Status == "pending" && (action.ExpiresAt.IsZero() || now.Before(action.ExpiresAt)) {
			pending = append(pending, action)
		}
	}
	if len(pending) == 0 {
		return "No pending actions."
	}
	sort.Slice(pending, func(i, j int) bool {
		return pending[i].CreatedAt.Before(pending[j].CreatedAt)
	})

	var b strings.Builder
	b.WriteString("Pending actions")
	for _, action := range pending {
		b.WriteString("\n- ")
		b.WriteString(action.Type)
		b.WriteString(" ")
		b.WriteString(action.ServiceName)
		b.WriteString(" token=")
		b.WriteString(action.Token)
		b.WriteString(" expires=")
		b.WriteString(action.ExpiresAt.Format(time.RFC3339))
		if action.DryRun {
			b.WriteString(" dry-run")
		}
	}
	return b.String()
}

func (a *Agent) SimilarIncidents(ctx context.Context, serviceRef string) string {
	if a.memory == nil {
		return "Incident memory is disabled."
	}
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}
	matches, err := a.memory.Similar(ctx, memory.Incident{
		ServiceName: service.Name,
		TargetKey:   service.Key,
		Message:     serviceExplanation(service),
	}, 5)
	if err != nil {
		return fmt.Sprintf("Failed to search incident memory: %v", err)
	}
	return memory.FormatSimilar(matches)
}

func (a *Agent) PostmortemDraft(ctx context.Context, serviceRef string) string {
	if a.memory == nil {
		return "Incident memory is disabled."
	}
	service, ok := a.findServiceStatus(serviceRef)
	if !ok {
		return fmt.Sprintf("Service %q was not found.", serviceRef)
	}
	latest, found, err := a.memory.LatestForService(ctx, service.Name, service.Key)
	if err != nil {
		return fmt.Sprintf("Failed to read incident memory: %v", err)
	}
	if !found {
		return "No incident history found for that service."
	}
	matches, err := a.memory.Similar(ctx, latest, 5)
	if err != nil {
		return fmt.Sprintf("Failed to search similar incidents: %v", err)
	}
	filtered := make([]memory.SimilarIncident, 0, len(matches))
	for _, match := range matches {
		if match.Incident.ID != latest.ID {
			filtered = append(filtered, match)
		}
	}
	return memory.DraftPostmortem(latest, filtered)
}

func (a *Agent) AuditChatOps(eventType, chatID, command, message string) {
	a.auditEvent(eventType, "", "", message, map[string]interface{}{
		"chatID":  chatID,
		"command": command,
	})
}

func (a *Agent) actionAllowed(action string) bool {
	if len(a.cfg.ActionAllowlist) == 0 {
		return false
	}
	for _, item := range a.cfg.ActionAllowlist {
		item = strings.ToLower(strings.TrimSpace(item))
		if item == "*" || item == strings.ToLower(action) {
			return true
		}
	}
	return false
}

func (a *Agent) findServiceStatus(serviceRef string) (chatops.ServiceStatus, bool) {
	ref := strings.ToLower(strings.TrimSpace(serviceRef))
	if ref == "" {
		return chatops.ServiceStatus{}, false
	}
	snapshot := a.ChatOpsSnapshot(context.Background())
	for _, service := range snapshot.Services {
		if strings.ToLower(service.Name) == ref || strings.ToLower(service.Key) == ref {
			return service, true
		}
	}
	for _, service := range snapshot.Services {
		if strings.Contains(strings.ToLower(service.Name), ref) {
			return service, true
		}
	}
	return chatops.ServiceStatus{}, false
}

func serviceExplanation(service chatops.ServiceStatus) string {
	state := "unknown"
	if service.Seen && service.Healthy {
		state = "healthy"
	}
	if service.Seen && !service.Healthy {
		state = "unhealthy"
	}
	if service.Silenced {
		state += " (silenced)"
	}

	var b strings.Builder
	b.WriteString("Service: ")
	b.WriteString(service.Name)
	b.WriteString("\nState: ")
	b.WriteString(state)
	b.WriteString("\nCheck: ")
	b.WriteString(service.CheckType)
	b.WriteString(" ")
	b.WriteString(service.Endpoint)
	if service.LastStatus != 0 {
		b.WriteString("\nLast status: ")
		b.WriteString(fmt.Sprintf("%d", service.LastStatus))
	}
	if service.LastLatency != "" {
		b.WriteString("\nLast latency: ")
		b.WriteString(service.LastLatency)
	}
	if service.LastError != "" {
		b.WriteString("\nLast error: ")
		b.WriteString(service.LastError)
	}
	if !service.UpdatedAt.IsZero() {
		b.WriteString("\nUpdated: ")
		b.WriteString(service.UpdatedAt.Format(time.RFC3339))
	}
	return b.String()
}

func severityForService(service chatops.ServiceStatus) string {
	if service.Seen && !service.Healthy {
		return notifier.SeverityCritical
	}
	return notifier.SeverityInfo
}

func formatLogs(serviceName string, lines []string) string {
	var b strings.Builder
	b.WriteString("Logs for ")
	b.WriteString(serviceName)
	for _, line := range lines {
		b.WriteString("\n")
		if len(line) > 500 {
			line = line[:500] + "..."
		}
		b.WriteString(line)
	}
	return b.String()
}

func (a *Agent) enrichAlertBody(ctx context.Context, target discovery.Target, rawBody string, attrs map[string]string) string {
	advice := a.runbookAdviceForTarget(target, rawBody, attrs)
	if a.summarizer == nil {
		return rawBody + advice
	}

	incident := llm.IncidentContext{
		ServiceName: target.ServiceName,
		TargetKey:   targetKey(target),
		CheckType:   target.HealthType,
		Endpoint:    target.HealthURL,
		Severity:    notifier.SeverityCritical,
		Message:     rawBody,
		ObservedAt:  time.Now(),
		Attributes:  attrs,
	}
	summary, err := a.summarizer.Summarize(ctx, incident)
	if err != nil {
		log.Printf("LLM summary failed: %v", err)
		a.auditEvent("llm_summary_failed", target.ServiceName, targetKey(target), err.Error(), nil)
		return rawBody + advice
	}
	a.auditEvent("llm_summary_generated", target.ServiceName, targetKey(target), summary.Title, map[string]interface{}{
		"risk":       summary.Risk,
		"confidence": summary.Confidence,
	})
	return rawBody + llm.FormatSummary(summary) + advice
}

func (a *Agent) runbookAdviceForTarget(target discovery.Target, message string, attrs map[string]string) string {
	if a.runbooks == nil {
		return ""
	}
	status := 0
	if value := attrs["statusCode"]; value != "" {
		_, _ = fmt.Sscanf(value, "%d", &status)
	}
	recommendations := a.runbooks.Match(runbook.Incident{
		ServiceName: target.ServiceName,
		CheckType:   target.HealthType,
		Endpoint:    target.HealthURL,
		Message:     message,
		LastError:   attrs["error"],
		LastStatus:  status,
	}, 2)
	return runbook.FormatRecommendations(recommendations)
}

func (a *Agent) runbookAdviceForService(service chatops.ServiceStatus, message string) string {
	if a.runbooks == nil {
		return ""
	}
	recommendations := a.runbooks.Match(runbook.Incident{
		ServiceName: service.Name,
		CheckType:   service.CheckType,
		Endpoint:    service.Endpoint,
		Message:     message,
		LastError:   service.LastError,
		LastStatus:  service.LastStatus,
	}, 2)
	return runbook.FormatRecommendations(recommendations)
}

func (a *Agent) auditEvent(eventType, serviceName, key, message string, metadata map[string]interface{}) {
	event := state.AuditEvent{
		Time:        time.Now(),
		Type:        eventType,
		ServiceName: serviceName,
		TargetKey:   key,
		Message:     message,
		Metadata:    metadata,
	}
	if err := a.audit.Append(event); err != nil {
		log.Printf("failed to append audit event: %v", err)
	}
	a.recordMemoryEvent(event)
	a.enqueueWebEvent(event)
}

func (a *Agent) recordMemoryEvent(event state.AuditEvent) {
	if a.memory == nil {
		return
	}
	ctx := context.Background()
	switch event.Type {
	case "alert_sent":
		if err := a.memory.RecordAlert(ctx, memory.Incident{
			StartedAt:   event.Time,
			ServiceName: event.ServiceName,
			TargetKey:   event.TargetKey,
			Severity:    "critical",
			Message:     event.Message,
			Fingerprint: memory.Fingerprint(event.ServiceName, event.TargetKey, event.Message),
			Metadata:    event.Metadata,
		}); err != nil {
			log.Printf("failed to record incident memory: %v", err)
		}
	case "recovery_sent":
		if err := a.memory.ResolveLatest(ctx, event.ServiceName, event.TargetKey, event.Time); err != nil {
			log.Printf("failed to resolve incident memory: %v", err)
		}
	case "chatops_command":
		if err := a.memory.RecordCommand(ctx, memory.Command{
			Time:    event.Time,
			ChatID:  metadataString(event.Metadata, "chatID"),
			Command: metadataString(event.Metadata, "command"),
			Message: event.Message,
		}); err != nil {
			log.Printf("failed to record command memory: %v", err)
		}
	}
}

func (a *Agent) enqueueWebEvent(event state.AuditEvent) {
	if !a.cfg.WebSyncEnabled {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.webEvents = append(a.webEvents, event)
	if len(a.webEvents) > 500 {
		a.webEvents = a.webEvents[len(a.webEvents)-500:]
	}
}

func targetKey(target discovery.Target) string {
	if target.ID != "" {
		return target.ID
	}
	return target.ServiceName + "|" + target.HealthURL
}

func (a *Agent) send(ctx context.Context, msg notifier.Message) error {
	if err := a.notifier.Send(ctx, msg); err != nil {
		log.Printf("failed to send notification: %v", err)
		return err
	}
	return nil
}

func failureBody(result checks.HTTPResult) string {
	if result.Error != "" {
		return fmt.Sprintf("%s failed: %s", result.URL, result.Error)
	}
	return fmt.Sprintf("%s returned status %d in %s", result.URL, result.StatusCode, result.Latency.Round(time.Millisecond))
}

func logKeywords(labels map[string]string) []string {
	if labels == nil {
		return nil
	}
	parts := strings.Split(labels[discovery.LabelLogKeywords], ",")
	keywords := make([]string, 0, len(parts))
	for _, part := range parts {
		keyword := strings.TrimSpace(part)
		if keyword != "" {
			keywords = append(keywords, keyword)
		}
	}
	return keywords
}

func logLineLimit(labels map[string]string) int {
	const fallback = 100
	if labels == nil {
		return fallback
	}
	var lines int
	if _, err := fmt.Sscanf(strings.TrimSpace(labels[discovery.LabelLogLines]), "%d", &lines); err != nil {
		return fallback
	}
	if lines <= 0 {
		return fallback
	}
	if lines > 500 {
		return 500
	}
	return lines
}

func resourceThresholds(labels map[string]string) (float64, float64) {
	if labels == nil {
		return 0, 0
	}
	return percentLabel(labels[discovery.LabelCPUPercent]), percentLabel(labels[discovery.LabelMemoryPercent])
}

func percentLabel(value string) float64 {
	value = strings.TrimSpace(strings.TrimSuffix(value, "%"))
	if value == "" {
		return 0
	}
	var parsed float64
	if _, err := fmt.Sscanf(value, "%f", &parsed); err != nil {
		return 0
	}
	if parsed <= 0 {
		return 0
	}
	if parsed > 100 {
		return 100
	}
	return parsed
}

func matchLogKeyword(lines []string, keywords []string) (string, string, bool) {
	loweredKeywords := make([]string, 0, len(keywords))
	for _, keyword := range keywords {
		keyword = strings.TrimSpace(keyword)
		if keyword != "" {
			loweredKeywords = append(loweredKeywords, strings.ToLower(keyword))
		}
	}
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]
		loweredLine := strings.ToLower(line)
		for idx, keyword := range loweredKeywords {
			if strings.Contains(loweredLine, keyword) {
				return keywords[idx], line, true
			}
		}
	}
	return "", "", false
}

func trimText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}

func valueOrDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func metadataString(metadata map[string]interface{}, key string) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata[key]
	if !ok {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}

func newActionToken() (string, error) {
	var bytes [4]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes[:]), nil
}
