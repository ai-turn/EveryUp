package handlers

import "testing"

func TestMaskOTelAttrsHeaderSeparatorVariants(t *testing.T) {
	// The Java agent emits dash names, the Node SDK underscore names — both
	// spellings of a sensitive header must be masked.
	attrs := map[string]interface{}{
		"http.request.header.authorization": "Bearer abc",
		"http.response.header.set-cookie":   "sid=1",
		"http.response.header.set_cookie":   "sid=2",
		"http.request.header.x_api_key":     "k",
		"http.request.header.content-type":  "application/json",
		"http.request.header.content_type":  []interface{}{"application/json"},
		"http.request.body":                 `{"a":1}`,
	}
	maskOTelAttrs(attrs)

	masked := []string{
		"http.request.header.authorization",
		"http.response.header.set-cookie",
		"http.response.header.set_cookie",
		"http.request.header.x_api_key",
		"http.request.body",
	}
	for _, key := range masked {
		if attrs[key] != otelMaskedValue {
			t.Fatalf("%s = %v, want masked", key, attrs[key])
		}
	}
	if attrs["http.request.header.content-type"] != "application/json" {
		t.Fatalf("content-type should not be masked: %v", attrs["http.request.header.content-type"])
	}
	if _, ok := attrs["http.request.header.content_type"].([]interface{}); !ok {
		t.Fatalf("content_type should keep its value: %v", attrs["http.request.header.content_type"])
	}
}
