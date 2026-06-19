package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
)

// HostRepository handles host data operations
type HostRepository struct{}

// NewHostRepository creates a new host repository
func NewHostRepository() *HostRepository {
	return &HostRepository{}
}

// hostSelectColumns is the column list for host queries.
const hostSelectColumns = `id, name, type, resource_category, ip, port, "group", is_active, description,
	ssh_user, ssh_port, ssh_auth_type, ssh_key_path, ssh_key, ssh_password, last_error,
	created_at, updated_at`

// GetAll returns all hosts
func (r *HostRepository) GetAll() ([]models.Host, error) {
	rows, err := DB.Query(`
		SELECT ` + hostSelectColumns + `
		FROM hosts
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []models.Host
	for rows.Next() {
		h, err := scanHost(rows)
		if err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, nil
}

// GetByID returns a host by ID
func (r *HostRepository) GetByID(id string) (*models.Host, error) {
	row := DB.QueryRow(`
		SELECT `+hostSelectColumns+`
		FROM hosts WHERE id = ?
	`, id)

	h, err := scanHostRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// GetByType returns hosts by type (local/remote)
func (r *HostRepository) GetByType(hostType models.HostType) ([]models.Host, error) {
	rows, err := DB.Query(`
		SELECT `+hostSelectColumns+`
		FROM hosts WHERE type = ?
		ORDER BY name
	`, hostType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []models.Host
	for rows.Next() {
		h, err := scanHost(rows)
		if err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, nil
}

// GetActive returns all active hosts
func (r *HostRepository) GetActive() ([]models.Host, error) {
	rows, err := DB.Query(`
		SELECT ` + hostSelectColumns + `
		FROM hosts WHERE is_active = 1
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []models.Host
	for rows.Next() {
		h, err := scanHost(rows)
		if err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, nil
}

// Create creates a new host
func (r *HostRepository) Create(h *models.Host) error {
	isActive := 0
	if h.IsActive {
		isActive = 1
	}

	encKey, err := crypto.Encrypt(h.SSHKey)
	if err != nil {
		return err
	}
	encPassword, err := crypto.Encrypt(h.SSHPassword)
	if err != nil {
		return err
	}

	_, err = DB.Exec(`
		INSERT INTO hosts (id, name, type, resource_category, ip, port, "group", is_active, description,
		                    ssh_user, ssh_port, ssh_auth_type, ssh_key_path, ssh_key, ssh_password, last_error,
		                    created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, h.ID, h.Name, h.Type, h.ResourceCategory, h.IP, h.Port, h.Group, isActive, h.Description,
		h.SSHUser, h.SSHPort, h.SSHAuthType, h.SSHKeyPath, encKey, encPassword, h.LastError,
		h.CreatedAt, h.UpdatedAt)
	return err
}

// Update updates a host
func (r *HostRepository) Update(h *models.Host) error {
	isActive := 0
	if h.IsActive {
		isActive = 1
	}

	encKey, err := crypto.Encrypt(h.SSHKey)
	if err != nil {
		return err
	}
	encPassword, err := crypto.Encrypt(h.SSHPassword)
	if err != nil {
		return err
	}

	h.UpdatedAt = time.Now()
	_, err = DB.Exec(`
		UPDATE hosts SET name = ?, type = ?, resource_category = ?, ip = ?, port = ?, "group" = ?,
		                 is_active = ?, description = ?,
		                 ssh_user = ?, ssh_port = ?, ssh_auth_type = ?,
		                 ssh_key_path = ?, ssh_key = ?, ssh_password = ?,
		                 last_error = ?, updated_at = ?
		WHERE id = ?
	`, h.Name, h.Type, h.ResourceCategory, h.IP, h.Port, h.Group, isActive, h.Description,
		h.SSHUser, h.SSHPort, h.SSHAuthType,
		h.SSHKeyPath, encKey, encPassword,
		h.LastError, h.UpdatedAt, h.ID)
	return err
}

// SetLastError updates the last_error field for a host
func (r *HostRepository) SetLastError(id string, lastError string) error {
	_, err := DB.Exec(`UPDATE hosts SET last_error = ?, updated_at = ? WHERE id = ?`,
		lastError, time.Now(), id)
	return err
}

// Delete deletes a host and its associated metrics
func (r *HostRepository) Delete(id string) error {
	// Delete associated system metrics first
	if _, err := DB.Exec("DELETE FROM system_metrics WHERE host_id = ?", id); err != nil {
		return err
	}
	_, err := DB.Exec("DELETE FROM hosts WHERE id = ?", id)
	return err
}

// SetActive sets the is_active flag for a host
func (r *HostRepository) SetActive(id string, isActive bool) error {
	active := 0
	if isActive {
		active = 1
	}
	_, err := DB.Exec(`UPDATE hosts SET is_active = ?, updated_at = ? WHERE id = ?`,
		active, time.Now(), id)
	return err
}

// scanHostFields scans host columns into a Host struct from a generic scanner.
func scanHostFields(scan func(dest ...interface{}) error) (models.Host, error) {
	var h models.Host
	var isActive int
	var port, sshPort sql.NullInt64
	var resourceCategory sql.NullString
	var description, sshUser, sshAuthType, sshKeyPath, sshKey, sshPassword, lastError sql.NullString

	err := scan(
		&h.ID, &h.Name, &h.Type, &resourceCategory, &h.IP, &port, &h.Group, &isActive, &description,
		&sshUser, &sshPort, &sshAuthType, &sshKeyPath, &sshKey, &sshPassword, &lastError,
		&h.CreatedAt, &h.UpdatedAt,
	)
	if err != nil {
		return h, err
	}

	h.IsActive = isActive == 1
	if resourceCategory.Valid && resourceCategory.String != "" {
		h.ResourceCategory = models.HostResourceCategory(resourceCategory.String)
	} else {
		h.ResourceCategory = models.HostResourceServer
	}
	if port.Valid {
		h.Port = int(port.Int64)
	}
	if description.Valid {
		h.Description = description.String
	}
	if sshUser.Valid {
		h.SSHUser = sshUser.String
	}
	if sshPort.Valid {
		h.SSHPort = int(sshPort.Int64)
	}
	if sshAuthType.Valid {
		h.SSHAuthType = models.SSHAuthType(sshAuthType.String)
	}
	if sshKeyPath.Valid {
		h.SSHKeyPath = sshKeyPath.String
	}
	if sshKey.Valid {
		decKey, err := crypto.Decrypt(sshKey.String)
		if err == nil {
			h.SSHKey = decKey
		} else {
			h.SSHKey = sshKey.String
		}
	}
	if sshPassword.Valid {
		decPassword, err := crypto.Decrypt(sshPassword.String)
		if err == nil {
			h.SSHPassword = decPassword
		} else {
			h.SSHPassword = sshPassword.String
		}
	}
	if lastError.Valid {
		h.LastError = lastError.String
	}
	h.Status = models.HostStatusUnknown
	return h, nil
}

// scanHost scans a host from *sql.Rows (multi-row queries)
func scanHost(rows *sql.Rows) (models.Host, error) {
	return scanHostFields(rows.Scan)
}

// scanHostRow scans a host from *sql.Row (single-row queries)
func scanHostRow(row *sql.Row) (models.Host, error) {
	return scanHostFields(row.Scan)
}
