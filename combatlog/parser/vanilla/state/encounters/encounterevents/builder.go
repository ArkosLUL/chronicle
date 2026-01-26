package encounterevents

import (
	"bytes"
	"encoding/binary"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/gogo/protobuf/proto"
)

type Builder[M messages.Message, PM proto.Message] struct {
	First time.Time
	Data  *bytes.Buffer
}

func NewBuilder[M messages.Message, PM proto.Message]() *Builder[M, PM] {
	return &Builder[M, PM]{
		First: time.Time{},
		Data:  bytes.NewBuffer(nil),
	}
}

func AddToBuilder[M messages.Message, PM proto.Message](b *Builder[M, PM], m M, idx int32, conv func(from time.Time, idx int32, message M) PM) error {
	if b.First.IsZero() {
		b.First = m.Date()
	}

	pm := conv(b.First, idx, m)
	data, err := proto.Marshal(pm)
	if err != nil {
		return err
	}

	var lenBuf [binary.MaxVarintLen64]byte
	n := binary.PutUvarint(lenBuf[:], uint64(len(data)))
	if _, err := b.Data.Write(lenBuf[:n]); err != nil {
		return err
	}
	_, err = b.Data.Write(data)
	if err != nil {
		return err
	}

	return nil

}
