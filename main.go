package main

import (
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/niklas/kubecon-guestbook/server"
)

func main() {
	addr := flag.String("addr", envOrDefault("ADDR", ":8080"), "listen address")
	dbPath := flag.String("db", envOrDefault("DB_PATH", "guestbook.db"), "SQLite database path")
	baseURL := flag.String("base-url", envOrDefault("BASE_URL", "http://localhost:8080"), "base URL for QR code")
	adminPassword := flag.String("admin-password", envOrDefault("ADMIN_PASSWORD", ""), "admin panel password")
	flag.Parse()

	if *adminPassword == "" {
		log.Fatal("ADMIN_PASSWORD environment variable or --admin-password flag is required")
	}

	store, err := server.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer store.Close()

	hub := server.NewSSEHub()
	checker := server.NewProfanityChecker()
	sessions := server.NewSessionStore()
	adminState := server.NewAdminState(store)
	handler := server.NewHandler(store, hub, checker, *baseURL, sessions, *adminPassword, adminState)

	mux := http.NewServeMux()

	// API routes (Go 1.22+ method patterns)
	mux.HandleFunc("POST /api/submissions", handler.HandleSubmit())
	mux.HandleFunc("GET /api/submissions/stream", hub.HandleSSE())
	mux.HandleFunc("GET /api/submissions", handler.HandleGetSubmissions())
	mux.HandleFunc("GET /api/qr", handler.HandleQRCode())
	mux.HandleFunc("GET /api/health", handler.HandleHealth())

	// Admin login (unprotected -- must be accessible without a session)
	mux.HandleFunc("POST /api/admin/login", handler.HandleAdminLogin())

	// Admin routes (protected by auth middleware)
	adminMux := http.NewServeMux()
	adminMux.HandleFunc("POST /api/admin/toggle", handler.HandleToggle())
	adminMux.HandleFunc("DELETE /api/admin/submissions/{id}", handler.HandleDelete())
	adminMux.HandleFunc("GET /api/admin/stats", handler.HandleStats())
	adminMux.HandleFunc("GET /api/admin/status", handler.HandleStatus())
	mux.Handle("/api/admin/", server.AuthMiddleware(sessions, adminMux))

	// Serve embedded frontend assets with SPA fallback
	distFS, err := fs.Sub(webFS, "web/dist")
	if err == nil {
		fileServer := http.FileServerFS(distFS)
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			// Try serving the file directly first
			path := r.URL.Path
			if path == "/" {
				fileServer.ServeHTTP(w, r)
				return
			}
			// Check if file exists in embedded FS
			f, err := distFS.Open(strings.TrimPrefix(path, "/"))
			if err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
			// SPA fallback: serve index.html for client-side routes (/admin, /viz)
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
		})
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
