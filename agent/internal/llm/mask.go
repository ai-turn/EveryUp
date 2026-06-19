package llm

import (
	"regexp"
	"strings"
)

var maskPatterns = []struct {
	re          *regexp.Regexp
	replacement string
}{
	{regexp.MustCompile(`(?i)(authorization:\s*bearer\s+)[^\s]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`(?i)(api[_-]?key["'=:\s]+)[A-Za-z0-9._\-]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`(?i)(token["'=:\s]+)[A-Za-z0-9._:\-]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`(?i)(password["'=:\s]+)[^\s&]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`(?i)(secret["'=:\s]+)[A-Za-z0-9._\-]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`(?i)(bot[0-9]+:)[A-Za-z0-9_\-]+`), `${1}[REDACTED]`},
	{regexp.MustCompile(`([a-zA-Z][a-zA-Z0-9+.-]*://)([^/\s:@]+):([^@\s/]+)@`), `${1}[REDACTED]:[REDACTED]@`},
}

func MaskSensitive(input string) string {
	output := input
	for _, pattern := range maskPatterns {
		output = pattern.re.ReplaceAllString(output, pattern.replacement)
	}
	return output
}

func MaskIncident(incident IncidentContext) IncidentContext {
	masked := incident
	masked.Endpoint = MaskSensitive(masked.Endpoint)
	masked.Message = MaskSensitive(masked.Message)
	if len(incident.Attributes) > 0 {
		masked.Attributes = make(map[string]string, len(incident.Attributes))
		for key, value := range incident.Attributes {
			lowerKey := strings.ToLower(key)
			if strings.Contains(lowerKey, "token") ||
				strings.Contains(lowerKey, "secret") ||
				strings.Contains(lowerKey, "password") ||
				strings.Contains(lowerKey, "authorization") ||
				strings.Contains(lowerKey, "api_key") ||
				strings.Contains(lowerKey, "apikey") {
				masked.Attributes[key] = "[REDACTED]"
				continue
			}
			masked.Attributes[key] = MaskSensitive(value)
		}
	}
	return masked
}
