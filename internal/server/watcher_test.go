package server

import (
	"testing"

	"github.com/sotowang/otter/internal/model"
)

func TestWatcherUnsubscribeRemovesSubscriber(t *testing.T) {
	w := NewWatcher()

	ch, unsubscribe := w.Subscribe("prod", "DEFAULT_GROUP", "config.json")
	if ch == nil {
		t.Fatal("expected subscription channel")
	}

	unsubscribe()

	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.subscribers) != 0 {
		t.Fatalf("expected no subscribers after unsubscribe, got %d keys", len(w.subscribers))
	}
}

func TestWatcherNotifyClearsSubscribers(t *testing.T) {
	w := NewWatcher()

	ch1, _ := w.Subscribe("prod", "DEFAULT_GROUP", "config.json")
	ch2, _ := w.Subscribe("prod", "DEFAULT_GROUP", "config.json")

	cfg := &model.Config{
		Namespace: "prod",
		Group:     "DEFAULT_GROUP",
		Key:       "config.json",
	}

	w.Notify(cfg)

	select {
	case got := <-ch1:
		if got != cfg {
			t.Fatal("expected first subscriber to receive config")
		}
	default:
		t.Fatal("expected first subscriber notification")
	}

	select {
	case got := <-ch2:
		if got != cfg {
			t.Fatal("expected second subscriber to receive config")
		}
	default:
		t.Fatal("expected second subscriber notification")
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.subscribers) != 0 {
		t.Fatalf("expected subscribers to be cleared after notify, got %d keys", len(w.subscribers))
	}
}
