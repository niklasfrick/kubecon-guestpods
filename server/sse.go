package server

import (
	"fmt"
	"net/http"
	"sync"
)

// SSEHub manages SSE client subscriptions and broadcasts events to all connected clients.
type SSEHub struct {
	mu          sync.RWMutex
	subscribers map[chan []byte]struct{}
}

// NewSSEHub creates a new SSE hub.
func NewSSEHub() *SSEHub {
	return &SSEHub{
		subscribers: make(map[chan []byte]struct{}),
	}
}

// Subscribe registers a new client and returns a buffered channel for receiving events.
func (h *SSEHub) Subscribe() chan []byte {
	ch := make(chan []byte, 16) // buffered to avoid blocking broadcaster
	h.mu.Lock()
	h.subscribers[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unsubscribe removes a client channel from the hub and closes it.
func (h *SSEHub) Unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.subscribers, ch)
	close(ch)
	h.mu.Unlock()
}

// Broadcast sends data to all subscribed clients. Slow clients that have full
// buffers are skipped (non-blocking send) to prevent blocking the broadcaster.
func (h *SSEHub) Broadcast(data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.subscribers {
		select {
		case ch <- data:
		default:
			// Drop if client is slow -- prevent blocking
		}
	}
}

// HandleSSE returns an http.HandlerFunc that streams SSE events to connected clients.
func (h *SSEHub) HandleSSE() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		ch := h.Subscribe()
		defer h.Unsubscribe(ch)

		for {
			select {
			case <-r.Context().Done():
				return
			case data := <-ch:
				fmt.Fprintf(w, "event: submission\ndata: %s\n\n", data)
				flusher.Flush()
			}
		}
	}
}
