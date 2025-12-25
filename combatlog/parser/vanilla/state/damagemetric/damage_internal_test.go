package damagemetric

import (
	"reflect"
	"testing"
	"time"
)

func TestDamage_InsertEvent_MaintainsSortedOrderAndStability(t *testing.T) {
	base := time.Date(2025, 12, 25, 12, 0, 0, 0, time.UTC)
	t0 := base.Add(0 * time.Second)
	t1 := base.Add(1 * time.Second)
	t2 := base.Add(2 * time.Second)

	d := New()

	// Seed in order
	d.insertEvent(Event{Timestamp: t0, Amount: 1, From: "a"})
	d.insertEvent(Event{Timestamp: t2, Amount: 2, From: "b"})

	// Insert in the middle
	d.insertEvent(Event{Timestamp: t1, Amount: 3, From: "mid"})

	// Insert equal timestamp (should be stable: appended after existing t1)
	d.insertEvent(Event{Timestamp: t1, Amount: 4, From: "mid2"})

	got := []time.Time{
		d.Events[0].Timestamp,
		d.Events[1].Timestamp,
		d.Events[2].Timestamp,
		d.Events[3].Timestamp,
	}
	want := []time.Time{t0, t1, t1, t2}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("timestamps not sorted/stable:\n got: %v\nwant: %v", got, want)
	}

	if d.Events[1].From != "mid" || d.Events[2].From != "mid2" {
		t.Fatalf("equal-timestamp insertion not stable:\n got order: %q then %q", d.Events[1].From, d.Events[2].From)
	}
}

func TestDamage_Range_HappyPath_StartInclusiveEndExclusive(t *testing.T) {
	base := time.Date(2025, 12, 25, 12, 0, 0, 0, time.UTC)
	t0 := base.Add(0 * time.Second)
	t1 := base.Add(1 * time.Second)
	t2 := base.Add(2 * time.Second)
	t3 := base.Add(3 * time.Second)

	d := New()
	// Ensure sorted by using insertEvent
	d.insertEvent(Event{Timestamp: t0, Amount: 10, From: "t0"})
	d.insertEvent(Event{Timestamp: t1, Amount: 11, From: "t1"})
	d.insertEvent(Event{Timestamp: t2, Amount: 12, From: "t2"})
	d.insertEvent(Event{Timestamp: t3, Amount: 13, From: "t3"})

	var got []string
	if err := d.Range(t1, t3, func(e Event) {
		got = append(got, e.From)
	}); err != nil {
		t.Fatalf("Range returned error: %v", err)
	}

	// [start, end) => includes t1,t2 but excludes t3
	want := []string{"t1", "t2"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected range results:\n got: %v\nwant: %v", got, want)
	}
}

func TestDamage_Range_InvalidWindow(t *testing.T) {
	base := time.Date(2025, 12, 25, 12, 0, 0, 0, time.UTC)
	d := New()

	err := d.Range(base, base, func(e Event) {})
	if err == nil {
		t.Fatalf("expected error for start == end, got nil")
	}
}

func TestDamage_Range_NilEach_NoErrorNoPanic(t *testing.T) {
	base := time.Date(2025, 12, 25, 12, 0, 0, 0, time.UTC)
	d := New()

	// Should be a no-op
	if err := d.Range(base, base.Add(time.Second), nil); err != nil {
		t.Fatalf("expected nil error for nil each, got %v", err)
	}
}
