package unitdb

import (
  "github.com/Emyrk/chronicle/combatlog/parser/guid"
  "github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
  "github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
)

type Units struct {
  // TODO: Slain to remove units?
  Info    map[guid.GUID]unitinfo.Info
  Players map[guid.GUID]combatant.Combatant
}

func New() *Units {
  return &Units{
    Info:    make(map[guid.GUID]unitinfo.Info),
    Players: make(map[guid.GUID]combatant.Combatant),
  }
}

func (us *Units) Get(gid guid.GUID) (unitinfo.Info, bool) {
  u, ok := us.Info[gid]
  return u, ok
}

func (us *Units) Update(u unitinfo.Info) {
  us.Info[u.Guid] = u
}

func (us *Units) UpdatePlayer(c combatant.Combatant) {
  us.Players[c.Guid] = c
  // TODO: REMOVE this. It is a crutch because `unit_info` is not perfect.
  if _, ok := us.Info[c.Guid]; !ok {
    us.Update(unitinfo.Info{
      Seen:         c.Seen,
      Guid:         c.Guid,
      IsPlayer:     c.IsMe(),
      Name:         c.Name,
      CanCooperate: true,
      Owner:        nil,
    })
  }
}
