package alerter

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// RuleEvaluator evaluates alert rules against incoming metrics.
type RuleEvaluator struct {
	manager         *Manager
	repo            *database.AlertRuleRepository
	stateRepo       *database.AlertRuleStateRepository
	collectInterval int // seconds

	mu           sync.Mutex
	breachCounts map[string]int       // ruleKey → consecutive breach count
	lastAlerted  map[string]time.Time // ruleKey → last alert time (for cooldown)
	wasAlerting  map[string]bool      // ruleKey → whether an alert was fired (for recovery)
}

// NewRuleEvaluator creates a new evaluator.
func NewRuleEvaluator(manager *Manager, collectInterval int) *RuleEvaluator {
	if collectInterval <= 0 {
		collectInterval = 5
	}
	evaluator := &RuleEvaluator{
		manager:         manager,
		repo:            database.NewAlertRuleRepository(),
		stateRepo:       database.NewAlertRuleStateRepository(),
		collectInterval: collectInterval,
		breachCounts:    make(map[string]int),
		lastAlerted:     make(map[string]time.Time),
		wasAlerting:     make(map[string]bool),
	}

	// Load persisted state
	evaluator.LoadState()

	return evaluator
}

// Evaluate checks all enabled rules for a host against the given metric snapshot.
// This is called by CollectorManager after each metric collection.
func (e *RuleEvaluator) Evaluate(hostID, hostName string, metric *models.SystemMetric) {
	if metric == nil {
		return
	}

	rules, err := e.repo.GetEnabledByHostID(hostID)
	if err != nil {
		log.Printf("[Evaluator] Failed to get rules for host %s: %v", hostID, err)
		return
	}

	for _, rule := range rules {
		e.evaluateRule(rule, hostID, hostName, metric)
	}
}

// evaluateRule evaluates a single rule against the metric.
// Pattern: all shared-state mutations happen under the lock, then the lock is released
// before launching goroutines — minimising lock-hold time and avoiding confusing
// "goroutine launched while defer'd unlock is pending" patterns.
func (e *RuleEvaluator) evaluateRule(rule models.AlertRule, hostID, hostName string, metric *models.SystemMetric) {
	value := extractMetricValue(rule.Metric, metric)
	breached := compareValue(value, rule.Operator, rule.Threshold)
	ruleKey := e.ruleKey(rule.ID, hostID)

	// ── critical section: read/write in-memory state ───────────────────────
	e.mu.Lock()

	var toDispatch *Notification // non-nil when we need to send an alert/recovery

	if breached {
		e.breachCounts[ruleKey]++
		requiredCount := (rule.Duration * 60) / e.collectInterval
		if requiredCount < 1 {
			requiredCount = 1
		}

		if e.breachCounts[ruleKey] >= requiredCount {
			// Still in cooldown? Skip alert but keep state dirty for SaveState below.
			if last, ok := e.lastAlerted[ruleKey]; ok {
				if time.Since(last) < time.Duration(rule.Cooldown)*time.Second {
					e.mu.Unlock()
					return // Still in cooldown — no dispatch, no state save needed
				}
			}

			e.lastAlerted[ruleKey] = time.Now()
			e.wasAlerting[ruleKey] = true

			alertMsg := rule.Message
			if alertMsg == "" {
				alertMsg = fmt.Sprintf("%s usage %.1f%% exceeds threshold %.1f%% for %d min on %s",
					strings.ToUpper(string(rule.Metric)), value, rule.Threshold, rule.Duration, hostName)
			} else {
				alertMsg = strings.NewReplacer(
					"{host_name}", hostName,
					"{value}", fmt.Sprintf("%.1f", value),
					"{threshold}", fmt.Sprintf("%.1f", rule.Threshold),
					"{metric}", strings.ToUpper(string(rule.Metric)),
					"{duration}", fmt.Sprintf("%d", rule.Duration),
				).Replace(alertMsg)
			}
			n := Notification{
				RuleID:    rule.ID,
				AlertType: AlertTypeResource,
				HostID:    hostID,
				HostName:  hostName,
				Metric:    string(rule.Metric),
				Value:     value,
				Threshold: rule.Threshold,
				Severity:  string(rule.Severity),
				Message:   alertMsg,
				Time:      time.Now(),
			}
			toDispatch = &n
		}
	} else {
		if e.wasAlerting[ruleKey] {
			e.wasAlerting[ruleKey] = false

			n := Notification{
				RuleID:    rule.ID,
				AlertType: AlertTypeResource,
				HostID:    hostID,
				HostName:  hostName,
				Metric:    string(rule.Metric),
				Value:     value,
				Threshold: rule.Threshold,
				Severity:  "info",
				Message: fmt.Sprintf("%s usage recovered to %.1f%% (threshold: %.1f%%) on %s",
					strings.ToUpper(string(rule.Metric)), value, rule.Threshold, hostName),
				Time: time.Now(),
			}
			toDispatch = &n
		}

		// Reset breach count only when NOT in cooldown.
		inCooldown := false
		if last, ok := e.lastAlerted[ruleKey]; ok {
			inCooldown = time.Since(last) < time.Duration(rule.Cooldown)*time.Second
		}
		if !inCooldown {
			e.breachCounts[ruleKey] = 0
		}
	}

	e.mu.Unlock() // ── release before any I/O or goroutine launch ──────────

	// ── post-lock actions (no shared state accessed below) ─────────────────
	if toDispatch != nil {
		if toDispatch.Severity == "info" {
			log.Printf("[Evaluator] RECOVERED: %s %.1f%% < %.1f%% (host: %s, rule: %s)",
				rule.Metric, value, rule.Threshold, hostName, rule.Name)
		} else {
			log.Printf("[Evaluator] ALERT %s: %s %.1f%% > %.1f%% (host: %s, rule: %s)",
				rule.Severity, rule.Metric, value, rule.Threshold, hostName, rule.Name)
		}
		go e.manager.DispatchToChannels(*toDispatch, rule.ChannelIDs)
	}

	go e.SaveState(rule.ID, hostID)
}

