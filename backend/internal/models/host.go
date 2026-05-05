package models

import "time"

// HostType represents the connection type of a monitored host
type HostType string

const (
	HostTypeLocal  HostType = "local"
	HostTypeRemote HostType = "remote"
)

// HostResourceCategory represents the kind of resource being monitored
type HostResourceCategory string

const (
	HostResourceServer    HostResourceCategory = "server"
	HostResourceDatabase  HostResourceCategory = "database"
	HostResourceContainer HostResourceCategory = "container"
)

// HostStatus represents the current operational status of a host
type HostStatus string

const (
	HostStatusOnline  HostStatus = "online"
	HostStatusOffline HostStatus = "offline"
	HostStatusUnknown HostStatus = "unknown"
	HostStatusError   HostStatus = "error"
)

// SSHAuthType represents the SSH authentication method
type SSHAuthType string

const (
	SSHAuthPassword SSHAuthType = "password"
	SSHAuthKey      SSHAuthType = "key"      // PEM key content directly
	SSHAuthKeyFile  SSHAuthType = "key_file" // Server-side file path
)

// Host represents a monitored server/host
type Host struct {
	ID               string               `json:"id"`
	Name             string               `json:"name"`
	Type             HostType             `json:"type"`
	ResourceCategory HostResourceCategory `json:"resourceCategory,omitempty"`
	IP               string               `json:"ip"`
	Port             int                  `json:"port,omitempty"`
	Group            string               `json:"group"`
	IsActive         bool                 `json:"isActive"`
	Description      string               `json:"description,omitempty"`
	CreatedAt        time.Time            `json:"createdAt"`
	UpdatedAt        time.Time            `json:"updatedAt"`

	// SSH Authentication (remote hosts only)
	SSHUser     string      `json:"sshUser,omitempty"`
	SSHPort     int         `json:"sshPort,omitempty"`
	SSHAuthType SSHAuthType `json:"sshAuthType,omitempty"`
	SSHKeyPath  string      `json:"sshKeyPath,omitempty"`
	SSHKey      string      `json:"sshKey,omitempty"`      // encrypted at rest, masked in API response
	SSHPassword string      `json:"sshPassword,omitempty"` // encrypted at rest, masked in API response

	// Computed fields (not stored in DB directly)
	Status    HostStatus `json:"status,omitempty"`
	LastError string     `json:"lastError,omitempty"`
}

// InfraResourceStatus is the operational status shown on the infrastructure list.
type InfraResourceStatus string

const (
	InfraStatusHealthy  InfraResourceStatus = "healthy"
	InfraStatusWarning  InfraResourceStatus = "warning"
	InfraStatusCritical InfraResourceStatus = "critical"
	InfraStatusError    InfraResourceStatus = "error"
	InfraStatusPaused   InfraResourceStatus = "paused"
	InfraStatusUnknown  InfraResourceStatus = "unknown"
)

// InfraSeverity captures whether a host should be treated as an active incident.
type InfraSeverity string

const (
	InfraSeverityNone     InfraSeverity = "none"
	InfraSeverityWarning  InfraSeverity = "warning"
	InfraSeverityCritical InfraSeverity = "critical"
)

// SSHSummary exposes connection health fields needed by the remote hosts view.
type SSHSummary struct {
	Port             int        `json:"port,omitempty"`
	User             string     `json:"user,omitempty"`
	ConnectionStatus string     `json:"connectionStatus"`
	LastTestedAt     *time.Time `json:"lastTestedAt,omitempty"`
}

// InfraResourceSummary is the production list DTO for infrastructure pages.
type InfraResourceSummary struct {
	ID              string               `json:"id"`
	Name            string               `json:"name"`
	Type            HostResourceCategory `json:"type"`
	ConnectionType  HostType             `json:"connectionType"`
	Status          InfraResourceStatus  `json:"status"`
	Severity        InfraSeverity        `json:"severity"`
	StatusReason    string               `json:"statusReason"`
	Cluster         string               `json:"cluster"`
	IP              string               `json:"ip"`
	IsActive        bool                 `json:"isActive"`
	IsRemote        bool                 `json:"isRemote"`
	SSHPort         int                  `json:"sshPort,omitempty"`
	LastSeenAt      *time.Time           `json:"lastSeenAt,omitempty"`
	LastCollectedAt *time.Time           `json:"lastCollectedAt,omitempty"`
	IncidentSince   *time.Time           `json:"incidentSince,omitempty"`
	LastError       string               `json:"lastError,omitempty"`
	CPUUsage        *float64             `json:"cpuUsage,omitempty"`
	MemoryUsage     *float64             `json:"memoryUsage,omitempty"`
	DiskUsage       *float64             `json:"diskUsage,omitempty"`
	SSH             *SSHSummary          `json:"ssh,omitempty"`
	CreatedAt       time.Time            `json:"createdAt"`
	UpdatedAt       time.Time            `json:"updatedAt"`
}

// HostCreateRequest represents a request to create a host
type HostCreateRequest struct {
	ID               string               `json:"id"`
	Name             string               `json:"name"`
	Type             HostType             `json:"type"`
	ResourceCategory HostResourceCategory `json:"resourceCategory,omitempty"`
	IP               string               `json:"ip"`
	Port             int                  `json:"port,omitempty"`
	Group            string               `json:"group,omitempty"`
	IsActive         *bool                `json:"isActive,omitempty"`
	Description      string               `json:"description,omitempty"`
	SSHUser          string               `json:"sshUser,omitempty"`
	SSHPort          int                  `json:"sshPort,omitempty"`
	SSHAuthType      SSHAuthType          `json:"sshAuthType,omitempty"`
	SSHKeyPath       string               `json:"sshKeyPath,omitempty"`
	SSHKey           string               `json:"sshKey,omitempty"`
	SSHPassword      string               `json:"sshPassword,omitempty"`
}

// ToHost converts request to Host model
func (r *HostCreateRequest) ToHost() *Host {
	isActive := true
	if r.IsActive != nil {
		isActive = *r.IsActive
	}

	group := r.Group
	if group == "" {
		group = "Default"
	}

	hostType := r.Type
	if hostType == "" {
		hostType = HostTypeRemote
	}

	sshPort := r.SSHPort
	if sshPort == 0 && hostType == HostTypeRemote {
		sshPort = 22
	}

	resourceCategory := r.ResourceCategory
	if resourceCategory == "" {
		resourceCategory = HostResourceServer
	}

	now := time.Now()
	return &Host{
		ID:               r.ID,
		Name:             r.Name,
		Type:             hostType,
		ResourceCategory: resourceCategory,
		IP:               r.IP,
		Port:             r.Port,
		Group:            group,
		IsActive:         isActive,
		Description:      r.Description,
		SSHUser:          r.SSHUser,
		SSHPort:          sshPort,
		SSHAuthType:      r.SSHAuthType,
		SSHKeyPath:       r.SSHKeyPath,
		SSHKey:           r.SSHKey,
		SSHPassword:      r.SSHPassword,
		CreatedAt:        now,
		UpdatedAt:        now,
		Status:           HostStatusUnknown,
	}
}

// MaskSecrets replaces sensitive SSH fields with "***" for API responses.
func (h *Host) MaskSecrets() {
	if h.SSHPassword != "" {
		h.SSHPassword = "***"
	}
	if h.SSHKey != "" {
		h.SSHKey = "***"
	}
}
