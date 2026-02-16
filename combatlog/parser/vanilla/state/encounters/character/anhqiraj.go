package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

const (
	cthun = 15727
)

func NewCthun(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(cthun,
		15728, // Giant Claw Tentacle
		15802, // Flesh Tentacle
		15726, // Eye Tentacle
		15334, // Giant Eye Tentacle
		bloodSeekerBat)(id, all)
}
