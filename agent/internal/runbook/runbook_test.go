package runbook

import (
	"strings"
	"testing"
)

func TestParseMarkdownExtractsFrontmatterAndSteps(t *testing.T) {
	book, err := ParseMarkdown("sample.md", `---
name: Nginx 502
description: Proxy failure
severity: high
service_types: nginx,http
patterns: 502,bad gateway
auto_execute: false
---

## Steps

- Check upstream.
- Read logs.
`)
	if err != nil {
		t.Fatalf("ParseMarkdown returned error: %v", err)
	}
	if book.Name != "Nginx 502" || book.Severity != "high" {
		t.Fatalf("unexpected metadata: %+v", book)
	}
	if len(book.ServiceTypes) != 2 || book.ServiceTypes[0] != "nginx" {
		t.Fatalf("unexpected service types: %+v", book.ServiceTypes)
	}
	if len(book.Steps) != 2 || book.Steps[0] != "Check upstream." {
		t.Fatalf("unexpected steps: %+v", book.Steps)
	}
}

func TestDefaultLibraryMatchesIncident(t *testing.T) {
	library, err := LoadDefaultLibrary()
	if err != nil {
		t.Fatalf("LoadDefaultLibrary returned error: %v", err)
	}
	matches := library.Match(Incident{
		ServiceName: "nginx",
		CheckType:   "http",
		Message:     "returned 502 bad gateway",
	}, 1)
	if len(matches) != 1 {
		t.Fatalf("expected one match, got %d", len(matches))
	}
	if matches[0].Book.Name != "Nginx 502 Upstream Failure" {
		t.Fatalf("unexpected match: %+v", matches[0].Book)
	}
}

func TestFormatRecommendations(t *testing.T) {
	text := FormatRecommendations([]Recommendation{{
		Book: Book{
			Name:        "Disk Full",
			Severity:    "critical",
			Description: "Disk pressure.",
			Steps:       []string{"Check df.", "Clean logs.", "Monitor."},
		},
		Score: 3,
	}})
	if text == "" {
		t.Fatal("expected formatted recommendation")
	}
	for _, want := range []string{"Runbook suggestions", "Disk Full", "Check df."} {
		if !strings.Contains(text, want) {
			t.Fatalf("expected %q in %q", want, text)
		}
	}
}
