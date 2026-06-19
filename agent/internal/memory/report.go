package memory

import (
	"fmt"
	"strings"
	"time"
)

func FormatSimilar(incidents []SimilarIncident) string {
	if len(incidents) == 0 {
		return "No similar incidents found."
	}
	var b strings.Builder
	b.WriteString("Similar incidents")
	for _, item := range incidents {
		incident := item.Incident
		b.WriteString("\n- ")
		b.WriteString(incident.ServiceName)
		b.WriteString(" ")
		b.WriteString(incident.Status)
		b.WriteString(" score=")
		b.WriteString(fmt.Sprintf("%d", item.Score))
		if !incident.StartedAt.IsZero() {
			b.WriteString(" at ")
			b.WriteString(incident.StartedAt.Format(time.RFC3339))
		}
		if incident.Message != "" {
			b.WriteString("\n  ")
			b.WriteString(trimLine(incident.Message, 220))
		}
	}
	return b.String()
}

func DraftPostmortem(current Incident, similar []SimilarIncident) string {
	if current.ID == 0 {
		return "No incident history found for that service."
	}
	var b strings.Builder
	b.WriteString("Postmortem draft")
	b.WriteString("\nService: ")
	b.WriteString(current.ServiceName)
	b.WriteString("\nStatus: ")
	b.WriteString(current.Status)
	b.WriteString("\nStarted: ")
	b.WriteString(current.StartedAt.Format(time.RFC3339))
	if !current.ResolvedAt.IsZero() {
		b.WriteString("\nResolved: ")
		b.WriteString(current.ResolvedAt.Format(time.RFC3339))
		b.WriteString("\nDuration: ")
		b.WriteString(current.ResolvedAt.Sub(current.StartedAt).Round(time.Second).String())
	}
	b.WriteString("\n\nSummary")
	b.WriteString("\n")
	b.WriteString(trimLine(current.Message, 500))
	b.WriteString("\n\nLikely impact")
	b.WriteString("\n- Service health check reported ")
	b.WriteString(current.Status)
	b.WriteString(" for ")
	b.WriteString(current.ServiceName)
	b.WriteString(".")
	b.WriteString("\n\nTimeline")
	b.WriteString("\n- ")
	b.WriteString(current.StartedAt.Format(time.RFC3339))
	b.WriteString(" incident recorded")
	if !current.ResolvedAt.IsZero() {
		b.WriteString("\n- ")
		b.WriteString(current.ResolvedAt.Format(time.RFC3339))
		b.WriteString(" recovery recorded")
	}
	b.WriteString("\n\nSimilar history")
	if len(similar) == 0 {
		b.WriteString("\n- No similar incidents found.")
	} else {
		for _, item := range similar {
			b.WriteString("\n- ")
			b.WriteString(item.Incident.StartedAt.Format(time.RFC3339))
			b.WriteString(" score=")
			b.WriteString(fmt.Sprintf("%d", item.Score))
			b.WriteString(" ")
			b.WriteString(trimLine(item.Incident.Message, 160))
		}
	}
	b.WriteString("\n\nFollow-up")
	b.WriteString("\n- Confirm root cause from logs and metrics.")
	b.WriteString("\n- Add or adjust a runbook if this repeats.")
	b.WriteString("\n- Review whether alert thresholds or cooldown need tuning.")
	return b.String()
}

func trimLine(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}
