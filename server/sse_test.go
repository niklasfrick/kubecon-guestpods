package server

import (
	"bufio"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSSEKeepalive(t *testing.T) {
	hub := NewSSEHub()

	// Override interval to 50ms for fast testing
	orig := SSEKeepAliveInterval
	SSEKeepAliveInterval = 50 * time.Millisecond
	defer func() { SSEKeepAliveInterval = orig }()

	ts := httptest.NewServer(hub.HandleSSE())
	defer ts.Close()

	client := &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
	}

	resp, err := client.Get(ts.URL)
	if err != nil {
		t.Fatalf("SSE request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	// Read lines until we see the keep-alive comment or timeout
	scanner := bufio.NewScanner(resp.Body)
	found := false
	deadline := time.After(500 * time.Millisecond)
	lineCh := make(chan string, 10)

	go func() {
		for scanner.Scan() {
			lineCh <- scanner.Text()
		}
		close(lineCh)
	}()

	for {
		select {
		case line, ok := <-lineCh:
			if !ok {
				t.Fatal("SSE stream closed before keep-alive received")
			}
			if line == ": keepalive" {
				found = true
			}
		case <-deadline:
			if !found {
				t.Fatal("did not receive keep-alive comment within 500ms")
			}
		}
		if found {
			break
		}
	}
}

func TestSSEKeepalive_ExactFormat(t *testing.T) {
	hub := NewSSEHub()

	// Override interval to 50ms for fast testing
	orig := SSEKeepAliveInterval
	SSEKeepAliveInterval = 50 * time.Millisecond
	defer func() { SSEKeepAliveInterval = orig }()

	ts := httptest.NewServer(hub.HandleSSE())
	defer ts.Close()

	client := &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
	}

	resp, err := client.Get(ts.URL)
	if err != nil {
		t.Fatalf("SSE request failed: %v", err)
	}
	defer resp.Body.Close()

	// Read raw bytes to verify exact format ": keepalive\n\n"
	buf := make([]byte, 256)
	deadline := time.After(500 * time.Millisecond)
	dataCh := make(chan string, 10)

	go func() {
		for {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				dataCh <- string(buf[:n])
			}
			if err != nil {
				return
			}
		}
	}()

	var accumulated string
	for {
		select {
		case data := <-dataCh:
			accumulated += data
			if strings.Contains(accumulated, ": keepalive\n\n") {
				return // Test passes
			}
		case <-deadline:
			t.Fatalf("did not receive exact keep-alive format within 500ms, got: %q", accumulated)
		}
	}
}

func TestSSEKeepalive_DataStillDelivered(t *testing.T) {
	hub := NewSSEHub()

	// Override interval to 50ms for fast testing
	orig := SSEKeepAliveInterval
	SSEKeepAliveInterval = 50 * time.Millisecond
	defer func() { SSEKeepAliveInterval = orig }()

	ts := httptest.NewServer(hub.HandleSSE())
	defer ts.Close()

	client := &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
	}

	resp, err := client.Get(ts.URL)
	if err != nil {
		t.Fatalf("SSE request failed: %v", err)
	}
	defer resp.Body.Close()

	// Wait for first keep-alive, then broadcast a data event
	time.Sleep(100 * time.Millisecond)
	hub.BroadcastEvent(SSEEvent{Type: "submission", Data: []byte(`{"id":1}`)})

	// Read from stream -- should find both keep-alive and the data event
	buf := make([]byte, 4096)
	deadline := time.After(500 * time.Millisecond)
	dataCh := make(chan string, 10)

	go func() {
		for {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				dataCh <- string(buf[:n])
			}
			if err != nil {
				return
			}
		}
	}()

	var accumulated string
	foundKeepalive := false
	foundData := false
	for {
		select {
		case data := <-dataCh:
			accumulated += data
			if strings.Contains(accumulated, ": keepalive") {
				foundKeepalive = true
			}
			if strings.Contains(accumulated, `event: submission`) && strings.Contains(accumulated, `{"id":1}`) {
				foundData = true
			}
		case <-deadline:
			if !foundKeepalive {
				t.Errorf("did not receive keep-alive, got: %q", accumulated)
			}
			if !foundData {
				t.Errorf("did not receive data event, got: %q", accumulated)
			}
			if !foundKeepalive || !foundData {
				t.FailNow()
			}
		}
		if foundKeepalive && foundData {
			return
		}
	}
}
