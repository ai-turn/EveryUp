package runbook

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

//go:embed defaults/*.md
var defaultFS embed.FS

type Book struct {
	Name         string
	Description  string
	Severity     string
	ServiceTypes []string
	Patterns     []string
	Steps        []string
	AutoExecute  bool
	Source       string
}

type Incident struct {
	ServiceName string
	CheckType   string
	Endpoint    string
	Message     string
	LastError   string
	LastStatus  int
}

type Recommendation struct {
	Book  Book
	Score int
}

type Library struct {
	books []Book
}

func LoadDefaultLibrary() (*Library, error) {
	library := &Library{}
	if err := library.LoadFS(defaultFS, "defaults"); err != nil {
		return nil, err
	}
	return library, nil
}

func (l *Library) Books() []Book {
	if l == nil {
		return nil
	}
	books := append([]Book(nil), l.books...)
	sort.Slice(books, func(i, j int) bool {
		return books[i].Name < books[j].Name
	})
	return books
}

func (l *Library) LoadFS(files fs.FS, dir string) error {
	entries, err := fs.ReadDir(files, dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".md") {
			continue
		}
		path := filepath.ToSlash(filepath.Join(dir, entry.Name()))
		data, err := fs.ReadFile(files, path)
		if err != nil {
			return err
		}
		book, err := ParseMarkdown(entry.Name(), string(data))
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		book.Source = path
		l.books = append(l.books, book)
	}
	return nil
}

func (l *Library) LoadDir(dir string) error {
	if strings.TrimSpace(dir) == "" {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".md") {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		book, err := ParseMarkdown(entry.Name(), string(data))
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		book.Source = path
		l.books = append(l.books, book)
	}
	return nil
}

func (l *Library) Match(incident Incident, limit int) []Recommendation {
	if l == nil || len(l.books) == 0 {
		return nil
	}
	if limit <= 0 {
		limit = 3
	}

	text := strings.ToLower(strings.Join([]string{
		incident.ServiceName,
		incident.CheckType,
		incident.Endpoint,
		incident.Message,
		incident.LastError,
		strconv.Itoa(incident.LastStatus),
	}, " "))

	recommendations := make([]Recommendation, 0)
	for _, book := range l.books {
		if !matchesServiceType(book, text) {
			continue
		}
		score := 0
		for _, pattern := range book.Patterns {
			if pattern != "" && strings.Contains(text, strings.ToLower(pattern)) {
				score += 2
			}
		}
		if score == 0 && len(book.Patterns) > 0 {
			continue
		}
		if len(book.ServiceTypes) > 0 {
			score++
		}
		recommendations = append(recommendations, Recommendation{Book: book, Score: score})
	}

	sort.Slice(recommendations, func(i, j int) bool {
		if recommendations[i].Score == recommendations[j].Score {
			return recommendations[i].Book.Name < recommendations[j].Book.Name
		}
		return recommendations[i].Score > recommendations[j].Score
	})
	if len(recommendations) > limit {
		recommendations = recommendations[:limit]
	}
	return recommendations
}

func ParseMarkdown(filename, content string) (Book, error) {
	book := Book{Name: strings.TrimSuffix(filename, filepath.Ext(filename))}
	body := content
	if strings.HasPrefix(strings.TrimLeft(content, "\ufeff\r\n\t "), "---") {
		frontmatter, rest, ok := splitFrontmatter(content)
		if ok {
			body = rest
			applyFrontmatter(&book, frontmatter)
		}
	}
	if book.Name == "" {
		return Book{}, fmt.Errorf("runbook name is required")
	}
	book.Steps = extractSteps(body)
	if len(book.Steps) == 0 {
		return Book{}, fmt.Errorf("runbook steps are required")
	}
	return book, nil
}

func FormatRecommendations(recommendations []Recommendation) string {
	if len(recommendations) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\nRunbook suggestions")
	for _, rec := range recommendations {
		b.WriteString("\n- ")
		b.WriteString(rec.Book.Name)
		if rec.Book.Severity != "" {
			b.WriteString(" [")
			b.WriteString(rec.Book.Severity)
			b.WriteString("]")
		}
		if rec.Book.Description != "" {
			b.WriteString(": ")
			b.WriteString(rec.Book.Description)
		}
		for i, step := range rec.Book.Steps {
			if i >= 3 {
				break
			}
			b.WriteString("\n  ")
			b.WriteString(strconv.Itoa(i + 1))
			b.WriteString(". ")
			b.WriteString(step)
		}
	}
	return b.String()
}

func splitFrontmatter(content string) (string, string, bool) {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var frontmatter strings.Builder
	var body strings.Builder
	lineIndex := 0
	inFrontmatter := false
	closed := false
	for scanner.Scan() {
		line := scanner.Text()
		if lineIndex == 0 && strings.TrimSpace(strings.TrimPrefix(line, "\ufeff")) == "---" {
			inFrontmatter = true
			lineIndex++
			continue
		}
		if inFrontmatter && strings.TrimSpace(line) == "---" {
			inFrontmatter = false
			closed = true
			lineIndex++
			continue
		}
		if inFrontmatter {
			frontmatter.WriteString(line)
			frontmatter.WriteString("\n")
		} else if closed {
			body.WriteString(line)
			body.WriteString("\n")
		}
		lineIndex++
	}
	return frontmatter.String(), body.String(), closed
}

func applyFrontmatter(book *Book, frontmatter string) {
	scanner := bufio.NewScanner(strings.NewReader(frontmatter))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		switch key {
		case "name":
			book.Name = value
		case "description":
			book.Description = value
		case "severity":
			book.Severity = value
		case "service_types":
			book.ServiceTypes = splitList(value)
		case "patterns":
			book.Patterns = splitList(value)
		case "auto_execute":
			book.AutoExecute = strings.EqualFold(value, "true")
		}
	}
}

func splitList(value string) []string {
	value = strings.Trim(value, "[]")
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.Trim(strings.TrimSpace(part), `"'`)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func extractSteps(body string) []string {
	steps := make([]string, 0)
	inSteps := false
	scanner := bufio.NewScanner(strings.NewReader(body))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "## ") {
			inSteps = strings.Contains(lower, "step") || strings.Contains(lower, "action") || strings.Contains(lower, "대응")
			continue
		}
		if !inSteps && strings.HasPrefix(line, "- ") {
			inSteps = true
		}
		if !inSteps {
			continue
		}
		if step, ok := trimStep(line); ok {
			steps = append(steps, step)
		}
	}
	return steps
}

func trimStep(line string) (string, bool) {
	if strings.HasPrefix(line, "- ") {
		return strings.TrimSpace(strings.TrimPrefix(line, "- ")), true
	}
	dot := strings.Index(line, ". ")
	if dot > 0 {
		if _, err := strconv.Atoi(line[:dot]); err == nil {
			return strings.TrimSpace(line[dot+2:]), true
		}
	}
	return "", false
}

func matchesServiceType(book Book, text string) bool {
	if len(book.ServiceTypes) == 0 {
		return true
	}
	for _, serviceType := range book.ServiceTypes {
		if strings.Contains(text, strings.ToLower(serviceType)) {
			return true
		}
	}
	return false
}
