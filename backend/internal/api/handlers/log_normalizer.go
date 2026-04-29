package handlers

import (
	"bytes"
	"encoding/json"
	"net/url"
	"strings"

	"github.com/aiturn/everyup/internal/models"
)

// normalizeFormEncoded handles Python HTTPHandler's form-encoded format
// Fields: levelname, msg, name, pathname, lineno, funcName, etc.
func normalizeFormEncoded(body string) (models.LogIngestEntry, error) {
	values, err := url.ParseQuery(body)
	if err != nil {
		return models.LogIngestEntry{}, err
	}

	entry := models.LogIngestEntry{
		Metadata: make(map[string]interface{}),
	}

	// Message
	if msg := values.Get("msg"); msg != "" {
		entry.Message = msg
	} else if msg := values.Get("message"); msg != "" {
		entry.Message = msg
	}

	// Level
	if lvl := values.Get("levelname"); lvl != "" {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl := values.Get("level"); lvl != "" {
		entry.Level = mapGenericLevel(lvl)
	} else {
		entry.Level = models.LogLevelInfo
	}

	// Collect useful Python fields as metadata
	pyFields := []string{"name", "pathname", "lineno", "funcName", "exc_text", "process", "thread", "created"}
	for _, f := range pyFields {
		if v := values.Get(f); v != "" {
			entry.Metadata[f] = v
		}
	}

	if len(entry.Metadata) == 0 {
		entry.Metadata = nil
	}
	return entry, nil
}

// normalizeRawLogs detects the format of the incoming JSON body and converts it
// into a slice of LogIngestEntry. Supported formats:
//
//   - JSON array:  [{ "level":"error", "message":"..." }, ...] (Fluent Bit)
//   - MT native:   { "level":"debug", "message":"..." } or { "logs":[...] }
//   - Winston:     { "level":"info", "message":"...", "timestamp":"..." }
//   - Serilog:     { "events":[{ "@t":"...", "@mt":"...", "@l":"Verbose" }] }
//   - Logstash:    { "@timestamp":"...", "level":"DEBUG", "message":"..." }
//   - Python dict: { "levelname":"TRACE", "msg":"...", "name":"root" }
//
// Levels are preserved as one of: error, warn, info, debug, trace.
func normalizeRawLogs(body []byte) ([]models.LogIngestEntry, error) {
	// Try JSON array first (Fluent Bit HTTP output sends bare arrays)
	body = bytes.TrimSpace(body)
	if len(body) > 0 && body[0] == '[' {
		var arr []interface{}
		if err := json.Unmarshal(body, &arr); err == nil {
			return normalizeNativeArray(arr), nil
		}
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	// 1) Serilog batch — has "events" array
	if events, ok := raw["events"]; ok {
		if arr, ok := events.([]interface{}); ok {
			return normalizeSerilogEvents(arr), nil
		}
	}

	// 2) MT native batch — has "logs" array
	if logs, ok := raw["logs"]; ok {
		if arr, ok := logs.([]interface{}); ok {
			return normalizeNativeArray(arr), nil
		}
	}

	// 3) Single log — detect format
	entry := normalizeSingleRaw(raw)
	if entry.Message != "" {
		return []models.LogIngestEntry{entry}, nil
	}

	// Fallback: treat entire body as message
	return []models.LogIngestEntry{{
		Level:   models.LogLevelInfo,
		Message: string(body),
	}}, nil
}

// normalizeSerilogEvents converts Serilog Compact JSON / Default JSON events
func normalizeSerilogEvents(events []interface{}) []models.LogIngestEntry {
	entries := make([]models.LogIngestEntry, 0, len(events))
	for _, ev := range events {
		obj, ok := ev.(map[string]interface{})
		if !ok {
			continue
		}
		entry := normalizeSerilogEvent(obj)
		if entry.Message != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

func normalizeSerilogEvent(obj map[string]interface{}) models.LogIngestEntry {
	entry := models.LogIngestEntry{
		Metadata: make(map[string]interface{}),
	}

	// Message: @mt (message template) or RenderedMessage or MessageTemplate
	if mt, ok := getString(obj, "@mt"); ok {
		entry.Message = mt
	} else if rm, ok := getString(obj, "RenderedMessage"); ok {
		entry.Message = rm
	} else if mt2, ok := getString(obj, "MessageTemplate"); ok {
		entry.Message = mt2
	}

	// Level: @l or Level
	if l, ok := getString(obj, "@l"); ok {
		entry.Level = mapSerilogLevel(l)
	} else if l2, ok := getString(obj, "Level"); ok {
		entry.Level = mapSerilogLevel(l2)
	} else {
		entry.Level = models.LogLevelInfo // Serilog omits @l when Information
	}

	// Exception: @x or Exception
	if x, ok := getString(obj, "@x"); ok {
		entry.Metadata["exception"] = x
	} else if x2, ok := getString(obj, "Exception"); ok {
		entry.Metadata["exception"] = x2
	}

	// Timestamp: @t or Timestamp → metadata
	if t, ok := getString(obj, "@t"); ok {
		entry.Metadata["originalTimestamp"] = t
	} else if t2, ok := getString(obj, "Timestamp"); ok {
		entry.Metadata["originalTimestamp"] = t2
	}

	// Properties (Default JSON format)
	if props, ok := obj["Properties"].(map[string]interface{}); ok {
		for k, v := range props {
			entry.Metadata[k] = v
		}
	}

	// Remaining fields as metadata (Compact JSON — props are at top level)
	for k, v := range obj {
		switch k {
		case "@t", "@mt", "@l", "@x", "@i", "@r",
			"Timestamp", "Level", "MessageTemplate", "RenderedMessage",
			"Exception", "Properties":
			continue
		default:
			entry.Metadata[k] = v
		}
	}

	if len(entry.Metadata) == 0 {
		entry.Metadata = nil
	}
	return entry
}

// mapSerilogLevel converts Serilog level names to our LogLevel
func mapSerilogLevel(level string) models.LogLevel {
	switch strings.ToLower(level) {
	case "fatal", "error":
		return models.LogLevelError
	case "warning":
		return models.LogLevelWarn
	case "information":
		return models.LogLevelInfo
	case "debug":
		return models.LogLevelDebug
	case "verbose":
		return models.LogLevelTrace
	default:
		return models.LogLevel(strings.ToLower(level))
	}
}

// normalizeNativeArray converts our native { "logs": [...] } format
func normalizeNativeArray(arr []interface{}) []models.LogIngestEntry {
	entries := make([]models.LogIngestEntry, 0, len(arr))
	for _, item := range arr {
		obj, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		entry := normalizeSingleRaw(obj)
		if entry.Message != "" {
			entries = append(entries, entry)
		}
	}
	return entries
}

// normalizeSingleRaw auto-detects a single log object format
func normalizeSingleRaw(obj map[string]interface{}) models.LogIngestEntry {
	// Serilog single event (has @mt or @t)
	if _, ok := obj["@mt"]; ok {
		return normalizeSerilogEvent(obj)
	}
	if _, ok := obj["@t"]; ok {
		return normalizeSerilogEvent(obj)
	}

	// Python HTTPHandler format (has "levelname" + "msg")
	if _, ok := obj["levelname"]; ok {
		return normalizePythonLog(obj)
	}

	// Logstash/Logback format (has "@timestamp" or "logger_name")
	if _, ok := obj["@timestamp"]; ok {
		return normalizeLogstashLog(obj)
	}
	if _, ok := obj["logger_name"]; ok {
		return normalizeLogstashLog(obj)
	}

	// Winston / MT native format (has "level" + "message")
	return normalizeWinstonLog(obj)
}

// normalizeWinstonLog handles Winston and MT native format
// Winston sends: { level, message, timestamp, ...extraMetadata }
func normalizeWinstonLog(obj map[string]interface{}) models.LogIngestEntry {
	entry := models.LogIngestEntry{}

	if msg, ok := getString(obj, "message"); ok {
		entry.Message = msg
	} else if msg, ok := getString(obj, "msg"); ok {
		entry.Message = msg
	} else if msg, ok := getString(obj, "log"); ok {
		entry.Message = msg
	}
	if lvl, ok := getString(obj, "level"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "levelname"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "severity"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "logLevel"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "log_level"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "lvl"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else {
		entry.Level = inferLevelFromMessage(entry.Message)
		if entry.Level == "" {
			entry.Level = inferLevelFromStream(obj)
		}
	}

	// Collect remaining fields as metadata
	meta := make(map[string]interface{})
	for k, v := range obj {
		switch k {
		case "level", "levelname", "severity", "logLevel", "log_level", "lvl", "message", "msg", "log", "logs":
			continue
		default:
			meta[k] = v
		}
	}

	// If there's a nested "metadata" object, merge it
	if nested, ok := obj["metadata"].(map[string]interface{}); ok {
		delete(meta, "metadata")
		for k, v := range nested {
			meta[k] = v
		}
	}

	if len(meta) > 0 {
		entry.Metadata = meta
	}
	return entry
}

// normalizePythonLog handles Python logging HTTPHandler / dict format
// Fields: levelname, msg, name, pathname, lineno, funcName, exc_text, etc.
func normalizePythonLog(obj map[string]interface{}) models.LogIngestEntry {
	entry := models.LogIngestEntry{
		Metadata: make(map[string]interface{}),
	}

	if msg, ok := getString(obj, "msg"); ok {
		entry.Message = msg
	} else if msg2, ok := getString(obj, "message"); ok {
		entry.Message = msg2
	}

	if lvl, ok := getString(obj, "levelname"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl2, ok := getString(obj, "level"); ok {
		entry.Level = mapGenericLevel(lvl2)
	}

	// Map useful Python fields
	pyFields := []string{"name", "pathname", "lineno", "funcName", "exc_text", "exc_info", "stack_info", "created", "process", "thread"}
	for _, f := range pyFields {
		if v, ok := obj[f]; ok {
			entry.Metadata[f] = v
		}
	}

	if len(entry.Metadata) == 0 {
		entry.Metadata = nil
	}
	return entry
}

// normalizeLogstashLog handles Logstash/Logback encoder format
// Fields: @timestamp, level, message, logger_name, thread_name, stack_trace, etc.
func normalizeLogstashLog(obj map[string]interface{}) models.LogIngestEntry {
	entry := models.LogIngestEntry{
		Metadata: make(map[string]interface{}),
	}

	if msg, ok := getString(obj, "message"); ok {
		entry.Message = msg
	}
	if lvl, ok := getString(obj, "level"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else if lvl, ok := getString(obj, "severity"); ok {
		entry.Level = mapGenericLevel(lvl)
	} else {
		entry.Level = inferLevelFromMessage(entry.Message)
		if entry.Level == "" {
			entry.Level = inferLevelFromStream(obj)
		}
	}

	// Map useful Logstash fields
	for k, v := range obj {
		switch k {
		case "level", "message":
			continue
		case "@timestamp":
			entry.Metadata["originalTimestamp"] = v
		case "stack_trace":
			entry.Metadata["exception"] = v
		default:
			entry.Metadata[k] = v
		}
	}

	if len(entry.Metadata) == 0 {
		entry.Metadata = nil
	}
	return entry
}

// mapGenericLevel normalizes common level strings to our LogLevel
func mapGenericLevel(level string) models.LogLevel {
	switch strings.ToUpper(level) {
	case "FATAL", "CRITICAL", "ERROR", "ERR":
		return models.LogLevelError
	case "WARN", "WARNING":
		return models.LogLevelWarn
	case "INFO", "INFORMATION":
		return models.LogLevelInfo
	case "DEBUG":
		return models.LogLevelDebug
	case "TRACE", "VERBOSE":
		return models.LogLevelTrace
	default:
		return models.LogLevel(strings.ToLower(level))
	}
}

func inferLevelFromMessage(message string) models.LogLevel {
	upper := strings.ToUpper(strings.TrimSpace(message))
	switch {
	case hasLevelPrefix(upper, "FATAL"),
		hasLevelPrefix(upper, "CRITICAL"),
		hasLevelPrefix(upper, "ERROR"),
		hasLevelPrefix(upper, "ERR"):
		return models.LogLevelError
	case hasLevelPrefix(upper, "WARN"),
		hasLevelPrefix(upper, "WARNING"):
		return models.LogLevelWarn
	case hasLevelPrefix(upper, "INFO"):
		return models.LogLevelInfo
	case hasLevelPrefix(upper, "DEBUG"):
		return models.LogLevelDebug
	case hasLevelPrefix(upper, "TRACE"),
		hasLevelPrefix(upper, "VERBOSE"):
		return models.LogLevelTrace
	default:
		return ""
	}
}

func inferLevelFromStream(obj map[string]interface{}) models.LogLevel {
	if stream, ok := getString(obj, "stream"); ok && strings.EqualFold(stream, "stderr") {
		return models.LogLevelError
	}
	return models.LogLevelInfo
}

func hasLevelPrefix(message, level string) bool {
	message = strings.TrimPrefix(message, "[")
	message = strings.TrimPrefix(message, "(")
	if !strings.HasPrefix(message, level) {
		return false
	}
	if len(message) == len(level) {
		return true
	}
	switch message[len(level)] {
	case ' ', ':', '-', ']', ')':
		return true
	default:
		return false
	}
}

// getString safely extracts a string value from a map
func getString(obj map[string]interface{}, key string) (string, bool) {
	v, ok := obj[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}
