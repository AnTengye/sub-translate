package providers

import (
	"context"
	"sync"
	"time"
)

// RpmLimiter enforces per-key RPM (requests per minute) limits using a
// sliding window. Each key is a profile+model combination. Limit 0 = no throttling.
type RpmLimiter struct {
	mu      sync.Mutex
	windows map[string]*slidingWindow
}

type slidingWindow struct {
	timestamps []time.Time
}

func NewRpmLimiter() *RpmLimiter {
	return &RpmLimiter{
		windows: make(map[string]*slidingWindow),
	}
}

// Wait blocks until the caller is allowed to proceed under the RPM limit.
func (r *RpmLimiter) Wait(ctx context.Context, key string, limit int) error {
	if limit <= 0 {
		return nil
	}

	for {
		delay := r.tryAcquire(key, limit)
		if delay == 0 {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
}

func (r *RpmLimiter) tryAcquire(key string, limit int) time.Duration {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)

	window, exists := r.windows[key]
	if !exists {
		window = &slidingWindow{}
		r.windows[key] = window
	}

	validStart := 0
	for validStart < len(window.timestamps) && window.timestamps[validStart].Before(cutoff) {
		validStart++
	}
	if validStart > 0 {
		window.timestamps = window.timestamps[validStart:]
	}

	if len(window.timestamps) >= limit {
		waitUntil := window.timestamps[0].Add(time.Minute)
		delay := waitUntil.Sub(now)
		if delay <= 0 {
			window.timestamps = window.timestamps[1:]
			window.timestamps = append(window.timestamps, now)
			return 0
		}
		return delay
	}

	window.timestamps = append(window.timestamps, now)
	return 0
}
