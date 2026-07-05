package handlers

import "strings"

// sensitiveOTelHeaderNames is the global default list of HTTP header names that
// must be masked when they appear as OTel span attributes
// (`http.request.header.<name>` / `http.response.header.<name>`).
//
// Per-service overrides will be added in a follow-up; this set is the floor.
var sensitiveOTelHeaderNames = map[string]struct{}{
	"authorization":       {},
	"proxy-authorization": {},
	"cookie":              {},
	"set-cookie":          {},
	"x-api-key":           {},
	"x-auth-token":        {},
}

// otelMaskedValue replaces sensitive attribute values.
const otelMaskedValue = "***"

// sensitiveHeaderName reports whether a header attribute name is on the mask
// list. Instrumentations disagree on separators — the Node SDK emits
// `set_cookie` where the Java agent emits `set-cookie` — so underscores are
// normalized to dashes before the lookup.
func sensitiveHeaderName(name string) bool {
	_, sensitive := sensitiveOTelHeaderNames[strings.ReplaceAll(name, "_", "-")]
	return sensitive
}

// maskOTelAttrs scrubs known sensitive keys in a parsed OTel attribute map.
// Mutates the input map in place. Caller owns the map; passing a shared map
// would propagate masking, which is the desired behavior.
func maskOTelAttrs(m map[string]interface{}) {
	for key, val := range m {
		lk := strings.ToLower(key)

		if name, ok := strings.CutPrefix(lk, "http.request.header."); ok {
			if sensitiveHeaderName(name) {
				m[key] = otelMaskedValue
			}
			continue
		}
		if name, ok := strings.CutPrefix(lk, "http.response.header."); ok {
			if sensitiveHeaderName(name) {
				m[key] = otelMaskedValue
			}
			continue
		}

		// OTel HTTP semantic conventions do not standardize a body attribute,
		// but some auto-instrumentations emit `http.request.body` /
		// `http.response.body`. Mask wholesale to avoid leaking PII.
		if lk == "http.request.body" || lk == "http.response.body" {
			m[key] = otelMaskedValue
			continue
		}

		// Recurse into nested maps (KvlistValue) so masking applies to nested
		// attribute groups as well.
		if nested, ok := val.(map[string]interface{}); ok {
			maskOTelAttrs(nested)
		}
	}
}
