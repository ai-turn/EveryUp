package llm

import (
	"context"
	"time"
)

type IncidentContext struct {
	ServiceName string            `json:"serviceName"`
	TargetKey   string            `json:"targetKey"`
	CheckType   string            `json:"checkType"`
	Endpoint    string            `json:"endpoint"`
	Severity    string            `json:"severity"`
	Message     string            `json:"message"`
	ObservedAt  time.Time         `json:"observedAt"`
	Attributes  map[string]string `json:"attributes,omitempty"`
}

type Summary struct {
	Title             string   `json:"title"`
	LikelyCauses      []string `json:"likelyCauses"`
	Evidence          []string `json:"evidence"`
	SuggestedActions  []string `json:"suggestedActions"`
	Risk              string   `json:"risk"`
	Confidence        string   `json:"confidence"`
	RawProviderOutput string   `json:"-"`
}

type Provider interface {
	Summarize(ctx context.Context, incident IncidentContext) (Summary, error)
}

func FormatSummary(summary Summary) string {
	body := ""
	if summary.Title != "" {
		body += "\n\nAI Summary: " + summary.Title
	}
	body += formatList("Likely causes", summary.LikelyCauses)
	body += formatList("Evidence", summary.Evidence)
	body += formatList("Suggested actions", summary.SuggestedActions)
	if summary.Risk != "" || summary.Confidence != "" {
		body += "\nRisk: " + valueOrUnknown(summary.Risk)
		body += "\nConfidence: " + valueOrUnknown(summary.Confidence)
	}
	return body
}

func formatList(title string, items []string) string {
	if len(items) == 0 {
		return ""
	}
	body := "\n" + title + ":"
	for _, item := range items {
		if item != "" {
			body += "\n- " + item
		}
	}
	return body
}

func valueOrUnknown(value string) string {
	if value == "" {
		return "unknown"
	}
	return value
}
