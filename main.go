package main

import (
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/niklas/kubecon-guestbook/server"
)

func main() {
	addr := flag.String("addr", envOrDefault("ADDR", ":8080"), "listen address")
	dbPath := flag.String("db", envOrDefault("DB_PATH", "guestbook.db"), "SQLite database path")
	baseURL := flag.String("base-url", envOrDefault("BASE_URL", "http://localhost:8080"), "base URL for QR code")
	flag.Parse()

	store, err := server.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer store.Close()

	hub := server.NewSSEHub()
	checker := server.NewProfanityChecker()
	handler := server.NewHandler(store, hub, checker, *baseURL)

	mux := http.NewServeMux()

	// API routes (Go 1.22+ method patterns)
	mux.HandleFunc("POST /api/submissions", handler.HandleSubmit())
	mux.HandleFunc("GET /api/submissions/stream", hub.HandleSSE())
	mux.HandleFunc("GET /api/qr", handler.HandleQRCode())
	mux.HandleFunc("GET /api/health", handler.HandleHealth())

	// Serve embedded frontend assets if they exist
	distFS, err := fs.Sub(webFS, "web/dist")
	if err == nil {
		mux.Handle("GET /", http.FileServerFS(distFS))
	}

	// Apply middleware: CORS -> Logging -> mux
	wrapped := server.LoggingMiddleware(server.CORSMiddleware(mux))

	log.Printf("Server listening on %s", *addr)
	if err := http.ListenAndServe(*addr, wrapped); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// envOrDefault returns the environment variable value or a default.
func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
