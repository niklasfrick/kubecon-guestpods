# Phase 1: Server Core + Submission Form - Research

**Researched:** 2026-03-20
**Domain:** Go HTTP server, SQLite persistence, SSE broadcasting, Preact mobile form
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield build of a Go monolith serving a Preact frontend. The Go server uses only the standard library (`net/http` with Go 1.22+ enhanced routing), persists submissions to SQLite via `modernc.org/sqlite` (pure Go, no CGo), broadcasts new submissions over Server-Sent Events, and embeds the built frontend assets via `go:embed`. The frontend is a Preact 10.x + Vite 8 + TypeScript single-page form optimized for mobile, using Preact Signals for state management. The form collects name, country (full ISO 3166-1 list), and homelab maturity level (5-level emoji scale).

The architecture is intentionally simple: a single Go binary with embedded assets, a single SQLite file for persistence, and SSE for real-time push. No external dependencies beyond the Go modules and npm packages listed below. This simplicity is critical -- the app must work reliably during a live KubeCon talk with 500 concurrent users on conference WiFi.

**Primary recommendation:** Build a single Go binary that embeds Vite-built Preact assets, uses `modernc.org/sqlite` for zero-dependency persistence, implements SSE with the standard library `http.Flusher` pattern, and filters profanity with `TwiN/go-away`. Keep the frontend under 50KB gzipped for the 2-second load target on 4G.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Emoji grid is a 5-level homelab maturity scale (not free-choice): 1. "What's a homelab?" 2. "A Pi and a dream" 3. "The spare laptop era" 4. "My partner asks about the electricity bill" 5. "I have an on-call rotation for my house"
- Displayed as horizontal scale on mobile; tapping shows description below
- Location: Full list of all countries, European countries at top, search/filter capability
- Namespace labels: flag emoji + country code (e.g., ns/DE)
- Every country gets its own namespace, even with 1 attendee
- Single page form -- all fields visible at once (no multi-step wizard)
- Submit button text: "kubectl apply"
- Form field labels: "Your name", "Where are you from?", "Homelab level"
- Post-submission: form replaced by K8s-style confirmation ("Pod deployed!", emoji + name + namespace, "Status: Running", "Look up at the screen to find yourself!")
- No re-submit or edit -- one submission per visitor
- Closed state: visiting form URL redirects to visualization page
- Tech stack: Go with standard library (net/http), Preact + Vite + TypeScript, SQLite, SSE, server-side profanity filter

