package handlers

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
	"golang.org/x/crypto/ssh"
)

// SSHTestHandler handles SSH connection test requests.
type SSHTestHandler struct{}

// NewSSHTestHandler creates a new SSH test handler.
func NewSSHTestHandler() *SSHTestHandler {
	return &SSHTestHandler{}
}

// sshTestRequest is the request body for SSH connection test.
type sshTestRequest struct {
	IP          string              `json:"ip"`
	SSHPort     int                 `json:"sshPort"`
	SSHUser     string              `json:"sshUser"`
	SSHAuthType models.SSHAuthType  `json:"sshAuthType"`
	SSHKeyPath  string              `json:"sshKeyPath,omitempty"`
	SSHKey      string              `json:"sshKey,omitempty"`
	SSHPassword string              `json:"sshPassword,omitempty"`
}

// sshTestResponse is the response body for SSH connection test.
type sshTestResponse struct {
	Connected bool   `json:"connected"`
	Hostname  string `json:"hostname,omitempty"`
	OS        string `json:"os,omitempty"`
	Platform  string `json:"platform,omitempty"`
	LatencyMs int64  `json:"latencyMs"`
}

// TestConnection tests SSH connectivity without persisting anything.
func (h *SSHTestHandler) TestConnection(c *fiber.Ctx) error {
	var req sshTestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
	}

	if req.IP == "" || req.SSHUser == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "ip and sshUser are required",
			},
		})
	}

	if req.SSHPort == 0 {
		req.SSHPort = 22
	}

	// Build SSH auth method
	authMethods, err := buildAuthMethods(req.SSHAuthType, req.SSHPassword, req.SSHKey, req.SSHKeyPath)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "AUTH_CONFIG_ERROR",
				"message": err.Error(),
			},
		})
	}

	// Get timeout from config
	cfg := config.Get()
	timeout := 10 * time.Second
	if cfg != nil && cfg.System.SSH.ConnectionTimeout > 0 {
		timeout = time.Duration(cfg.System.SSH.ConnectionTimeout) * time.Second
	}

	sshConfig := &ssh.ClientConfig{
		User:            req.SSHUser,
		Auth:            authMethods,
		HostKeyCallback: crypto.HostKeyCallback(),
		Timeout:         timeout,
	}

	addr := fmt.Sprintf("%s:%d", req.IP, req.SSHPort)

	start := time.Now()
	client, err := ssh.Dial("tcp", addr, sshConfig)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		code := classifySSHError(err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    code,
				"message": genericMessage(code),
			},
		})
	}
	defer client.Close()

	// Try to get hostname
	resp := sshTestResponse{
		Connected: true,
		LatencyMs: latency,
	}

	session, err := client.NewSession()
	if err == nil {
		defer session.Close()
		output, err := session.CombinedOutput("hostname && cat /etc/os-release 2>/dev/null | head -2 || echo unknown")
		if err == nil {
			lines := splitLines(string(output))
			if len(lines) > 0 {
				resp.Hostname = lines[0]
			}
			// Parse os-release for NAME and VERSION_ID
			for _, line := range lines[1:] {
				if len(line) > 5 && line[:5] == "NAME=" {
					resp.OS = trimQuotes(line[5:])
				}
				if len(line) > 11 && line[:11] == "VERSION_ID=" {
					resp.Platform = trimQuotes(line[11:])
				}
			}
			if resp.OS != "" && resp.Platform != "" {
				resp.Platform = resp.OS + " " + resp.Platform
			}
			if resp.OS == "" {
				resp.OS = "linux"
			}
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    resp,
	})
}

// buildAuthMethods creates SSH auth methods from the request parameters.
func buildAuthMethods(authType models.SSHAuthType, password, keyContent, keyPath string) ([]ssh.AuthMethod, error) {
	switch authType {
	case models.SSHAuthPassword:
		if password == "" {
			return nil, fmt.Errorf("password is required for password auth")
		}
		return []ssh.AuthMethod{ssh.Password(password)}, nil

	case models.SSHAuthKey:
		if keyContent == "" {
			return nil, fmt.Errorf("SSH key content is required for key auth")
		}
		signer, err := ssh.ParsePrivateKey([]byte(keyContent))
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH key: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil

	case models.SSHAuthKeyFile:
		if keyPath == "" {
			return nil, fmt.Errorf("SSH key file path is required for key_file auth")
		}
		if err := crypto.ValidateSSHKeyPath(keyPath); err != nil {
			return nil, fmt.Errorf("invalid SSH key path: %w", err)
		}
		keyBytes, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read SSH key file: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH key file: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil

	default:
		// Try password if provided, otherwise error
		if password != "" {
			return []ssh.AuthMethod{ssh.Password(password)}, nil
		}
		return nil, fmt.Errorf("sshAuthType is required (password, key, or key_file)")
	}
}

// classifySSHError maps a Go SSH error to a structured error code.
// The frontend resolves the code to a user-facing localized message.
func classifySSHError(err error) string {
	msg := err.Error()
	c := strings.Contains
	switch {
	case c(msg, "connection refused"):
		return ErrCodeSSHConnectionRefused
	case c(msg, "no such host") || c(msg, "no route to host") || c(msg, "name or service not known"):
		return ErrCodeSSHHostNotFound
	case c(msg, "i/o timeout") || c(msg, "connection timed out") || c(msg, "deadline exceeded"):
		return ErrCodeSSHTimeout
	case c(msg, "unable to authenticate") || c(msg, "no supported methods remain"):
		return ErrCodeSSHAuthFailed
	case c(msg, "handshake failed"):
		return ErrCodeSSHHandshakeFailed
	case c(msg, "host key verification failed") || c(msg, "knownhosts"):
		return ErrCodeSSHHostKeyFailed
	case c(msg, "permission denied"):
		return ErrCodeSSHPermissionDenied
	default:
		return ErrCodeSSHFailed
	}
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			if line != "" {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(s) {
		line := s[start:]
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func trimQuotes(s string) string {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}
