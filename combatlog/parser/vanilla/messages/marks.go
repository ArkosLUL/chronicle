package messages

const (
	MarkTypeBump  MarkType = "bump"
	MarkTypeStart MarkType = "start"
)

type MarkType string

type Mark struct {
	Type MarkType `json:"type"`
	// Reason is for debugging
	Reason string `json:"reason"`
}

type marks map[MarkType]Mark

func (m *marks) MarkActivityStart(reason string) {
	m.MarkAdd(Mark{
		Type:   MarkTypeStart,
		Reason: reason,
	})
}

func (m *marks) MarkActivityBump(reason string) {
	m.MarkAdd(Mark{
		Type:   MarkTypeBump,
		Reason: reason,
	})
}

func (m *marks) MarkAdd(mark Mark) {
	if *m == nil {
		*m = make(map[MarkType]Mark)
	}
	(*m)[mark.Type] = mark
}

func (m *marks) MarksExist() bool {
	return m != nil && len(*m) > 0
}

func (m *marks) MarkHas(markType MarkType) (string, bool) {
	if *m == nil {
		return "", false
	}
	reason, ok := (*m)[markType]
	return reason.Reason, ok
}
