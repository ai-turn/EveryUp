package agent

import (
	"testing"
	"time"
)

func TestTracedServices(t *testing.T) {
	traced := newTracedServices(10 * time.Minute)

	if traced.isTraced("checkout-api") {
		t.Fatal("unmarked service should not be traced")
	}

	traced.MarkTraced("checkout-api")
	if !traced.isTraced("checkout-api") {
		t.Fatal("marked service should be traced")
	}

	// Past the TTL the suppression self-heals and synthetic spans resume.
	if traced.isTracedAt("checkout-api", time.Now().Add(11*time.Minute)) {
		t.Fatal("expired mark should not be traced")
	}
	if traced.isTraced("checkout-api") {
		t.Fatal("expired mark should have been evicted")
	}

	traced.MarkTraced("")
	if traced.isTraced("") {
		t.Fatal("empty service name should never be marked")
	}
}
