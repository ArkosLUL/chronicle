package encounterevents

import (
	"bytes"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
)

type Builder[M messages.Message, PM proto.Message] struct {
	First time.Time
	Count int64

	data *bytes.Buffer
}

func NewBuilder[M messages.Message, PM proto.Message]() *Builder[M, PM] {
	return &Builder[M, PM]{
		First: time.Time{},
		data:  bytes.NewBuffer(nil),
	}
}

// Finalize builds the final byte array for the encounter events.
// Header
// - EncounterID (string bytes)
// - First event timestamp (varint, unix millis)
// - Count of events (varint)
// Body
// - Repeated PM messages
func (b *Builder[M, PM]) Finalize(encounterID uuid.UUID) ([]byte, error) {
	header := make([]byte, 0, 50)

	header = protowire.AppendString(header, encounterID.String())
	header = protowire.AppendVarint(header, uint64(b.First.UnixMilli()))
	header = protowire.AppendVarint(header, uint64(b.Count))

	return append(header, b.data.Bytes()...), nil
}

func AddToBuilder[M messages.Message, PM proto.Message](b *Builder[M, PM], m M, idx int32, conv func(from time.Time, idx int32, message M) PM) error {
	if b.First.IsZero() {
		b.First = m.Date()
	}

	b.Count++
	pm := conv(b.First, idx, m)
	data, err := proto.Marshal(pm)
	if err != nil {
		return err
	}

	prefix := protowire.AppendVarint([]byte{}, uint64(len(data)))

	_, err = b.data.Write(prefix)
	if err != nil {
		return err
	}

	_, err = b.data.Write(data)
	if err != nil {
		return err
	}

	return nil
}
