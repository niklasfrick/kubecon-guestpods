package server

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// Store provides SQLite data access for submissions.
type Store struct {
	db *sql.DB
}

// NewStore opens a SQLite database at dbPath with WAL mode and production PRAGMAs,
// creates the submissions table if it does not exist, and returns a Store.
func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
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

	// Create table if not exists
	schema := `
		CREATE TABLE IF NOT EXISTS submissions (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			name          TEXT    NOT NULL,
			country_code  TEXT    NOT NULL,
			homelab_level INTEGER NOT NULL CHECK(homelab_level BETWEEN 1 AND 5),
			created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
			deleted       BOOLEAN DEFAULT FALSE
		);
		CREATE INDEX IF NOT EXISTS idx_submissions_country ON submissions(country_code) WHERE deleted = FALSE;
		PRAGMA user_version = 1;
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("create schema: %w", err)
	}

	return &Store{db: db}, nil
}

// Insert persists a new submission and returns the populated SubmitResponse.
func (s *Store) Insert(req SubmitRequest) (*SubmitResponse, error) {
	result, err := s.db.Exec(
		"INSERT INTO submissions (name, country_code, homelab_level) VALUES (?, ?, ?)",
		req.Name, req.CountryCode, req.HomelabLevel,
	)
	if err != nil {
		return nil, fmt.Errorf("insert submission: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("last insert id: %w", err)
	}

	// Read back the created_at value
	var createdAt string
	err = s.db.QueryRow("SELECT created_at FROM submissions WHERE id = ?", id).Scan(&createdAt)
	if err != nil {
		return nil, fmt.Errorf("read created_at: %w", err)
	}

	return &SubmitResponse{
		ID:           id,
		Name:         req.Name,
		CountryCode:  req.CountryCode,
		CountryFlag:  countryCodeToFlag(req.CountryCode),
		HomelabLevel: req.HomelabLevel,
		HomelabEmoji: HomelabEmojis[req.HomelabLevel],
		CreatedAt:    createdAt,
	}, nil
}

// GetAll returns all non-deleted submissions ordered by created_at ascending.
func (s *Store) GetAll() ([]SubmitResponse, error) {
	rows, err := s.db.Query(
		"SELECT id, name, country_code, homelab_level, created_at FROM submissions WHERE deleted = FALSE ORDER BY created_at ASC",
	)
	if err != nil {
		return nil, fmt.Errorf("query submissions: %w", err)
	}
	defer rows.Close()

	var results []SubmitResponse
	for rows.Next() {
		var resp SubmitResponse
		if err := rows.Scan(&resp.ID, &resp.Name, &resp.CountryCode, &resp.HomelabLevel, &resp.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan submission: %w", err)
		}
		resp.CountryFlag = countryCodeToFlag(resp.CountryCode)
		resp.HomelabEmoji = HomelabEmojis[resp.HomelabLevel]
		results = append(results, resp)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return results, nil
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}
