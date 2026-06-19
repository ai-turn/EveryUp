package llm

import (
	"strings"
	"testing"
)

func TestMaskSensitiveRedactsCommonSecrets(t *testing.T) {
	input := `Authorization: Bearer abc123 token=123456:secret password=hunter2 postgres://user:pass@example/db`
	got := MaskSensitive(input)

	for _, leaked := range []string{"abc123", "123456:secret", "hunter2", "user:pass"} {
		if strings.Contains(got, leaked) {
			t.Fatalf("masked output leaked %q: %s", leaked, got)
		}
	}
	if !strings.Contains(got, "[REDACTED]") {
		t.Fatalf("masked output missing redaction marker: %s", got)
	}
}

func TestMaskIncidentRedactsSensitiveAttributes(t *testing.T) {
	incident := IncidentContext{
		Endpoint: "http://user:pass@example/health",
		Message:  "api_key=secret",
		Attributes: map[string]string{
			"Authorization": "Bearer abc",
			"safe":          "value",
		},
	}

	masked := MaskIncident(incident)
	if strings.Contains(masked.Endpoint, "user:pass") {
		t.Fatalf("endpoint was not masked: %s", masked.Endpoint)
	}
	if masked.Attributes["Authorization"] != "[REDACTED]" {
		t.Fatalf("authorization attribute = %q", masked.Attributes["Authorization"])
	}
	if masked.Attributes["safe"] != "value" {
		t.Fatalf("safe attribute changed: %q", masked.Attributes["safe"])
	}
}
