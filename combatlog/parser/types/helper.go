package types

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type CompiledRegex interface {
	MatchString(s string) bool
}

type Pattern regexp.Regexp

func FromRegex(re *regexp.Regexp) *Pattern {
	// This was an idea to turn on more strict matching.
	//re = regexp.MustCompile(re.String() + "$")
	p := Pattern(*re)

	return &p
}

func (p *Pattern) Match(content string) (*Matched, bool) {
	matches := p.regexp().FindStringSubmatch(content)
	if matches != nil {
		matches = matches[1:] // Remove the full match
	}
	return &Matched{
		Values: matches,
		Index:  1, // First match is at index 1
	}, matches != nil
}

func (p *Pattern) regexp() *regexp.Regexp {
	return (*regexp.Regexp)(p)
}

type Matched struct {
	Values []string
	Index  int
	errs   []error

	// usingUUIDs & foundYou is a hard coded check to see if "you" or "your" was used
	// in place of the player's name when uuids are involved. This would mean the
	// preprocessor failed to replace "you" with the player's guid.
	usingUUIDs bool
	foundYou   bool
}

func CustomMatch[T any](m *Matched, parser func(string) (T, error)) T {
	return parse(m, parser)
}

func (m *Matched) UnitOrGUID() (string, guid.GUID) {
	val := m.pop()
	if len(val) >= 18 && val[:2] == "0x" {
		gid, err := guid.FromString(val[:18])
		if err != nil {
			m.errs = append(m.errs, err)
			return "", 0
		}
		m.usingUUIDs = true
		return "", gid
	}

	lv := strings.ToLower(val)
	if lv == "you" || lv == "your" {
		m.foundYou = true
	}

	return val, guid.GUID(0)
}

func (m *Matched) Skip()                           { m.pop() }
func (m *Matched) GUID() guid.GUID                 { return parse(m, guid.FromString) }
func (m *Matched) Spell() Spell                    { return parse(m, ParseSpell) }
func (m *Matched) Resource() Resource              { return parse(m, ParseResource) }
func (m *Matched) ResourceChange() ChangeDirection { return parse(m, ParseResourceChange) }
func (m *Matched) HitType() HitType                { return parse(m, ParseHitMask) }
func (m *Matched) ShortHitType() HitType           { return parse(m, ParseHitOrCritShort) }
func (m *Matched) Unit() Unit                      { return parse(m, ParseUnit) }
func (m *Matched) Trailer() Trailer                { return parse(m, ParseTrailer) }
func (m *Matched) School() School                  { return parse(m, ParseSchool) }

func (m *Matched) Rest() []string {
	rest := m.Values[m.Index-1:]
	m.Index = len(m.Values) + 1
	return rest
}

func (m *Matched) String() string {
	return m.pop()
}

func (m *Matched) Int32() int32 {
	val := m.pop()
	v, err := strconv.ParseInt(val, 10, 32)
	if err != nil {
		m.errs = append(m.errs, err)
	}
	return int32(v)
}

func (m *Matched) Uint32() uint32 {
	val := m.pop()
	v, err := strconv.ParseUint(val, 10, 32)
	if err != nil {
		m.errs = append(m.errs, err)
	}
	return uint32(v)
}

func (m *Matched) Error() error {
	var extra error = nil
	if m.usingUUIDs && m.foundYou {
		extra = errors.New("found 'you' or 'your' where a unit name was expected while using UUIDs; preprocessor may have failed to replace 'you' with the player's guid")
	}
	if len(m.errs) == 0 {
		return extra
	}
	return errors.Join(append(m.errs, extra)...)
}

// nolint: unused
func (m *Matched) peek() string {
	if m.Index-1 >= len(m.Values) {
		m.errs = append(m.errs, errors.New("index out of range"))
		return ""
	}
	return m.Values[m.Index-1]
}

func (m *Matched) pop() string {
	if m.Index-1 >= len(m.Values) {
		m.errs = append(m.errs, errors.New("index out of range"))
		return ""
	}
	val := m.Values[m.Index-1]
	m.Index++
	return val
}

func parse[T any](m *Matched, parser func(string) (T, error)) T {
	val := m.pop()
	parsed, err := parser(val)
	if err != nil {
		m.errs = append(m.errs, err)
	}
	return parsed
}
