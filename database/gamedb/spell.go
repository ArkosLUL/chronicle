package gamedb

// TODO:
// - Icon
// - Name
// - Rank
// - Result (aura, resist, dot/hot, etc) (probably a bitmask)
// - School (magic, physical, etc) (probably a bitmask)
// - Can be blocked? mitigated? etc
// - Description
type Spell struct {
	ID   SpellID
	Name string
	Icon Icon
}
