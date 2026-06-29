package proxy

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type CaptureConfig struct {
	Enabled       bool
	Routes        []string
	ExcludeRoutes []string
	MaxBodyBytes  int
	OnStatus      string
	OnSlow        time.Duration
	MaskKeys      []string
	RegexPresets  []string
}

type bodySnapshot struct {
	Body      string
	Size      int
	Truncated bool
	Captured  bool
}

type captureDecision struct {
	candidate bool
	reason    string
}

func (c CaptureConfig) withDefaults() CaptureConfig {
	if c.MaxBodyBytes <= 0 {
		c.MaxBodyBytes = 8192
	}
	if strings.TrimSpace(c.OnStatus) == "" {
		c.OnStatus = "400-599"
	}
	if c.OnSlow <= 0 {
		c.OnSlow = 3 * time.Second
	}
	if len(c.MaskKeys) == 0 {
		c.MaskKeys = []string{"password", "token", "secret", "authorization", "cookie", "set-cookie"}
	}
	if len(c.RegexPresets) == 0 {
		c.RegexPresets = []string{"rrn", "phone", "email", "card"}
	}
	return c
}

func (c CaptureConfig) candidate(r *http.Request) captureDecision {
	c = c.withDefaults()
	if !c.Enabled {
		return captureDecision{reason: "disabled"}
	}
	path := r.URL.Path
	if !matchesAny(path, c.Routes) {
		return captureDecision{reason: "route_not_allowed"}
	}
	if matchesAny(path, c.ExcludeRoutes) {
		return captureDecision{reason: "route_excluded"}
	}
	if !captureableEncoding(r.Header.Get("Content-Encoding")) {
		return captureDecision{reason: "request_encoded"}
	}
	if r.Body != nil && r.Body != http.NoBody && !captureableContentType(r.Header.Get("Content-Type")) {
		return captureDecision{reason: "request_content_type"}
	}
	return captureDecision{candidate: true}
}

func (c CaptureConfig) shouldKeepBody(statusCode int, latency time.Duration) bool {
	c = c.withDefaults()
	return statusMatches(statusCode, c.OnStatus) || latency >= c.OnSlow
}

func snapshotAndRestoreBody(body io.ReadCloser, maxBytes int, maskCfg CaptureConfig, contentType string) (bodySnapshot, io.ReadCloser) {
	if body == nil || body == http.NoBody || maxBytes <= 0 {
		return bodySnapshot{}, body
	}
	limited := io.LimitReader(body, int64(maxBytes)+1)
	prefix, err := io.ReadAll(limited)
	restored := &readCloser{Reader: io.MultiReader(bytes.NewReader(prefix), body), Closer: body}
	if err != nil {
		return bodySnapshot{}, restored
	}
	truncated := len(prefix) > maxBytes
	if truncated {
		prefix = prefix[:maxBytes]
	}
	return bodySnapshot{
		Body:      maskBody(prefix, maskCfg, contentType),
		Size:      len(prefix),
		Truncated: truncated,
		Captured:  len(prefix) > 0,
	}, restored
}

type readCloser struct {
	io.Reader
	io.Closer
}

func captureableEncoding(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	return value == "" || value == "identity"
}

func captureableContentType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	if err != nil {
		mediaType = strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0]))
	}
	mediaType = strings.ToLower(mediaType)
	if mediaType == "" {
		return false
	}
	if strings.HasPrefix(mediaType, "multipart/") || mediaType == "application/x-www-form-urlencoded" || mediaType == "text/event-stream" || mediaType == "application/grpc" {
		return false
	}
	return mediaType == "application/json" || strings.HasSuffix(mediaType, "+json") || strings.HasPrefix(mediaType, "text/") || mediaType == "application/xml" || strings.HasSuffix(mediaType, "+xml")
}

func streamingResponse(resp *http.Response) bool {
	if strings.EqualFold(resp.Header.Get("Upgrade"), "websocket") {
		return true
	}
	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	return strings.Contains(ct, "text/event-stream") || strings.Contains(ct, "application/grpc")
}

func matchesAny(path string, rules []string) bool {
	if len(rules) == 0 {
		return false
	}
	for _, rule := range rules {
		rule = strings.TrimSpace(rule)
		if rule == "" {
			continue
		}
		if rule == "*" || rule == "/..." {
			return true
		}
		if strings.HasSuffix(rule, "...") {
			if strings.HasPrefix(path, strings.TrimSuffix(rule, "...")) {
				return true
			}
			continue
		}
		if strings.HasSuffix(rule, "*") {
			if strings.HasPrefix(path, strings.TrimSuffix(rule, "*")) {
				return true
			}
			continue
		}
		if path == rule {
			return true
		}
	}
	return false
}

func statusMatches(statusCode int, expr string) bool {
	for _, part := range strings.Split(expr, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.Contains(part, "-") {
			bounds := strings.SplitN(part, "-", 2)
			lo, errLo := strconv.Atoi(strings.TrimSpace(bounds[0]))
			hi, errHi := strconv.Atoi(strings.TrimSpace(bounds[1]))
			if errLo == nil && errHi == nil && statusCode >= lo && statusCode <= hi {
				return true
			}
			continue
		}
		code, err := strconv.Atoi(part)
		if err == nil && statusCode == code {
			return true
		}
	}
	return false
}

func maskBody(body []byte, cfg CaptureConfig, contentType string) string {
	masked := string(body)
	if isJSONContent(contentType) {
		var decoded interface{}
		if err := json.Unmarshal(body, &decoded); err == nil {
			maskJSON(decoded, maskSet(cfg.withDefaults().MaskKeys))
			if encoded, err := json.Marshal(decoded); err == nil {
				masked = string(encoded)
			}
		}
	}
	for _, preset := range cfg.withDefaults().RegexPresets {
		masked = applyRegexPreset(masked, preset)
	}
	return masked
}

func isJSONContent(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		mediaType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	}
	return mediaType == "application/json" || strings.HasSuffix(mediaType, "+json")
}

func maskSet(keys []string) map[string]struct{} {
	out := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		key = strings.ToLower(strings.TrimSpace(key))
		if key != "" {
			out[key] = struct{}{}
		}
	}
	return out
}

func maskJSON(value interface{}, keys map[string]struct{}) {
	switch v := value.(type) {
	case map[string]interface{}:
		for key, child := range v {
			if _, ok := keys[strings.ToLower(key)]; ok {
				v[key] = "***"
				continue
			}
			maskJSON(child, keys)
		}
	case []interface{}:
		for _, child := range v {
			maskJSON(child, keys)
		}
	}
}

func applyRegexPreset(value, preset string) string {
	switch strings.ToLower(strings.TrimSpace(preset)) {
	case "email":
		return regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`).ReplaceAllString(value, "***")
	case "phone":
		return regexp.MustCompile(`\b(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}\b`).ReplaceAllString(value, "***")
	case "rrn":
		return regexp.MustCompile(`\b\d{6}[- ]?[1-4]\d{6}\b`).ReplaceAllString(value, "***")
	case "card":
		return regexp.MustCompile(`\b(?:\d[ -]*?){13,19}\b`).ReplaceAllString(value, "***")
	default:
		return value
	}
}
