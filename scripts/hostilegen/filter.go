package main

import "strings"

// InstanceCreatures holds the categorised creatures for one instance.
type InstanceCreatures struct {
	Bosses map[uint32]string // entry → name
	Adds   map[uint32]string // entry → name
}

// buildAllInstances produces an InstanceCreatures for every known instance.
func buildAllInstances(
	templates map[uint32]*CreatureTemplate,
	mapCreatures map[uint32]map[uint32]bool,
	encounterBosses map[uint32]bool,
) map[uint32]*InstanceCreatures {
	result := make(map[uint32]*InstanceCreatures)
	for _, inst := range AllInstances {
		creatures := filterInstance(inst.MapID, templates, mapCreatures, encounterBosses)
		if creatures != nil && (len(creatures.Bosses) > 0 || len(creatures.Adds) > 0) {
			result[inst.MapID] = creatures
		}
	}
	return result
}

func filterInstance(
	mapID uint32,
	templates map[uint32]*CreatureTemplate,
	mapCreatures map[uint32]map[uint32]bool,
	encounterBosses map[uint32]bool,
) *InstanceCreatures {
	spawned := mapCreatures[mapID]
	if len(spawned) == 0 {
		return nil
	}

	// Expand the set to include difficulty variants of spawned creatures.
	allEntries := make(map[uint32]bool, len(spawned)*2)
	for entry := range spawned {
		allEntries[entry] = true
		if tmpl := templates[entry]; tmpl != nil {
			for _, de := range tmpl.DifficultyEntries() {
				allEntries[de] = true
			}
		}
	}

	bosses := make(map[uint32]string)
	adds := make(map[uint32]string)

	for entry := range allEntries {
		tmpl := templates[entry]
		if tmpl == nil || tmpl.Name == "" {
			continue
		}

		if isBoss(tmpl, encounterBosses) {
			bosses[entry] = tmpl.Name
			continue
		}

		if shouldIncludeAdd(tmpl) {
			adds[entry] = tmpl.Name
		}
	}

	return &InstanceCreatures{Bosses: bosses, Adds: adds}
}

// isBoss returns true if the creature should be classified as a boss.
func isBoss(tmpl *CreatureTemplate, encounterBosses map[uint32]bool) bool {
	if encounterBosses[tmpl.Entry] {
		return true
	}
	if strings.HasPrefix(tmpl.ScriptName, "boss_") {
		return true
	}
	if tmpl.Rank == 3 { // world-boss / raid-boss rank
		return true
	}
	return false
}

const (
	unitFlagNonAttackable = 0x00000002
	creatureTypeCritter   = 8
	creatureTypeNCPet     = 12
	// NPC flags at bit 4 and above indicate service NPCs
	// (trainer, vendor, repair, flight-master, etc.).
	npcServiceMask = 0xFFFFFFF0
)

// shouldIncludeAdd decides whether a non-boss creature should be included as
// trash/add in the hostiles map.  It intentionally over-includes: Chronicle's
// unknownUnits tracking handles false-positives gracefully.
func shouldIncludeAdd(tmpl *CreatureTemplate) bool {
	// Elite or rare-elite mobs are always interesting.
	if tmpl.Rank >= 1 {
		return true
	}
	// Skip critters and non-combat pets.
	if tmpl.Type == creatureTypeCritter || tmpl.Type == creatureTypeNCPet {
		return false
	}
	// Skip non-attackable units (decoration, triggers, etc.).
	if tmpl.UnitFlags&unitFlagNonAttackable != 0 {
		return false
	}
	// Skip service NPCs (vendor, trainer, repair …).
	if tmpl.NpcFlag&npcServiceMask != 0 {
		return false
	}
	return true
}
