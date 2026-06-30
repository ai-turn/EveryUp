package agent

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

// accessLogRequestRe matches the quoted request line + status code shared by the
// Nginx combined and Apache common/combined formats:
//
//	1.2.3.4 - - [10/Oct/2000:13:55:36 +0900] "GET /api/x HTTP/1.1" 200 2326 "ref" "ua"
var accessLogRequestRe = regexp.MustCompile(`"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) (\S+) HTTP/\d\.\d" (\d{3})`)

// parseAccessLog pulls method/path/status from one log line. It recognizes the
// common Nginx/Apache text format and structured JSON logs. Anything it does not
// recognize returns ok=false so the caller leaves the line as a plain log — the
// status signal degrades, the log itself is untouched.
//
// ponytail: latency (RED's D) is intentionally not extracted — formats disagree
// on the field and the unit. Add it when a customer needs duration-from-logs.
func parseAccessLog(message string) (method, path string, status int, ok bool) {
	message = strings.TrimSpace(message)
	if strings.HasPrefix(message, "{") {
		return parseJSONAccessLog(message)
	}
	m := accessLogRequestRe.FindStringSubmatch(message)
	if m == nil {
		return "", "", 0, false
	}
	code, err := strconv.Atoi(m[3])
	if err != nil || code < 100 || code > 599 {
		return "", "", 0, false
	}
	return m[1], m[2], code, true
}

// Common field names across structured access logs (Spring, Go frameworks,
// generic JSON loggers). A line is treated as an access log only when a valid
// HTTP status is present; method/path are best-effort enrichment.
var (
	jsonStatusKeys = []string{"status", "status_code", "statusCode", "http.response.status_code", "http_status", "resp_status"}
	jsonMethodKeys = []string{"method", "http_method", "http.request.method", "verb"}
	jsonPathKeys   = []string{"path", "uri", "url", "http.target", "request_uri"}
)

func parseJSONAccessLog(message string) (method, path string, status int, ok bool) {
	var fields map[string]interface{}
	if err := json.Unmarshal([]byte(message), &fields); err != nil {
		return "", "", 0, false
	}
	status, ok = jsonStatus(fields)
	if !ok {
		return "", "", 0, false
	}
	return jsonString(fields, jsonMethodKeys), jsonString(fields, jsonPathKeys), status, true
}

func jsonStatus(fields map[string]interface{}) (int, bool) {
	for _, key := range jsonStatusKeys {
		switch n := fields[key].(type) {
		case float64:
			if code := int(n); code >= 100 && code <= 599 {
				return code, true
			}
		case string:
			if code, err := strconv.Atoi(strings.TrimSpace(n)); err == nil && code >= 100 && code <= 599 {
				return code, true
			}
		}
	}
	return 0, false
}

func jsonString(fields map[string]interface{}, keys []string) string {
	for _, key := range keys {
		if v, ok := fields[key].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
