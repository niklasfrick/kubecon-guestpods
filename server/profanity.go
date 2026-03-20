package server

import (
	"strings"

	goaway "github.com/TwiN/go-away"
)

// ProfanityChecker wraps go-away's profanity detector with false positive handling
// for common names that contain profanity substrings.
type ProfanityChecker struct {
	detector *goaway.ProfanityDetector
}

// falsePosNames contains common names that trigger false positives in substring-based
// profanity detection. These are checked before the detector runs.
var falsePosNames = []string{
	"dick", "fanny", "willy", "shittu", "cockburn", "hancock",
}

// NewProfanityChecker creates a new ProfanityChecker with the default go-away detector.
func NewProfanityChecker() *ProfanityChecker {
	return &ProfanityChecker{
		detector: goaway.NewProfanityDetector(),
	}
}

// IsProfane returns true if the given text contains profanity, accounting for
// known false positive names.
func (p *ProfanityChecker) IsProfane(text string) bool {
	lower := strings.ToLower(text)
	for _, name := range falsePosNames {
		if lower == name {
			return false
		}
	}
	return p.detector.IsProfane(text)
}
