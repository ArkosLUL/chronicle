package encounterevents

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/gogo/protobuf/proto"
	"github.com/google/uuid"
)

type Builder[M messages.Message, PM proto.Message] struct {
	First time.Time
	Count int64

	data *proto.Buffer
}

func NewBuilder[M messages.Message, PM proto.Message]() *Builder[M, PM] {
	return &Builder[M, PM]{
		First: time.Time{},
		data:  proto.NewBuffer(nil),
	}
}

func (b *Builder[M, PM]) Finalize(encounterID uuid.UUID) ([]byte, error) {
	header := proto.NewBuffer(nil)
	err := header.EncodeStringBytes(encounterID.String())
	if err != nil {
		return nil, err
	}

	err = header.EncodeVarint(uint64(b.First.UnixMilli()))
	if err != nil {
		return nil, err
	}

	err = header.EncodeVarint(uint64(b.Count))
	if err != nil {
		return nil, err
	}

	return b.data.Bytes(), nil
}

func AddToBuilder[M messages.Message, PM proto.Message](b *Builder[M, PM], m M, idx int32, conv func(from time.Time, idx int32, message M) PM) error {
	if b.First.IsZero() {
		b.First = m.Date()
	}

	pm := conv(b.First, idx, m)
	err := b.data.EncodeMessage(pm)
	if err != nil {
		return err
	}

	return nil
}
