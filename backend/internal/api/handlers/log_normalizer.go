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
		entry.Level = models.LogLevelError
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
//   - MT native:   { "level":"error", "message":"..." } or { "logs":[...] }
//   - Winston:     { "level":"error", "message":"...", "timestamp":"..." }
//   - Serilog:     { "events":[{ "@t":"...", "@mt":"...", "@l":"Error" }] }
//   - Logstash:    { "@timestamp":"...", "level":"ERROR", "message":"..." }
//   - Python dict: { "levelname":"ERROR", "msg":"...", "name":"root" }
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
		Level:   models.LogLevelError,
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
	case "information", "debug", "verbose":
		return models.LogLevelInfo
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
	}
	if lvl, ok := getString(obj, "level"); ok {
		entry.Level = mapGenericLevel(lvl)
	}

	// Collect remaining fields as metadata
	meta := make(map[string]interface{})
	for k, v := range obj {
		switch k {
		case "level", "message", "logs":
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
	case "INFO", "INFORMATION", "DEBUG", "TRACE", "VERBOSE":
		return models.LogLevelInfo
	default:
		return models.LogLevel(strings.ToLower(level))
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
