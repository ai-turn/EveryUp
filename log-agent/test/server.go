package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("MT_TEST_PORT")
	if port == "" {
		port = "8080"
	}

	os.MkdirAll("/var/log/app", 0755)

	mux := http.NewServeMux()
	mux.HandleFunc("/log", handleLog)
	mux.Handle("/", http.FileServer(http.Dir("/test/www")))

	addr := ":" + port
	fmt.Fprintf(os.Stdout, "[test-ui] Log Agent Test Console started on http://0.0.0.0%s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
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
