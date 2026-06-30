package agent

import "testing"

func TestParseAccessLog(t *testing.T) {
	cases := []struct {
		name   string
		line   string
		method string
		path   string
		status int
		ok     bool
	}{
		{
			name:   "nginx combined",
			line:   `1.2.3.4 - - [10/Oct/2000:13:55:36 +0900] "GET /api/users HTTP/1.1" 200 2326 "-" "curl/8"`,
			method: "GET", path: "/api/users", status: 200, ok: true,
		},
		{
			name:   "apache common 500",
			line:   `10.0.0.1 - - [12/Dec/2025:09:00:00 +0000] "POST /checkout HTTP/1.0" 500 12`,
			method: "POST", path: "/checkout", status: 500, ok: true,
		},
		{
			name:   "json spring style",
			line:   `{"ts":"2025-12-01","method":"DELETE","path":"/api/x/9","status":404,"level":"WARN"}`,
			method: "DELETE", path: "/api/x/9", status: 404, ok: true,
		},
		{
			name:   "json status as string",
			line:   `{"http_method":"PUT","uri":"/v1/items","statusCode":"201"}`,
			method: "PUT", path: "/v1/items", status: 201, ok: true,
		},
		{
			name: "plain app log degrades",
			line: `2025-12-01 INFO starting scheduler, loaded 12 jobs`,
			ok:   false,
		},
		{
			name: "json without status degrades",
			line: `{"level":"info","msg":"connected to db"}`,
			ok:   false,
		},
		{
			name: "out-of-range status rejected",
			line: `1.2.3.4 - - [..] "GET /x HTTP/1.1" 999 0`,
			ok:   false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			method, path, status, ok := parseAccessLog(tc.line)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if !ok {
				return
			}
			if method != tc.method || path != tc.path || status != tc.status {
				t.Fatalf("got (%q,%q,%d), want (%q,%q,%d)", method, path, status, tc.method, tc.path, tc.status)
			}
		})
	}
}
