package accesslog

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Request struct {
	Method     string
	Path       string
	StatusCode int
	Duration   time.Duration
	ClientIP   string
	Timestamp  time.Time
}

var (
	quotedRequestRE = regexp.MustCompile(`(?i)(?:(\d+\.\d+\.\d+\.\d+)\s+[^\"]*\s+)?"(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^\s"]+)\s+HTTP/[0-9.]+"\s+(\d{3})(?:\s+\S+)?(?:\s+(\d+(?:\.\d+)?)(ms|s|sec|msec)?)?`)
	kvRE            = regexp.MustCompile(`(?i)\b(?:method|http\.method|request_method)=(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b.*\b(?:path|url\.path|uri|request_uri|http\.target)=([^\s]+).*\b(?:status|status_code|http\.status_code)=(\d{3})\b`)
	durationKVRE    = regexp.MustCompile(`(?i)\b(?:duration|duration_ms|elapsed|latency|time_ms|request_time)=([0-9]+(?:\.[0-9]+)?)(ms|s|sec|msec)?\b`)
	clientIPKVRE    = regexp.MustCompile(`(?i)\b(?:client_ip|client\.address|remote_addr|ip)=([^\s]+)\b`)
)

func Parse(line string, fallbackTime time.Time) (Request, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return Request{}, false
	}
	if req, ok := parseJSON(line, fallbackTime); ok {
		return req, true
	}
	if req, ok := parseQuoted(line, fallbackTime); ok {
		return req, true
	}
	return parseKeyValue(line, fallbackTime)
}

func parseJSON(line string, fallbackTime time.Time) (Request, bool) {
	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return Request{}, false
	}
	method := upper(firstString(raw, "method", "http.method", "request_method"))
	path := firstString(raw, "path", "url.path", "uri", "request_uri", "http.target")
	status := firstInt(raw, "status", "status_code", "http.status_code")
	if method == "" || path == "" || status == 0 {
		return Request{}, false
	}
	return Request{
		Method:     method,
		Path:       normalizePath(path),
		StatusCode: status,
		Duration:   firstDuration(raw, "duration_ms", "duration", "elapsed", "latency", "request_time"),
		ClientIP:   firstString(raw, "client_ip", "client.address", "remote_addr", "ip"),
		Timestamp:  fallbackTime,
	}, true
}

func parseQuoted(line string, fallbackTime time.Time) (Request, bool) {
	m := quotedRequestRE.FindStringSubmatch(line)
	if len(m) == 0 {
		return Request{}, false
	}
	status, _ := strconv.Atoi(m[4])
	return Request{
		Method:     upper(m[2]),
		Path:       normalizePath(m[3]),
		StatusCode: status,
		Duration:   parseDuration(m[5], m[6]),
		ClientIP:   m[1],
		Timestamp:  fallbackTime,
	}, true
}

func parseKeyValue(line string, fallbackTime time.Time) (Request, bool) {
	m := kvRE.FindStringSubmatch(line)
	if len(m) == 0 {
		return Request{}, false
	}
	status, _ := strconv.Atoi(m[3])
	req := Request{Method: upper(m[1]), Path: normalizePath(m[2]), StatusCode: status, Timestamp: fallbackTime}
	if dm := durationKVRE.FindStringSubmatch(line); len(dm) > 0 {
		req.Duration = parseDuration(dm[1], dm[2])
	}
	if im := clientIPKVRE.FindStringSubmatch(line); len(im) > 0 {
		req.ClientIP = im[1]
	}
	return req, true
}

func firstString(raw map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if v, ok := raw[key]; ok {
			switch value := v.(type) {
			case string:
				return strings.TrimSpace(value)
			case float64:
				return strconv.FormatFloat(value, 'f', -1, 64)
			}
		}
	}
	return ""
}

func firstInt(raw map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if v, ok := raw[key]; ok {
			switch value := v.(type) {
			case float64:
				return int(value)
			case string:
				i, _ := strconv.Atoi(value)
				return i
			}
		}
	}
	return 0
}

func firstDuration(raw map[string]interface{}, keys ...string) time.Duration {
	for _, key := range keys {
		if v, ok := raw[key]; ok {
			switch value := v.(type) {
			case float64:
				if strings.Contains(strings.ToLower(key), "ms") {
					return time.Duration(value * float64(time.Millisecond))
				}
				return time.Duration(value * float64(time.Second))
			case string:
				if d, ok := parseDurationString(value); ok {
					return d
				}
			}
		}
	}
	return 0
}

func parseDurationString(value string) (time.Duration, bool) {
	m := regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)(ms|s|sec|msec)?$`).FindStringSubmatch(strings.TrimSpace(value))
	if len(m) == 0 {
		return 0, false
	}
	return parseDuration(m[1], m[2]), true
}

func parseDuration(value, unit string) time.Duration {
	if value == "" {
		return 0
	}
	f, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	switch strings.ToLower(unit) {
	case "s", "sec":
		return time.Duration(f * float64(time.Second))
	default:
		return time.Duration(f * float64(time.Millisecond))
	}
}

func normalizePath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return path
	}
	if u, err := url.Parse(path); err == nil {
		if u.Path != "" {
			return u.Path
		}
	}
	if i := strings.Index(path, "?"); i >= 0 {
		return path[:i]
	}
	return path
}

func upper(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}
