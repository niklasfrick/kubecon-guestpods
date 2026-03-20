package server

import (
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	tmpDir := t.TempDir()
	store, err := NewStore(filepath.Join(tmpDir, "test.db"))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	t.Cleanup(func() { store.Close() })
	return store
}

func TestStoreInsert(t *testing.T) {
	store := newTestStore(t)

	resp, err := store.Insert(SubmitRequest{
		Name:         "Test",
		CountryCode:  "DE",
		HomelabLevel: 3,
	})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if resp.ID <= 0 {
		t.Errorf("expected ID > 0, got %d", resp.ID)
	}
	if resp.CreatedAt == "" {
		t.Error("expected non-empty CreatedAt")
	}
}

func TestStoreInsertReturnsFlag(t *testing.T) {
	store := newTestStore(t)

	resp, err := store.Insert(SubmitRequest{
		Name:         "Test",
		CountryCode:  "DE",
		HomelabLevel: 3,
	})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if resp.CountryFlag == "" {
		t.Error("expected non-empty CountryFlag")
	}
	// DE flag should be regional indicator D + E
	if len(resp.CountryFlag) == 0 {
		t.Error("CountryFlag should contain regional indicator characters")
	}
}

func TestStoreGetAll(t *testing.T) {
	store := newTestStore(t)

	// Insert 2 submissions
	_, err := store.Insert(SubmitRequest{Name: "Alice", CountryCode: "US", HomelabLevel: 1})
	if err != nil {
		t.Fatalf("insert 1: %v", err)
	}
	_, err = store.Insert(SubmitRequest{Name: "Bob", CountryCode: "GB", HomelabLevel: 5})
	if err != nil {
		t.Fatalf("insert 2: %v", err)
	}

	results, err := store.GetAll()
	if err != nil {
		t.Fatalf("get all: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
}

func TestStoreGetAllExcludesDeleted(t *testing.T) {
	store := newTestStore(t)

	resp, err := store.Insert(SubmitRequest{Name: "ToDelete", CountryCode: "FR", HomelabLevel: 2})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	// Manually mark as deleted
	_, err = store.db.Exec("UPDATE submissions SET deleted = TRUE WHERE id = ?", resp.ID)
	if err != nil {
		t.Fatalf("mark deleted: %v", err)
	}

	results, err := store.GetAll()
	if err != nil {
		t.Fatalf("get all: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results after soft-delete, got %d", len(results))
	}
}
