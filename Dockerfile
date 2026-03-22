# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /guestbook .

# Stage 3: Minimal runtime
FROM gcr.io/distroless/static:nonroot
COPY --from=builder /guestbook /guestbook
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/guestbook"]
