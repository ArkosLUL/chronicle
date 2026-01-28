//go:generate go tool go-enum -f constants.go --nocase --values
package chroniclesdk

// ENUM(damage,heal,resource_change)
type WoWEventType string
