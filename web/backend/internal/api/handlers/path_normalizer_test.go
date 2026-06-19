package handlers

import "testing"

func TestNormalizePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/users/42", "/users/:id"},
		{"/users/42/posts/7", "/users/:id/posts/:id"},
		{"/health", "/health"},
		{"/api/v1/users", "/api/v1/users"},
		{"/api/v1/users?page=1&limit=10", "/api/v1/users"},
		{"/files/550e8400-e29b-41d4-a716-446655440000", "/files/:id"},
		{"/files/abc", "/files/abc"},
		{"/files/abcdef", "/files/abcdef"},
		{"/files/abcdefghijklmnop", "/files/:id"},
		{"/users/:id/orders", "/users/:id/orders"},
		{"/", "/"},
		{"", ""},
		{"/v2/users/123/items/abc/details", "/v2/users/:id/items/abc/details"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := NormalizePath(tt.input)
			if got != tt.expected {
				t.Errorf("NormalizePath(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
