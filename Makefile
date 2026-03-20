.PHONY: dev dev-server dev-web build build-web test test-go test-web clean

# Run Go server + Vite dev server concurrently
dev:
	@echo "Starting Go server on :8080 and Vite dev server on :5173"
	@echo "Open http://localhost:5173 for hot-reload development"
	$(MAKE) dev-server & $(MAKE) dev-web && wait

dev-server:
	go run .

dev-web:
	cd web && npm run dev

# Build production binary with embedded frontend
build: build-web
	go build -o bin/guestbook .

# Build frontend
build-web:
	cd web && npm ci && npm run build

# Run all tests
test: test-go

# Go tests with race detector
test-go:
	go test -race -count=1 ./...

# Frontend tests (added in Plan 02)
test-web:
	cd web && npx vitest run

# Clean build artifacts
clean:
	rm -rf bin/ web/dist/ web/node_modules/ guestbook.db guestbook.db-wal guestbook.db-shm
