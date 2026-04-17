package handlers

import (
	"crypto/rand"
	"encoding/binary"

	"github.com/aiturn/everyup/internal/models"
)

// shouldCapture returns true if the entry should be stored based on the capture config.
// rng is a function returning a float64 in [0,1); injected for testability.
// Production callers pass cryptoRandFloat64.
func shouldCapture(cfg *models.ApiCaptureConfig, statusCode int, errorStr string, rng func() float64) bool {
	if cfg == nil {
		return false
	}

	if cfg.Mode == models.CaptureModeDisabled {
		return false
	}

	isError := statusCode >= 500 || errorStr != ""
	if isError {
		return true
	}

	switch cfg.Mode {
	case models.CaptureModeErrorsOnly:
		return false
	case models.CaptureModeAll:
		return true
	case models.CaptureModeSampled:
		return rng() < float64(cfg.SampleRate)/100.0
	default:
		return false
	}
}

// cryptoRandFloat64 returns a cryptographically random float64 in [0,1).
func cryptoRandFloat64() float64 {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// Fallback: return 0.0 on error (safe — will not capture)
		return 0.0
	}
	// Use the top 53 bits of the random uint64 to form a float64 in [0,1).
	u := binary.BigEndian.Uint64(b[:]) >> 11
	return float64(u) / float64(1<<53)
}
