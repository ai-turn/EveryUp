package chatops

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

type ServiceStatus struct {
	Key         string
	Name        string
	CheckType   string
	Endpoint    string
	Healthy     bool
	Seen        bool
	Silenced    bool
	LastError   string
	LastStatus  int
	LastLatency string
	UpdatedAt   time.Time
}

type Snapshot struct {
	AgentName string
	Now       time.Time
	Services  []ServiceStatus
}

type StatusProvider interface {
	ChatOpsSnapshot(ctx context.Context) Snapshot
}

type Explainer interface {
	ExplainService(ctx context.Context, serviceRef string) string
}

type SilenceManager interface {
	SilenceService(ctx context.Context, serviceRef string, duration time.Duration, reason string) string
}

type LogReader interface {
	ServiceLogs(ctx context.Context, serviceRef string, lines int) string
}

type ActionManager interface {
	RequestRestart(ctx context.Context, chatID, serviceRef string) string
	ConfirmAction(ctx context.Context, chatID, token string) string
	PendingActions(ctx context.Context) string
}

type MemoryReader interface {
	SimilarIncidents(ctx context.Context, serviceRef string) string
	PostmortemDraft(ctx context.Context, serviceRef string) string
}

type AuditLogger interface {
	AuditChatOps(eventType, chatID, command, message string)
}

type Handler struct {
	provider  StatusProvider
	explainer Explainer
	silencer  SilenceManager
	logReader LogReader
	actions   ActionManager
	memory    MemoryReader
	audit     AuditLogger
}

func NewHandler(provider StatusProvider, audit AuditLogger) *Handler {
	handler := &Handler{provider: provider, audit: audit}
	if explainer, ok := provider.(Explainer); ok {
		handler.explainer = explainer
	}
	if silencer, ok := provider.(SilenceManager); ok {
		handler.silencer = silencer
	}
	if logReader, ok := provider.(LogReader); ok {
		handler.logReader = logReader
	}
	if actions, ok := provider.(ActionManager); ok {
		handler.actions = actions
	}
	if memory, ok := provider.(MemoryReader); ok {
		handler.memory = memory
	}
	return handler
}

func (h *Handler) Handle(ctx context.Context, chatID, text string) string {
	command := strings.Fields(strings.TrimSpace(text))
	if len(command) == 0 {
		return ""
	}

	name := strings.ToLower(command[0])
	if strings.Contains(name, "@") {
		name = strings.SplitN(name, "@", 2)[0]
	}

	var response string
	switch name {
	case "/start", "/help":
		response = helpText()
	case "/status":
		response = h.status(ctx)
	case "/services":
		response = h.services(ctx)
	case "/explain":
		response = h.explain(ctx, command)
	case "/silence":
		response = h.silence(ctx, command)
	case "/logs":
		response = h.logs(ctx, command)
	case "/restart":
		response = h.restart(ctx, chatID, command)
	case "/confirm":
		response = h.confirm(ctx, chatID, command)
	case "/actions":
		response = h.actionsList(ctx)
	case "/memory":
		response = h.memorySearch(ctx, command)
	case "/postmortem":
		response = h.postmortem(ctx, command)
	default:
		response = "Unknown command. Try /status, /services, /logs, /explain, /silence, /memory, /postmortem, /restart, /confirm, or /actions."
	}

	if h.audit != nil {
		h.audit.AuditChatOps("chatops_command", chatID, name, response)
	}
	return response
}

func (h *Handler) memorySearch(ctx context.Context, command []string) string {
	if len(command) < 2 {
		return "Usage: /memory <service>"
	}
	if h.memory == nil {
		return "Incident memory is not available."
	}
	return h.memory.SimilarIncidents(ctx, command[1])
}

func (h *Handler) postmortem(ctx context.Context, command []string) string {
	if len(command) < 2 {
		return "Usage: /postmortem <service>"
	}
	if h.memory == nil {
		return "Incident memory is not available."
	}
	return h.memory.PostmortemDraft(ctx, command[1])
}

func (h *Handler) restart(ctx context.Context, chatID string, command []string) string {
	if len(command) < 2 {
		return "Usage: /restart <service>"
	}
	if h.actions == nil {
		return "Actions are not available."
	}
	return h.actions.RequestRestart(ctx, chatID, command[1])
}

func (h *Handler) confirm(ctx context.Context, chatID string, command []string) string {
	if len(command) < 2 {
		return "Usage: /confirm <token>"
	}
	if h.actions == nil {
		return "Actions are not available."
	}
	return h.actions.ConfirmAction(ctx, chatID, command[1])
}

