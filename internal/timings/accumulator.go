package timings

import (
	"maps"
	"sync"
	"time"
)

type Accumulator struct {
	data map[string]time.Duration
	mu   sync.Mutex
}

func New() *Accumulator {
	return &Accumulator{
		data: make(map[string]time.Duration),
	}
}

func (t *Accumulator) Add(name string, duration time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if _, exists := t.data[name]; !exists {
		t.data[name] = 0
	}
	t.data[name] += duration
}

func (t *Accumulator) Snapshot() map[string]time.Duration {
	t.mu.Lock()
	defer t.mu.Unlock()
	return maps.Clone(t.data)
}

func Do1[R1 any](acc *Accumulator, name string, f func() R1) R1 {
	start := time.Now()
	r1 := f()
	acc.Add(name, time.Since(start))
	return r1
}

func Do2[R1 any, R2 any](acc *Accumulator, name string, f func() (R1, R2)) (R1, R2) {
	start := time.Now()
	r1, r2 := f()
	acc.Add(name, time.Since(start))
	return r1, r2
}
