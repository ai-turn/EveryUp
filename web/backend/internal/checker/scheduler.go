package checker

import (
	"fmt"
	"log"
	"sync"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/robfig/cron/v3"
)

// Scheduler manages periodic health checks.
// Check execution logic lives in runner.go.
// Metric/incident DB writes live in recorder.go.
type Scheduler struct {
	cron         *cron.Cron
	entries      map[string]cron.EntryID
	httpChecker  *HTTPChecker
	tcpChecker   *TCPChecker
	serviceRepo  *database.ServiceRepository
	metricRepo   *database.MetricRepository
	incidentRepo *database.IncidentRepository
	logRepo      *database.LogRepository

	// Track consecutive failures
	failureCounts map[string]int
	mu            sync.Mutex

	// Service rule evaluator for endpoint alert rules
	serviceEvaluator *alerter.ServiceRuleEvaluator

	// Broadcast function for WebSocket
	broadcast func(interface{})
}

// NewScheduler creates a new scheduler
func NewScheduler() *Scheduler {
	return &Scheduler{
		cron:          cron.New(cron.WithSeconds()),
		entries:       make(map[string]cron.EntryID),
		httpChecker:   NewHTTPChecker(),
		tcpChecker:    NewTCPChecker(),
		serviceRepo:   database.NewServiceRepository(),
		metricRepo:    database.NewMetricRepository(),
		incidentRepo:  database.NewIncidentRepository(),
		logRepo:       database.NewLogRepository(),
		failureCounts: make(map[string]int),
	}
}

// SetServiceEvaluator sets the evaluator for endpoint-based alert rules
func (s *Scheduler) SetServiceEvaluator(e *alerter.ServiceRuleEvaluator) {
	s.serviceEvaluator = e
}

// SetBroadcast sets the broadcast function for WebSocket notifications
func (s *Scheduler) SetBroadcast(fn func(interface{})) {
	s.broadcast = fn
}

// Start starts the scheduler with configured services
func (s *Scheduler) Start(services []config.ServiceConfig) error {
	// Sync services to database
	if err := s.syncServices(services); err != nil {
		return err
	}

	// Schedule checks for each service from DB
	allServices, err := s.serviceRepo.GetAll()
	if err != nil {
		return err
	}

	for _, svc := range allServices {
		if svc.IsActive {
			service := svc // Create local copy
			s.AddService(&service)
		}
	}

	// Schedule cleanup job (run daily at midnight)
	s.cron.AddFunc("0 0 0 * * *", s.cleanup)

	s.cron.Start()
	log.Printf("Scheduler started with %d services", len(allServices))

	return nil
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	s.cron.Stop()
	log.Println("Scheduler stopped")
}

// AddService adds a service to the scheduler
func (s *Scheduler) AddService(svc *models.Service) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove existing if any
	if entryID, ok := s.entries[svc.ID]; ok {
		s.cron.Remove(entryID)
	}

	if !svc.IsActive {
		return
	}

	var spec string
	var scheduleDesc string

	// Determine schedule specification based on type
	if svc.ScheduleType == models.ScheduleTypeCron && svc.CronExpression != "" {
		// Use cron expression
		spec = svc.CronExpression
		scheduleDesc = fmt.Sprintf("cron: %s", svc.CronExpression)
	} else {
		// Default to interval-based scheduling
		spec = fmt.Sprintf("@every %ds", svc.Interval)
		scheduleDesc = fmt.Sprintf("interval: %ds", svc.Interval)
	}

	entryID, err := s.cron.AddFunc(spec, func() {
		s.checkService(svc)
	})

	if err != nil {
		log.Printf("Failed to schedule service %s: %v", svc.ID, err)
		return
	}

	s.entries[svc.ID] = entryID
	log.Printf("Scheduled service %s (%s)", svc.ID, scheduleDesc)

	// Run initial check immediately in a goroutine
	go s.checkService(svc)
}

// RemoveService removes a service from the scheduler
func (s *Scheduler) RemoveService(serviceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if entryID, ok := s.entries[serviceID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, serviceID)
		log.Printf("Removed service %s from scheduler", serviceID)
	}
}

// UpdateService updates a service in the scheduler
func (s *Scheduler) UpdateService(svc *models.Service) {
	// AddService handles updates by removing existing entry
	s.AddService(svc)
}

// syncServices syncs config-file services to the database on startup
func (s *Scheduler) syncServices(services []config.ServiceConfig) error {
	for _, svc := range services {
		existing, err := s.serviceRepo.GetByID(svc.ID)
		if err != nil {
			return err
		}

		req := &models.ServiceCreateRequest{
			ID:             svc.ID,
			Name:           svc.Name,
			Type:           models.ServiceType(svc.Type),
			URL:            svc.URL,
			Method:         svc.Method,
			Host:           svc.Host,
			Port:           svc.Port,
			Headers:        svc.Headers,
			ExpectedStatus: svc.ExpectedStatus,
			Timeout:        svc.Timeout,
			Interval:       svc.Interval,
			Tags:           svc.Tags,
		}

		service := req.ToService()

		if existing == nil {
			if err := s.serviceRepo.Create(service); err != nil {
				log.Printf("Failed to create service %s: %v", svc.ID, err)
			}
		} else {
			// Update existing service fields
			existing.Name = service.Name
			existing.Type = service.Type
			existing.URL = service.URL
			existing.Port = service.Port
			existing.Method = service.Method
			existing.Headers = service.Headers
			existing.ExpectedStatus = service.ExpectedStatus
			existing.Interval = service.Interval
			existing.Timeout = service.Timeout
			existing.Tags = service.Tags
			if err := s.serviceRepo.Update(existing); err != nil {
				log.Printf("Failed to update service %s: %v", svc.ID, err)
			}
		}
	}
	return nil
}
