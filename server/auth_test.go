package server

import (
	"testing"
	"time"
)

func TestSessionStore_CreateReturnsToken(t *testing.T) {
	store := NewSessionStore()
	token := store.Create(1 * time.Hour)
	if token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestSessionStore_ValidReturnsTrueForValidToken(t *testing.T) {
	store := NewSessionStore()
	token := store.Create(1 * time.Hour)
	if !store.Valid(token) {
		t.Error("expected token to be valid")
	}
}

func TestSessionStore_ValidReturnsFalseForUnknownToken(t *testing.T) {
	store := NewSessionStore()
	if store.Valid("unknown-token-abc") {
		t.Error("expected unknown token to be invalid")
	}
}

func TestSessionStore_ValidReturnsFalseForExpiredToken(t *testing.T) {
	store := NewSessionStore()
	// Create with zero duration so it expires immediately
	token := store.Create(0)
	time.Sleep(1 * time.Millisecond)
	if store.Valid(token) {
		t.Error("expected expired token to be invalid")
	}
}

func TestCheckPassword_Matching(t *testing.T) {
	if !CheckPassword("secret123", "secret123") {
		t.Error("expected matching passwords to return true")
	}
}

func TestCheckPassword_NonMatching(t *testing.T) {
	if CheckPassword("wrong", "secret123") {
		t.Error("expected non-matching passwords to return false")
	}
}
