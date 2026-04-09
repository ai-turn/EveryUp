package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

func main() {
	port := os.Getenv("LOG_AGENT_WEB_CONSOLE_PORT")
	if port == "" {
		port = "8080"
	}

	os.MkdirAll("/var/log/app", 0755)

	mux := http.NewServeMux()
	mux.HandleFunc("/log", handleLog)
	mux.HandleFunc("/config", handleConfig)
	mux.HandleFunc("/", serveTestUI)
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("/test/www"))))

	addr := ":" + port
	fmt.Fprintf(os.Stdout, "[test-ui] Log Agent Test Console started on http://0.0.0.0%s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}

func serveTestUI(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, "/test/www/index.html")
}

func maskAPIKey(key string) string {
	if len(key) == 0 {
		return "(not set)"
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + strings.Repeat("*", len(key)-7) + key[len(key)-3:]
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	endpoint := os.Getenv("LOG_AGENT_ENDPOINT")
	if endpoint == "" {
		endpoint = "(not set)"
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	fmt.Fprintf(w, `{"endpoint":%q,"apiKey":%q}`, endpoint, maskAPIKey(os.Getenv("LOG_AGENT_API_KEY")))
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil || len(body) == 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	f, err := os.OpenFile("/var/log/app/test.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	f.Write(body)
	if body[len(body)-1] != '\n' {
		f.Write([]byte{'\n'})
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	fmt.Fprint(w, `{"ok":true}`)
}
