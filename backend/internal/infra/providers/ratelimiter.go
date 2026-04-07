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
	days    map[string]*dailyWindow
}

type slidingWindow struct {
	timestamps []time.Time
}

type dailyWindow struct {
	day        string
	timestamps []time.Time
}

func NewRpmLimiter() *RpmLimiter {
	return &RpmLimiter{
		windows: make(map[string]*slidingWindow),
		days:    make(map[string]*dailyWindow),
	}
}

// Wait blocks until the caller is allowed to proceed under the RPM limit.
func (r *RpmLimiter) Wait(ctx context.Context, key string, rpm int, rpd int) error {
	if rpm <= 0 && rpd <= 0 {
		return nil
	}

	for {
		delay := r.tryAcquire(key, rpm, rpd)
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

func (r *RpmLimiter) tryAcquire(key string, rpm int, rpd int) time.Duration {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	var rpmWindow *slidingWindow
	if rpm > 0 {
		cutoff := now.Add(-time.Minute)
		window, exists := r.windows[key]
		if !exists {
			window = &slidingWindow{}
			r.windows[key] = window
		}
		rpmWindow = window

		validStart := 0
		for validStart < len(window.timestamps) && window.timestamps[validStart].Before(cutoff) {
			validStart++
		}
		if validStart > 0 {
			window.timestamps = window.timestamps[validStart:]
		}

		if len(window.timestamps) >= rpm {
			waitUntil := window.timestamps[0].Add(time.Minute)
			delay := waitUntil.Sub(now)
			if delay > 0 {
				return delay
			}
			window.timestamps = window.timestamps[1:]
		}

	}

	var rpdWindow *dailyWindow
	if rpd > 0 {
		dayKey := now.Format("2006-01-02")
		window, exists := r.days[key]
		if !exists || window.day != dayKey {
			window = &dailyWindow{day: dayKey}
			r.days[key] = window
		}
		rpdWindow = window
		if len(window.timestamps) >= rpd {
			waitUntil := now.Truncate(24 * time.Hour).Add(24 * time.Hour)
			delay := waitUntil.Sub(now)
			if delay > 0 {
				return delay
			}
			window.timestamps = window.timestamps[:0]
		}
	}

	if rpmWindow != nil {
		rpmWindow.timestamps = append(rpmWindow.timestamps, now)
	}
	if rpdWindow != nil {
		rpdWindow.timestamps = append(rpdWindow.timestamps, now)
	}

	return 0
}