func (h *Handler) actionsList(ctx context.Context) string {
	if h.actions == nil {
		return "Actions are not available."
	}
	return h.actions.PendingActions(ctx)
}

func (h *Handler) logs(ctx context.Context, command []string) string {
	if len(command) < 2 {
		return "Usage: /logs <service> [lines]"
	}
	if h.logReader == nil {
		return "Logs are not available."
	}
	lines := 50
	if len(command) >= 3 {
		parsed, err := parseLineCount(command[2])
		if err != nil {
			return "Invalid line count. Use a number from 1 to 200."
		}
		lines = parsed
	}
	return h.logReader.ServiceLogs(ctx, command[1], lines)
}

func (h *Handler) explain(ctx context.Context, command []string) string {
	if len(command) < 2 {
		return "Usage: /explain <service>"
	}
	if h.explainer == nil {
		return "Explain is not available."
	}
	return h.explainer.ExplainService(ctx, command[1])
}

func (h *Handler) silence(ctx context.Context, command []string) string {
	if len(command) < 3 {
		return "Usage: /silence <service> <duration> [reason]"
	}
	if h.silencer == nil {
		return "Silence is not available."
	}
	duration, err := ParseDuration(command[2])
	if err != nil {
		return "Invalid duration. Use values like 10m, 1h, or 2h30m."
	}
	reason := ""
	if len(command) > 3 {
		reason = strings.Join(command[3:], " ")
	}
	return h.silencer.SilenceService(ctx, command[1], duration, reason)
}

func (h *Handler) status(ctx context.Context) string {
	snapshot := h.provider.ChatOpsSnapshot(ctx)
	total := len(snapshot.Services)
	healthy := 0
	unhealthy := 0
	unknown := 0
	silenced := 0
	for _, service := range snapshot.Services {
		if service.Silenced {
			silenced++
		}
		if !service.Seen {
			unknown++
			continue
		}
		if service.Healthy {
			healthy++
		} else {
			unhealthy++
		}
	}

	return fmt.Sprintf(
		"EveryUp Agent status\nAgent: %s\nServices: %d total, %d healthy, %d unhealthy, %d unknown, %d silenced\nTime: %s",
		snapshot.AgentName,
		total,
		healthy,
		unhealthy,
		unknown,
		silenced,
		snapshot.Now.Format(time.RFC3339),
	)
}

func (h *Handler) services(ctx context.Context) string {
	snapshot := h.provider.ChatOpsSnapshot(ctx)
	if len(snapshot.Services) == 0 {
		return "No services discovered yet."
	}

	services := append([]ServiceStatus(nil), snapshot.Services...)
	sort.Slice(services, func(i, j int) bool {
		return services[i].Name < services[j].Name
	})

	var b strings.Builder
	b.WriteString("EveryUp services")
	for _, service := range services {
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
		b.WriteString("\n- ")
		b.WriteString(service.Name)
		b.WriteString(": ")
		b.WriteString(state)
		b.WriteString(" [")
		b.WriteString(service.CheckType)
		b.WriteString("] ")
		b.WriteString(service.Endpoint)
		if service.LastError != "" {
			b.WriteString(" - ")
			b.WriteString(service.LastError)
		}
	}
	return b.String()
}

func helpText() string {
	return "EveryUp Agent commands\n/status - show health summary\n/services - list discovered services\n/logs <service> [lines] - show recent Docker logs\n/explain <service> - explain latest service state\n/silence <service> <duration> [reason] - suppress alerts temporarily\n/memory <service> - show similar incidents\n/postmortem <service> - draft a postmortem\n/restart <service> - request approved restart\n/confirm <token> - confirm pending action\n/actions - list pending actions"
}

func ParseDuration(value string) (time.Duration, error) {
	duration, err := time.ParseDuration(value)
	if err != nil {
		return 0, err
	}
	if duration <= 0 {
		return 0, fmt.Errorf("duration must be greater than zero")
	}
	if duration > 7*24*time.Hour {
		return 0, fmt.Errorf("duration must be 7 days or less")
	}
	return duration, nil
}

func parseLineCount(value string) (int, error) {
	var count int
	if _, err := fmt.Sscanf(value, "%d", &count); err != nil {
		return 0, err
	}
	if count <= 0 || count > 200 {
		return 0, fmt.Errorf("line count out of range")
	}
	return count, nil
}
