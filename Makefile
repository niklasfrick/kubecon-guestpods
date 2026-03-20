.PHONY: dev build test test-go test-web clean

# Go server on port 8080
dev:
	go run .

# Build production binary (requires web/dist to exist)
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
	rm -rf bin/ web/dist/ guestbook.db
