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

// SSEEvent represents a typed SSE event with a type name and JSON data.
type SSEEvent struct {
	Type string // "submission", "deletion", "state"
	Data []byte
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

// Broadcast sends data to all subscribed clients as a "submission" event.
// Kept for backward compatibility; new callers should use BroadcastEvent.
func (h *SSEHub) Broadcast(data []byte) {
	h.BroadcastEvent(SSEEvent{Type: "submission", Data: data})
}

// BroadcastEvent sends a typed SSE event to all subscribers.
// The event is pre-formatted as SSE text: "event: {type}\ndata: {data}\n\n"
func (h *SSEHub) BroadcastEvent(event SSEEvent) {
	msg := []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event.Type, event.Data))
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.subscribers {
		select {
		case ch <- msg:
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

		// Flush headers immediately so the client knows it's connected
		flusher.Flush()

		ch := h.Subscribe()
		defer h.Unsubscribe(ch)

		for {
			select {
			case <-r.Context().Done():
				return
			case data := <-ch:
				// data is already pre-formatted SSE text from BroadcastEvent
				w.Write(data)
				flusher.Flush()
			}
		}
	}
}
