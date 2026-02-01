- Show relationship to the totem/summoned in the logs. So add a log emit when a totem/summoned enters combat because its owner did.
  - Make it a `summons` log line.
  - `UnitPlayerControlled("unit")`
  - https://github.com/shagu/pfUI/blob/master/libs/libtotem.lua
  - Maybe this log? https://turtle-wow.fandom.com/wiki/API_Events#CHAT_MSG_SPELL_PET_DAMAGE
    - Raw log is just that but guids, maybe we can edit it

- When a `slain` message comes in, attribute the kill to the last damage dealer. Attach this to the slain message for the ui.
  - Track the same pet across multiple summons, even though its guid changes
    - To identify the "same" pet across summons, we could create a stable key like:
      ${owner}-${name} (for named pets like warlock demons)
      ${owner}-${entry} (for generic pets/totems)
- Rotation panel to show casts
  - cancelled/interrupted should also be shown
- Detect out of date super wow, that is missing Raw logs
- Corpse release should be tracked and count as a wipe, but an indicator
- Use https://github.com/otiai10/gosseract to extract server time from video and sync to fights
  - https://github.com/otiai10/ocrserver/wiki/API-Endpoints 
- Sunder panel ASAP or bust
- On the damage panel breakout, we can show damage mitigated by blocks/resists
 - Or damage mitigated panel under "Damage Taken"