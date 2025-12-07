package vanilla

import (
  "time"

  "github.com/Emyrk/chronicle/combatlog/parser/types/castv2"
)

func OnlyKeepRawV2Casts(ts time.Time, content string) bool {
  _, ok := castv2.IsCast(content)
  if !ok {
    return true // Not a cast, ignore this
  }

  c, err := castv2.ParseCast(content)
  if err != nil {
    return false
  }

  return !c.Caster.Gid.IsZero()
}