### Claude's Discretion
- CSS framework / styling approach for the form
- Exact country list source and ordering algorithm
- Profanity blocklist source and implementation
- QR code generation approach
- SSE event format and API endpoint design
- SQLite schema design
- Monorepo directory structure details
- Error states and validation UX

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUBM-01 | Attendee can access guestbook via QR code on slide | QR code generation with `skip2/go-qrcode`, served as PNG endpoint |
| SUBM-02 | Attendee can access guestbook via short memorable URL | Go HTTP server serves embedded Preact app at root path |
| SUBM-03 | Attendee can submit name on mobile-friendly form | Preact form with Pico CSS or custom lightweight CSS, single-page layout |
| SUBM-04 | Attendee can select location from dropdown | ISO 3166-1 country list embedded in frontend, European countries prioritized |
| SUBM-05 | Attendee can select homelab emoji from 5-level scale | Custom horizontal segmented control component in Preact |
| SUBM-06 | Attendee sees "Pod deployed!" confirmation after submitting | Preact state transition replaces form with K8s-themed confirmation |
| SUBM-07 | Name filtered against profanity blocklist | `TwiN/go-away` server-side check before persistence |
| INFR-04 | Form page loads in under 2 seconds on 4G | Preact (~4KB) + minimal CSS, embedded assets, gzip, no heavy deps |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.25.x or 1.26.x | Server language | Current stable releases; 1.22+ enhanced ServeMux routing eliminates need for chi/gorilla |
| net/http (stdlib) | - | HTTP server, routing, SSE | Go 1.22+ method routing + path params; user decision to use stdlib |
| modernc.org/sqlite | v1.47.0 | SQLite driver | Pure Go (no CGo), cross-compiles cleanly for container builds, production-ready |
| github.com/TwiN/go-away | v1.8.1 | Profanity detection | Lightweight, handles obfuscated profanity (l33t speak), built-in false positive handling |
| github.com/skip2/go-qrcode | v0.0.0-20200617195104 | QR code PNG generation | De facto standard Go QR library, 2.8K stars, generates PNG directly |
| Preact | 10.29.x | Frontend UI framework | 4KB gzipped (vs React 40KB+), critical for 2-second load on 4G |
| @preact/signals | latest | State management | Fine-grained reactivity, no re-renders, ideal for form state |
| @preact/preset-vite | 2.10.x | Vite integration | Official Preact Vite plugin, handles JSX transform, HMR |
| Vite | 8.x | Frontend build tool | Fast builds with Rolldown bundler, tree-shaking, asset hashing |
| TypeScript | 5.x | Type safety | Standard for Preact projects, catches form validation errors at compile time |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| embed (stdlib) | - | Embed built frontend assets into Go binary | Always -- single binary deployment |
| encoding/json (stdlib) | - | JSON API request/response | All API endpoints |
| context (stdlib) | - | Request cancellation, SSE client disconnect detection | SSE handler |
| sync (stdlib) | - | SSE subscriber management (RWMutex) | SSE broadcaster |
| database/sql (stdlib) | - | Database interface | SQLite access via modernc driver |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| modernc.org/sqlite | mattn/go-sqlite3 | 2x faster writes but requires CGo toolchain, complicates Docker builds |
| Custom CSS | Pico CSS (7.7KB gz) | Adds ~8KB but provides instant form styling; custom CSS is lighter but more work |
| go-away | Custom blocklist | go-away handles l33t speak obfuscation ("@$$h073") which a naive blocklist misses |
| Preact Signals | useState hooks | Signals avoid re-renders entirely; for a simple form useState is fine too, but Signals are the Preact-native pattern |
| skip2/go-qrcode | Frontend JS QR generation | Server-side is simpler, generates a static PNG once, no client JS cost |

**Installation (Go):**
```bash
go mod init github.com/niklas/kubecon-guestbook
go get modernc.org/sqlite
go get github.com/TwiN/go-away
go get github.com/skip2/go-qrcode
```

**Installation (Frontend):**
```bash
npm create vite@latest web -- --template preact-ts
cd web
npm install preact @preact/signals
npm install -D @preact/preset-vite typescript
```

## Architecture Patterns

### Recommended Project Structure
```
kubecon-guestbook/
├── go.mod
├── go.sum
├── main.go                  # Entry point, server startup, config
├── server/
│   ├── handler.go           # HTTP handlers (submit, SSE, QR, health)
│   ├── middleware.go         # CORS, logging, gzip middleware
│   ├── sse.go               # SSE broadcaster (hub pattern)
│   ├── store.go             # SQLite data access layer
│   ├── model.go             # Submission struct, validation
│   ├── profanity.go         # Profanity filter wrapper
│   └── handler_test.go      # Handler tests with httptest
├── web/                     # Preact frontend (Vite project)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx          # Preact app entry
│       ├── app.tsx           # Root component (form vs confirmation state)
│       ├── components/
│       │   ├── SubmissionForm.tsx
│       │   ├── CountrySelect.tsx
│       │   ├── HomelabScale.tsx
│       │   └── Confirmation.tsx
│       ├── data/
│       │   └── countries.ts  # ISO 3166-1 country list with codes
│       ├── api.ts            # Fetch wrapper for submission POST
│       └── style.css         # Minimal mobile-first CSS
├── web/dist/                 # Vite build output (gitignored, embedded at compile)
├── embed.go                  # go:embed directive for web/dist
├── Makefile                  # build targets: dev, build, test
└── .planning/
```

