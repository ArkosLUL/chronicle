package encounterevents

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
)

type Events struct {
	Damage         []byte
	Healing        []byte
	ResourceChange []byte
}

func NewEvents() *Events {
	return &Events{
		Damage:         make([]byte, 0),
		Healing:        make([]byte, 0),
		ResourceChange: make([]byte, 0),
	}
}

func (e *Events) Insert(ctx context.Context, db database.Store, instanceID uuid.UUID) error {
	damagePayload, err := gzipData(e.Damage)
	if err != nil {
		return fmt.Errorf("gzip damage events: %w", err)
	}

	healingPayload, err := gzipData(e.Healing)
	if err != nil {
		return fmt.Errorf("gzip healing events: %w", err)
	}

	resourceChangePayload, err := gzipData(e.ResourceChange)
	if err != nil {
		return fmt.Errorf("gzip resource change events: %w", err)
	}

	res := db.InsertLogInstanceEvents(ctx, []database.InsertLogInstanceEventsParams{
		{
			InstanceID: instanceID,
			Type:       database.LogInstanceEventTypeDamage,
			Events:     damagePayload,
		},
		{
			InstanceID: instanceID,
			Type:       database.LogInstanceEventTypeHeal,
			Events:     healingPayload,
		},
		{
			InstanceID: instanceID,
			Type:       database.LogInstanceEventTypeResourceChange,
			Events:     resourceChangePayload,
		},
	})
	if err := res.Close(); err != nil {
		return fmt.Errorf("damage: %w", err)
	}

	return nil
}

func gzipData(data []byte) ([]byte, error) {
	output := bytes.NewBuffer(nil)
	writer := gzip.NewWriter(output)
	n, err := writer.Write(data)
	if err != nil {
		return nil, err
	}
	if n != len(data) {
		return nil, fmt.Errorf("expected to write %v bytes, wrote %v", len(data), n)
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}
