//go:generate go tool go-enum -f constants.go --nocase --values
package chroniclesdk

// ENUM(damage,heal,resource_change,extra_attack,slain,cast,aura,spell_go,aura_cast,spell_start,spell_fail)
type WoWEventType string
