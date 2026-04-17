package handlers

import (
	"testing"

	"github.com/aiturn/everyup/internal/models"
)

func TestShouldCapture(t *testing.T) {
	any := 0 // placeholder for sampleRate when it doesn't matter

	cases := []struct {
		name       string
		cfg        *models.ApiCaptureConfig
		statusCode int
		errorStr   string
		rngVal     float64
		expected   bool
	}{
		// nil config
		{
			name:       "nil cfg returns false",
			cfg:        nil,
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.5,
			expected:   false,
		},
		// disabled mode
		{
			name:       "disabled mode non-error returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeDisabled, SampleRate: any},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.5,
			expected:   false,
		},
		{
			name:       "disabled mode 500 error returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeDisabled, SampleRate: any},
			statusCode: 500,
			errorStr:   "",
			rngVal:     0.5,
			expected:   false,
		},
		// errors_only mode
		{
			name:       "errors_only non-error returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeErrorsOnly, SampleRate: 0},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.5,
			expected:   false,
		},
		{
			name:       "errors_only 500 returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeErrorsOnly, SampleRate: 0},
			statusCode: 500,
			errorStr:   "",
			rngVal:     0.5,
			expected:   true,
		},
		{
			name:       "errors_only errorStr non-empty returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeErrorsOnly, SampleRate: 0},
			statusCode: 200,
			errorStr:   "timeout",
			rngVal:     0.5,
			expected:   true,
		},
		// all mode
		{
			name:       "all mode non-error returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeAll, SampleRate: 0},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.5,
			expected:   true,
		},
		{
			name:       "all mode 500 returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeAll, SampleRate: 0},
			statusCode: 500,
			errorStr:   "",
			rngVal:     0.5,
			expected:   true,
		},
		// sampled mode
		{
			name:       "sampled sampleRate=0 rng=0.0 returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 0},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.0,
			expected:   false,
		},
		{
			name:       "sampled sampleRate=100 rng=0.99 returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 100},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.99,
			expected:   true,
		},
		{
			name:       "sampled sampleRate=50 rng=0.49 returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 50},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.49,
			expected:   true,
		},
		{
			name:       "sampled sampleRate=50 rng=0.50 returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 50},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.50,
			expected:   false,
		},
		{
			name:       "sampled sampleRate=10 rng=0.09 returns true",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 10},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.09,
			expected:   true,
		},
		{
			name:       "sampled sampleRate=10 rng=0.10 returns false",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: 10},
			statusCode: 200,
			errorStr:   "",
			rngVal:     0.10,
			expected:   false,
		},
		{
			name:       "sampled error status always captured regardless of rng",
			cfg:        &models.ApiCaptureConfig{Mode: models.CaptureModeSampled, SampleRate: any},
			statusCode: 500,
			errorStr:   "",
			rngVal:     1.0,
			expected:   true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rng := func() float64 { return tc.rngVal }
			got := shouldCapture(tc.cfg, tc.statusCode, tc.errorStr, rng)
			if got != tc.expected {
				t.Errorf("shouldCapture() = %v, want %v", got, tc.expected)
			}
		})
	}
}

func TestCryptoRandFloat64(t *testing.T) {
	for i := 0; i < 100; i++ {
		v := cryptoRandFloat64()
		if v < 0.0 || v >= 1.0 {
			t.Errorf("cryptoRandFloat64() = %v, want in [0, 1)", v)
		}
	}
}
