package chronparser

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type Matched struct {
	parts []string
	index int
	err   error
}

// TODO: Reuse the same slice
func ParseLine(content string) (time.Time, string, *Matched, error) {
	parts := strings.Split(content, "|")
	if len(parts) < 3 {
		return time.Time{}, "", nil, nil
	}

	unixMilli, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return time.Now(), "", nil, err
	}

	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}

	return time.UnixMilli(unixMilli), parts[1], &Matched{
		parts: parts[2:],
		index: 0,
	}, nil
}

func (m *Matched) Error() error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *Matched) pop() string {
	if m.index >= len(m.parts) {
		m.SetError(errors.New("index out of bounds"))
		return ""
	}
	res := m.parts[m.index]
	m.index++
	return res
}

func (m *Matched) skip() {
	m.index++
}

func (m *Matched) peek() string {
	if m.index >= len(m.parts) {
		return ""
	}
	return m.parts[m.index]
}

func (m *Matched) SetError(err error) {
	if m.err != nil {
		return // Do not override existing error
	}
	m.err = err
}

func parseMatch[T any](m *Matched, f func(string) (T, error)) T {
	res := m.pop()
	p, err := f(res)
	if err != nil {
		m.SetError(err)
	}

	return p
}

func (m *Matched) Guid() guid.GUID {
	return parseMatch(m, guid.FromString)
}

func (m *Matched) OptionalGuid() *guid.GUID {
	return parseMatch(m, func(s string) (*guid.GUID, error) {
		if s == "" || s == "nil" {
			return nil, nil
		}
		id, err := guid.FromString(s)
		if err != nil {
			return nil, err
		}
		return &id, nil
	})
}

func (m *Matched) HitInfo() HitInfo {
	v := m.Uint64()
	return HitInfo(v)
}

func (m *Matched) Uint64() uint64 {
	return parseMatch(m, func(s string) (uint64, error) {
		return strconv.ParseUint(s, 10, 64)
	})
}

func (m *Matched) Int64() int64 {
	return parseMatch(m, func(s string) (int64, error) {
		return strconv.ParseInt(s, 10, 64)
	})
}

func (m *Matched) Int32s() []int32 {
	return parseMatch(m, func(s string) ([]int32, error) {
		parts := strings.Split(s, ",")
		all := make([]int32, 0, len(parts))
		for _, p := range parts {
			v, err := strconv.ParseInt(p, 10, 32)
			if err != nil {
				return nil, err
			}
			all = append(all, int32(v))
		}

		return all, nil
	})
}

func (m *Matched) String() string {
	return m.pop()
}