### Pattern 1: Go 1.22+ Enhanced ServeMux Routing
**What:** Use method-specific patterns with path variables in the standard ServeMux
**When to use:** All route registration
**Example:**
```go
// Source: https://go.dev/blog/routing-enhancements
mux := http.NewServeMux()

// Method-specific routes (Go 1.22+)
mux.HandleFunc("POST /api/submissions", handleSubmit)
mux.HandleFunc("GET /api/submissions/stream", handleSSE)
mux.HandleFunc("GET /api/qr", handleQRCode)
mux.HandleFunc("GET /api/health", handleHealth)

// Serve embedded frontend assets
mux.Handle("GET /", http.FileServerFS(frontendFS))
```

### Pattern 2: SSE Hub/Broadcaster Pattern
**What:** Central hub that manages SSE client connections and broadcasts events
**When to use:** Real-time push of new submissions to all connected clients
**Example:**
```go
// Source: https://oneuptime.com/blog/post/2026-01-25-server-sent-events-streaming-go/view
type SSEHub struct {
    mu          sync.RWMutex
    subscribers map[chan []byte]struct{}
}

func (h *SSEHub) Subscribe() chan []byte {
    ch := make(chan []byte, 16) // buffered to avoid blocking
    h.mu.Lock()
    h.subscribers[ch] = struct{}{}
    h.mu.Unlock()
    return ch
}

func (h *SSEHub) Unsubscribe(ch chan []byte) {
    h.mu.Lock()
    delete(h.subscribers, ch)
    close(ch)
    h.mu.Unlock()
}

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

func handleSSE(hub *SSEHub) http.HandlerFunc {
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

        ch := hub.Subscribe()
        defer hub.Unsubscribe(ch)

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
```

### Pattern 3: Embedded Frontend Assets with fs.Sub
**What:** Embed Vite build output into Go binary, use fs.Sub for clean paths
**When to use:** Serving the frontend in production (single binary deployment)
**Example:**
```go
// embed.go
package main

import "embed"

//go:embed web/dist/*
var webFS embed.FS

// In main.go or handler setup:
import "io/fs"

distFS, _ := fs.Sub(webFS, "web/dist")
mux.Handle("GET /", http.FileServerFS(distFS))
```

### Pattern 4: SQLite with WAL Mode and Production PRAGMAs
**What:** Configure SQLite for concurrent read/write under load
**When to use:** Database initialization
**Example:**
```go
import (
    "database/sql"
    _ "modernc.org/sqlite"
)

func openDB(path string) (*sql.DB, error) {
    db, err := sql.Open("sqlite", path)
    if err != nil {
        return nil, err
    }

    // Production PRAGMAs -- set on every connection
    pragmas := []string{
        "PRAGMA journal_mode=WAL",
        "PRAGMA busy_timeout=5000",
        "PRAGMA synchronous=NORMAL",
        "PRAGMA foreign_keys=ON",
    }
    for _, p := range pragmas {
        if _, err := db.Exec(p); err != nil {
            return nil, fmt.Errorf("pragma %s: %w", p, err)
        }
    }

    // Single writer connection -- prevents SQLITE_BUSY
    db.SetMaxOpenConns(1)

    return db, nil
}
```

### Pattern 5: Country Code to Flag Emoji Conversion (Go)
**What:** Convert ISO 3166-1 alpha-2 country code to flag emoji using regional indicator symbols
**When to use:** Building namespace labels (e.g., ns/DE with flag)
**Example:**
```go
// Source: https://dev.to/ionbazan/turn-a-country-code-into-an-emoji-flag-us--360a
func countryCodeToFlag(code string) string {
    code = strings.ToUpper(code)
    var flag strings.Builder
    for _, c := range code {
        flag.WriteRune(rune(c) + 0x1F1A5) // regional indicator offset
    }
    return flag.String()
}
// countryCodeToFlag("DE") => "🇩🇪"
```

