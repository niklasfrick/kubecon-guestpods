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

func TestStoreDelete(t *testing.T) {
	store := newTestStore(t)

	resp, err := store.Insert(SubmitRequest{Name: "DeleteMe", CountryCode: "DE", HomelabLevel: 3})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	if err := store.Delete(resp.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	// Verify it's excluded from GetAll
	results, err := store.GetAll()
	if err != nil {
		t.Fatalf("get all: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results after soft-delete, got %d", len(results))
	}
}

func TestStoreDelete_NonExistent(t *testing.T) {
	store := newTestStore(t)

	err := store.Delete(99999)
	if err == nil {
		t.Fatal("expected error for non-existent ID")
	}
}

func TestStoreGetStats(t *testing.T) {
	store := newTestStore(t)

	// Insert test submissions from different countries
	for _, cc := range []string{"DE", "DE", "US", "GB"} {
		_, err := store.Insert(SubmitRequest{Name: "Test", CountryCode: cc, HomelabLevel: 3})
		if err != nil {
			t.Fatalf("insert: %v", err)
		}
	}

	stats, err := store.GetStats()
	if err != nil {
		t.Fatalf("get stats: %v", err)
	}

	if stats.TotalPods != 4 {
		t.Errorf("expected TotalPods 4, got %d", stats.TotalPods)
	}
	if stats.NamespaceCount != 3 {
		t.Errorf("expected NamespaceCount 3, got %d", stats.NamespaceCount)
	}
	if len(stats.TopLocations) != 3 {
		t.Fatalf("expected 3 top locations, got %d", len(stats.TopLocations))
	}
	// DE should be first with count 2
	if stats.TopLocations[0].CountryCode != "DE" || stats.TopLocations[0].Count != 2 {
		t.Errorf("expected DE with count 2 first, got %s with %d", stats.TopLocations[0].CountryCode, stats.TopLocations[0].Count)
	}
}

func TestStoreConfig_RoundTrip(t *testing.T) {
	store := newTestStore(t)

	if err := store.SetConfig("test_key", "test_value"); err != nil {
		t.Fatalf("set config: %v", err)
	}

	val, err := store.GetConfig("test_key")
	if err != nil {
		t.Fatalf("get config: %v", err)
	}
	if val != "test_value" {
		t.Errorf("expected 'test_value', got '%s'", val)
	}
}

func TestStoreConfig_MissingKey(t *testing.T) {
	store := newTestStore(t)

	val, err := store.GetConfig("nonexistent")
	if err != nil {
		t.Fatalf("get config: %v", err)
	}
	if val != "" {
		t.Errorf("expected empty string for missing key, got '%s'", val)
	}
}