// ResetRule clears cached state for a rule (call on rule update/delete).
func (e *RuleEvaluator) ResetRule(ruleID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for key := range e.breachCounts {
		if strings.HasPrefix(key, ruleID+":") || key == ruleID {
			delete(e.breachCounts, key)
			delete(e.lastAlerted, key)
			delete(e.wasAlerting, key)
		}
	}

	// Also delete from database
	e.stateRepo.DeleteByRule(ruleID)
}

// LoadState loads persisted state from database on startup
func (e *RuleEvaluator) LoadState() {
	states, err := e.stateRepo.GetAll()
	if err != nil {
		log.Printf("[Evaluator] Failed to load persisted state: %v", err)
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	for _, state := range states {
		key := e.ruleKey(state.RuleID, state.HostID)
		e.breachCounts[key] = state.BreachCount
		if state.LastAlertedAt != nil {
			e.lastAlerted[key] = *state.LastAlertedAt
		}
		e.wasAlerting[key] = state.IsAlerting
	}

	log.Printf("[Evaluator] Loaded %d persisted alert states", len(states))
}

// SaveState persists current state to database.
// It takes a snapshot of the in-memory maps under the mutex before doing any I/O,
// avoiding a data race when called as a goroutine from evaluateRule.
func (e *RuleEvaluator) SaveState(ruleID, hostID string) {
	key := e.ruleKey(ruleID, hostID)

	e.mu.Lock()
	state := &models.AlertRuleState{
		RuleID:      ruleID,
		HostID:      hostID,
		BreachCount: e.breachCounts[key],
		IsAlerting:  e.wasAlerting[key],
	}
	if t, ok := e.lastAlerted[key]; ok {
		t2 := t
		state.LastAlertedAt = &t2
	}
	e.mu.Unlock()

	if err := e.stateRepo.SaveState(state); err != nil {
		log.Printf("[Evaluator] Failed to save state for %s: %v", key, err)
	}
}

// ruleKey generates a composite key for rules that may apply to multiple hosts.
func (e *RuleEvaluator) ruleKey(ruleID, hostID string) string {
	return ruleID + ":" + hostID
}

// extractMetricValue gets the relevant metric value from a SystemMetric.
func extractMetricValue(metric models.AlertMetric, m *models.SystemMetric) float64 {
	switch metric {
	case models.AlertMetricCPU:
		return m.CPUUsage
	case models.AlertMetricMemory:
		return m.MemUsage
	case models.AlertMetricDisk:
		return m.DiskUsage
	default:
		return 0
	}
}

// compareValue evaluates: value <operator> threshold
func compareValue(value float64, operator models.AlertOperator, threshold float64) bool {
	switch operator {
	case models.AlertOperatorGT:
		return value > threshold
	case models.AlertOperatorGTE:
		return value >= threshold
	case models.AlertOperatorLT:
		return value < threshold
	case models.AlertOperatorLTE:
		return value <= threshold
	case models.AlertOperatorEQ:
		return value == threshold
	default:
		return value > threshold
	}
}