### Anti-Patterns to Avoid
- **Default ServeMux:** Never use `http.DefaultServeMux` -- it's a global, any imported package can register handlers. Always create `http.NewServeMux()`.
- **Unbuffered SSE channels:** Sending to an unbuffered channel blocks the broadcaster if a client is slow. Always use buffered channels and drop messages for slow clients.
- **Multiple SQLite writer connections:** SQLite supports only one writer at a time. Setting `MaxOpenConns > 1` with write operations causes `SQLITE_BUSY` errors under load. Use `SetMaxOpenConns(1)` or separate read/write pools.
- **Forgetting to set busy_timeout:** The default busy_timeout is 0, meaning any contention returns `SQLITE_BUSY` immediately. Always set at least 3-5 seconds.
- **Missing `X-Accel-Buffering: no`:** Nginx (common in K8s ingress) buffers responses by default, breaking SSE. This header disables proxy buffering.
- **Not using `fs.Sub` with embedded assets:** Without `fs.Sub`, embedded files are served under their full embed path (e.g., `/web/dist/index.html` instead of `/index.html`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profanity detection | Custom regex/blocklist | `TwiN/go-away` | Handles l33t speak, Unicode tricks, has false positive management (e.g., "assassin" contains "ass") |
| QR code generation | Image manipulation code | `skip2/go-qrcode` | QR encoding is non-trivial (Reed-Solomon error correction, masking patterns) |
| Country list | Manual JSON file | ISO 3166-1 dataset (embed static list in TS) | 249 countries with correct names, codes, maintained by ISO standard |
| Flag emoji from country code | Emoji lookup table | Regional indicator math (see pattern above) | Two-line function, no lookup table needed, works for all ISO codes |
| SQLite migrations | Manual ALTER TABLE | Schema versioning with `user_version` PRAGMA | Simple enough for this project, no ORM needed |
| HTTP testing | Manual net.Listener setup | `net/http/httptest` | Standard library, creates test servers and response recorders |

**Key insight:** The Go standard library covers HTTP, JSON, embedding, testing, and context. The only third-party Go deps are for SQLite access, profanity filtering, and QR generation -- problems where hand-rolling would be error-prone.

## Common Pitfalls

### Pitfall 1: SQLite "database is locked" Under Concurrent Load
**What goes wrong:** 500 concurrent form submissions cause `SQLITE_BUSY` errors
**Why it happens:** SQLite allows only one writer. Default busy_timeout is 0 (fail immediately).
**How to avoid:** Set `PRAGMA busy_timeout=5000`, use `SetMaxOpenConns(1)`, use WAL mode. With 500 submissions over 60 seconds, the write throughput needed is ~8/sec -- well within SQLite's capability (thousands of writes/sec with WAL).
**Warning signs:** "database is locked" errors in logs during load testing.

### Pitfall 2: SSE Connections Accumulating Without Cleanup
**What goes wrong:** Disconnected clients leave goroutines and channels hanging
**Why it happens:** Not detecting client disconnect via `r.Context().Done()`
**How to avoid:** Always `defer hub.Unsubscribe(ch)` in the SSE handler, and select on `r.Context().Done()` in the event loop. The HTTP server cancels the request context when the client disconnects.
**Warning signs:** Goroutine count grows over time; memory leak.

### Pitfall 3: Vite Build Output Not Matching Embed Path
**What goes wrong:** `go:embed web/dist/*` embeds files with `web/dist/` prefix, but browser requests `/index.html`
**Why it happens:** `embed.FS` preserves directory structure from the embed directive
**How to avoid:** Use `fs.Sub(webFS, "web/dist")` to strip the prefix before passing to `http.FileServerFS`.
**Warning signs:** 404s for all frontend assets.

### Pitfall 4: Mobile Keyboard Covering Submit Button
**What goes wrong:** On mobile, the virtual keyboard pushes the submit button off-screen
**Why it happens:** Single-page form with all fields visible; keyboard takes 40-50% of viewport
**How to avoid:** Use `position: sticky; bottom: 0` for the submit button, or ensure the form scrolls naturally. Test with Chrome DevTools device emulation with keyboard simulation.
**Warning signs:** Users can't find or reach the submit button on smaller phones.

### Pitfall 5: SSE Behind Reverse Proxy Buffering
**What goes wrong:** SSE events arrive in batches instead of real-time
**Why it happens:** Nginx, Cloudflare, or K8s ingress controllers buffer HTTP responses
**How to avoid:** Set `X-Accel-Buffering: no` header. Also set `Cache-Control: no-cache` and `Connection: keep-alive`.
**Warning signs:** Events appear delayed or in bursts during testing behind a proxy.

### Pitfall 6: Missing CORS Headers for Development
**What goes wrong:** Vite dev server on port 5173 can't reach Go server on port 8080
**Why it happens:** Browser CORS policy blocks cross-origin requests during development
**How to avoid:** Add CORS middleware to the Go server that allows the Vite dev server origin. In production (embedded assets), CORS is not needed since everything is same-origin.
**Warning signs:** Browser console shows CORS errors during `npm run dev`.

### Pitfall 7: Profanity Filter False Positives on Names
**What goes wrong:** Legitimate names like "Dick" (Richard), "Shittu" (Nigerian name), or "Cockburn" (Scottish surname) are rejected
**Why it happens:** Substring matching catches profanity within legitimate words
**How to avoid:** Use `goaway.NewProfanityDetector().WithExactWord()` to require exact word matches, not substring. Add common name false positives. Accept some risk -- this is a live demo, not a social platform.
**Warning signs:** Real attendees can't submit their actual names.

## Code Examples

### SSE Event Format
```
event: submission
data: {"id":42,"name":"Niklas","country_code":"DE","country_flag":"🇩🇪","homelab_level":3,"homelab_emoji":"🖥️","created_at":"2026-03-20T14:30:00Z"}

```
Note: Two trailing newlines are required by the SSE spec to terminate an event.

### SQLite Schema
```sql
CREATE TABLE IF NOT EXISTS submissions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    country_code  TEXT    NOT NULL,  -- ISO 3166-1 alpha-2 (e.g., "DE")
    homelab_level INTEGER NOT NULL CHECK(homelab_level BETWEEN 1 AND 5),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted       BOOLEAN DEFAULT FALSE  -- soft delete for admin moderation (Phase 3)
);

-- Index for Phase 2 visualization queries (group by country)
CREATE INDEX IF NOT EXISTS idx_submissions_country ON submissions(country_code) WHERE deleted = FALSE;

-- Track schema version
PRAGMA user_version = 1;
```

### Submission API Endpoint
```go
// POST /api/submissions
// Request body:
type SubmitRequest struct {
    Name         string `json:"name"`
    CountryCode  string `json:"country_code"`
    HomelabLevel int    `json:"homelab_level"`
}

// Response (201 Created):
type SubmitResponse struct {
    ID           int64  `json:"id"`
    Name         string `json:"name"`
    CountryCode  string `json:"country_code"`
    CountryFlag  string `json:"country_flag"`
    HomelabLevel int    `json:"homelab_level"`
    HomelabEmoji string `json:"homelab_emoji"`
    CreatedAt    string `json:"created_at"`
}

// Error response (400/422):
type ErrorResponse struct {
    Error   string `json:"error"`
    Field   string `json:"field,omitempty"`  // which field failed validation
}
```

### Preact Form Component Structure
```tsx
// Source: Preact signals pattern from https://preactjs.com/guide/v10/signals/
import { signal } from "@preact/signals";

// Global form state
const formState = signal<"form" | "submitting" | "success">("form");
const submission = signal<SubmitResponse | null>(null);

function App() {
  if (formState.value === "success" && submission.value) {
    return <Confirmation data={submission.value} />;
  }
  return <SubmissionForm />;
}
```

### Country Dropdown with Search/Filter
```tsx
// Approach: filterable <select> with optgroups, or custom dropdown
// European countries first, then alphabetical rest
const europeanCodes = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR",
  "HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK",
  "SI","ES","SE","GB","NO","CH","IS","UA","RS","BA","AL","MK",
  "ME","MD","BY","XK"
]);

// Countries sorted: European first, then rest alphabetically
const sortedCountries = countries.sort((a, b) => {
  const aEU = europeanCodes.has(a.code);
  const bEU = europeanCodes.has(b.code);
  if (aEU && !bEU) return -1;
  if (!aEU && bEU) return 1;
  return a.name.localeCompare(b.name);
});
```

### Homelab Scale Component
```tsx
const levels = [
  { level: 1, emoji: "\u{1F4AD}", label: "What's a homelab?" },
  { level: 2, emoji: "\u{1F353}", label: "A Pi and a dream" },
  { level: 3, emoji: "\u{1F5A5}\uFE0F", label: "The spare laptop era" },
  { level: 4, emoji: "\u{1F5C4}\uFE0F", label: "My partner asks about the electricity bill" },
  { level: 5, emoji: "\u{1F680}", label: "I have an on-call rotation for my house" },
];

function HomelabScale({ value, onChange }: Props) {
  return (
    <div class="homelab-scale">
      <div class="scale-track">
        {levels.map((l) => (
          <button
            type="button"
            class={`scale-option ${value === l.level ? "selected" : ""}`}
            onClick={() => onChange(l.level)}
            aria-label={l.label}
          >
            {l.emoji}
          </button>
        ))}
      </div>
      {value && (
        <p class="scale-description">
          {levels.find((l) => l.level === value)?.label}
        </p>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gorilla/mux or chi for routing | `net/http` enhanced ServeMux | Go 1.22 (Feb 2024) | Method matching + path params in stdlib; no third-party router needed |
| mattn/go-sqlite3 (CGo) | modernc.org/sqlite (pure Go) | ~2022, mature by 2024 | Eliminates CGo dependency, simpler Docker builds, cross-compilation |
| React for small forms | Preact 10.x | Stable since 2020 | 4KB vs 40KB+; identical API via preact/compat if needed |
| Webpack for frontend builds | Vite 8 (Rolldown bundler) | Vite 8 released March 2026 | 10-30x faster builds with Rust-based Rolldown; native ESM dev server |
| preact-cli for scaffolding | Vite + @preact/preset-vite | 2023+ | preact-cli is unmaintained; Vite is the official recommendation |
| Custom SSE from scratch | Still custom (stdlib) | - | No dominant SSE library; stdlib pattern is simple enough |

**Deprecated/outdated:**
- **preact-cli:** Unmaintained, do not use. Use `create vite --template preact-ts` instead.
- **gorilla/mux:** Was archived in 2022, then revived, but Go 1.22+ stdlib makes it unnecessary for simple APIs.
- **http.DefaultServeMux:** Security risk (global, any package can register handlers). Always use `http.NewServeMux()`.

## Open Questions

1. **CSS approach: Pico CSS vs custom?**
   - What we know: Pico CSS is 7.7KB gzipped, provides instant form styling with semantic HTML (no classes needed). Custom CSS would be lighter (~2-3KB) but requires more design work.
   - Recommendation: Use custom lightweight CSS. The form is simple (3 fields + button + confirmation), and Pico's 7.7KB is significant when targeting 50KB total bundle. A few dozen lines of custom CSS with CSS variables for theming is sufficient. Mobile-first, system font stack, minimal styles.

2. **Country list source for frontend?**
   - What we know: Need ~249 countries with ISO alpha-2 codes and English names. Can embed as static TypeScript array.
   - Recommendation: Maintain a static `countries.ts` file with `{code: "DE", name: "Germany"}` entries. Source from ISO 3166-1. No npm package needed for a static list. Server validates submitted codes against the same list.

3. **Duplicate submission prevention?**
   - What we know: Context says "one submission per visitor" but no auth. Can use browser localStorage or a cookie to hide the form after submission. Server-side dedup by IP is fragile (conference WiFi NAT).
   - Recommendation: Client-side localStorage flag. If localStorage has a submission ID, show the confirmation screen directly. This is good enough for a live demo -- determined users can clear storage, but that's acceptable.

4. **Development workflow: Vite proxy or separate servers?**
   - What we know: During development, Vite dev server runs on :5173, Go server on :8080.
   - Recommendation: Configure Vite's `server.proxy` to forward `/api/*` requests to the Go server. This avoids CORS issues during development. In production, Go serves everything from the embedded assets.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Go) | `go test` (stdlib) with `net/http/httptest` |
| Framework (Frontend) | Vitest + @testing-library/preact |
| Config file (Go) | None needed -- `go test ./...` works out of the box |
| Config file (Frontend) | `web/vitest.config.ts` (Wave 0) |
| Quick run command | `go test ./... && cd web && npx vitest run` |
| Full suite command | `go test -race -count=1 ./... && cd web && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUBM-01 | QR code endpoint returns valid PNG | unit | `go test ./server -run TestQRCode -v` | Wave 0 |
| SUBM-02 | Root path serves index.html | unit | `go test ./server -run TestStaticServing -v` | Wave 0 |
| SUBM-03 | POST /api/submissions accepts valid data | unit | `go test ./server -run TestSubmitHandler -v` | Wave 0 |
| SUBM-04 | Invalid country code rejected | unit | `go test ./server -run TestSubmitValidation -v` | Wave 0 |
| SUBM-05 | Homelab level 1-5 accepted, 0 or 6 rejected | unit | `go test ./server -run TestSubmitValidation -v` | Wave 0 |
| SUBM-06 | Successful submission returns 201 with data | unit | `go test ./server -run TestSubmitHandler -v` | Wave 0 |
| SUBM-07 | Profane name rejected with 422 | unit | `go test ./server -run TestProfanityFilter -v` | Wave 0 |
| INFR-04 | Frontend bundle under 50KB gzipped | smoke | `cd web && npx vite build && du -sk dist/` | Wave 0 |

### Sampling Rate
- **Per task commit:** `go test ./... -count=1`
- **Per wave merge:** `go test -race -count=1 ./... && cd web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/handler_test.go` -- covers SUBM-01 through SUBM-07
- [ ] `server/store_test.go` -- covers SQLite persistence
- [ ] `web/vitest.config.ts` -- Vitest configuration for Preact
- [ ] `web/src/components/__tests__/` -- component test directory
- [ ] `Makefile` with `test` target combining Go and frontend tests

## Sources

### Primary (HIGH confidence)
- [Go net/http](https://pkg.go.dev/net/http) - ServeMux routing patterns, Go 1.22+ enhancements
- [Go routing enhancements blog](https://go.dev/blog/routing-enhancements) - Method matching, path variables
- [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) - Pure Go SQLite driver, v1.47.0
- [Go embed package](https://pkg.go.dev/embed) - embed.FS for static assets
- [Preact official docs](https://preactjs.com/guide/v10/getting-started/) - Getting started, signals
- [Preact signals docs](https://preactjs.com/guide/v10/signals/) - State management
- [Vite getting started](https://vite.dev/guide/) - Vite 8 setup, templates
- [TwiN/go-away](https://github.com/TwiN/go-away) - Profanity filter API, false positives
- [skip2/go-qrcode](https://github.com/skip2/go-qrcode) - QR code generation API

### Secondary (MEDIUM confidence)
- [Go 1.26 release](https://go.dev/blog/go1.26) - Current Go version confirmed
- [SSE implementation patterns](https://oneuptime.com/blog/post/2026-01-25-server-sent-events-streaming-go/view) - Flusher pattern, headers
- [SQLite WAL mode](https://sqlite.org/wal.html) - WAL configuration details
- [SQLite concurrent writes](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) - busy_timeout recommendations
- [Preact 11 beta](https://www.infoq.com/news/2025/09/preact-11-beta/) - Version status (use 10.x, not 11 beta)
- [@preact/preset-vite](https://github.com/preactjs/preset-vite) - v2.10.x confirmed

### Tertiary (LOW confidence)
- CSS framework recommendations - based on WebSearch aggregation, sizes self-reported by projects
- Country list ordering - custom recommendation, no standard exists for "European first" ordering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified via official docs and package registries
- Architecture: HIGH - patterns are well-established Go + Preact idioms
- Pitfalls: HIGH - drawn from official SQLite docs, real-world SSE experience, and documented Go patterns
- Frontend sizing (INFR-04): MEDIUM - Preact is 4KB but total bundle depends on implementation choices

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable ecosystem, no major releases expected)
