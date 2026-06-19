package llm

import (
	"encoding/json"
	"fmt"
)

const systemPrompt = "You are EveryUp Agent. Explain monitoring incidents briefly. Do not execute commands. Return strict JSON only."

func BuildMessages(incident IncidentContext) []chatMessage {
	masked := MaskIncident(incident)
	payload, _ := json.MarshalIndent(masked, "", "  ")
	return []chatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: fmt.Sprintf(`Summarize this incident for an operator.

Return JSON with:
- title: string
- likelyCauses: string[]
- evidence: string[]
- suggestedActions: string[]
- risk: "low" | "medium" | "high"
- confidence: "low" | "medium" | "high"

Incident:
%s`, string(payload))},
	}
}
