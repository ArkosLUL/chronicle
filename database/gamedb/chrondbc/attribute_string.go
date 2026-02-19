package chrondbc

import (
	"fmt"
	"sort"
	"strings"
)

// attributeNames maps each Attribute constant to its string name.
var attributeNames = map[Attribute]string{
	// Block 0: Attributes
	Attr_ProcFailureBurnsCharge:      "ProcFailureBurnsCharge",
	Attr_UsesRangedSlot:              "UsesRangedSlot",
	Attr_OnNextSwing_NO_DAMAGE:       "OnNextSwing_NO_DAMAGE",
	Attr_DoNotLog_IMMUNE_MISSES:      "DoNotLog_IMMUNE_MISSES",
	Attr_IsAbility:                   "IsAbility",
	Attr_IsTradeskill:                "IsTradeskill",
	Attr_Passive:                     "Passive",
	Attr_DoNotDisplay:                "DoNotDisplay",
	Attr_DoNotLog:                    "DoNotLog",
	Attr_HeldItemOnly:                "HeldItemOnly",
	Attr_OnNextSwing:                 "OnNextSwing",
	Attr_WearerCastsProcTrigger:      "WearerCastsProcTrigger",
	Attr_DaytimeOnly:                 "DaytimeOnly",
	Attr_NightOnly:                   "NightOnly",
	Attr_OnlyIndoors:                 "OnlyIndoors",
	Attr_OnlyOutdoors:                "OnlyOutdoors",
	Attr_NotShapeshift:               "NotShapeshift",
	Attr_OnlyStealthed:               "OnlyStealthed",
	Attr_DoNotSheath:                 "DoNotSheath",
	Attr_ScalesWithCreatureLevel:     "ScalesWithCreatureLevel",
	Attr_CancelsAutoAttackCombat:     "CancelsAutoAttackCombat",
	Attr_NoActiveDefense:             "NoActiveDefense",
	Attr_TrackTargetInCastPlayerOnly: "TrackTargetInCastPlayerOnly",
	Attr_AllowCastWhileDead:          "AllowCastWhileDead",
	Attr_AllowWhileMounted:           "AllowWhileMounted",
	Attr_CooldownOnEvent:             "CooldownOnEvent",
	Attr_AuraIsDebuff:                "AuraIsDebuff",
	Attr_AllowWhileSitting:           "AllowWhileSitting",
	Attr_NotInCombatOnlyPeaceful:     "NotInCombatOnlyPeaceful",
	Attr_NoImmunities:                "NoImmunities",
	Attr_HeartbeatResist:             "HeartbeatResist",
	Attr_NoAuraCancel:                "NoAuraCancel",

	// Block 1: AttributesEx
	AttrEx_DismissPet:                  "DismissPet",
	AttrEx_DrainAllPower:               "DrainAllPower",
	AttrEx_Channeled1:                  "Channeled1",
	AttrEx_CantBeRedirected:            "CantBeRedirected",
	AttrEx_Unk4:                        "ExUnk4",
	AttrEx_NotBreakStealth:             "NotBreakStealth",
	AttrEx_Channeled2:                  "Channeled2",
	AttrEx_CantBeReflected:             "CantBeReflected",
	AttrEx_NotInCombatTarget:           "NotInCombatTarget",
	AttrEx_FacingTarget:                "FacingTarget",
	AttrEx_NoThreat:                    "NoThreat",
	AttrEx_DontRefreshDurationOnRecast: "DontRefreshDurationOnRecast",
	AttrEx_FailureBreaksStealth:        "FailureBreaksStealth",
	AttrEx_ToggleFarsight:              "ToggleFarsight",
	AttrEx_ChannelTrackTarget:          "ChannelTrackTarget",
	AttrEx_DispelAurasOnImmunity:       "DispelAurasOnImmunity",
	AttrEx_UnaffectedBySchoolImmune:    "UnaffectedBySchoolImmune",
	AttrEx_UnautocastableByCharmed:     "UnautocastableByCharmed",
	AttrEx_PreventsAnim:                "PreventsAnim",
	AttrEx_CantTargetSelf:              "CantTargetSelf",
	AttrEx_ReqComboPoints:              "ReqComboPoints",
	AttrEx_ThreatOnlyOnMiss:            "ThreatOnlyOnMiss",
	AttrEx_ReqTargetComboPoints:        "ReqTargetComboPoints",
	AttrEx_Unk23:                       "ExUnk23",
	AttrEx_Unk24:                       "ExUnk24",
	AttrEx_Unk25:                       "ExUnk25",
	AttrEx_RequireAllTargets:           "RequireAllTargets",
	AttrEx_ChannelDisplaySpellName:     "ChannelDisplaySpellName",
	AttrEx_DontDisplayInAuraBar:        "DontDisplayInAuraBar",
	AttrEx_EnableAtDodge:               "EnableAtDodge",
	AttrEx_RefundPower:                 "RefundPower",
	AttrEx_Unk31:                       "ExUnk31",

	// Block 2: AttributesExB
	AttrEx2_CanTargetDead:                "CanTargetDead",
	AttrEx2_Unk1:                         "Ex2Unk1",
	AttrEx2_FacingTargetsBack:            "FacingTargetsBack",
	AttrEx2_Unk3:                         "Ex2Unk3",
	AttrEx2_DisplayInStanceBar:           "DisplayInStanceBar",
	AttrEx2_AutorepeatFlag:               "AutorepeatFlag",
	AttrEx2_CantTargetTapped:             "CantTargetTapped",
	AttrEx2_Unk7:                         "Ex2Unk7",
	AttrEx2_Unk8:                         "Ex2Unk8",
	AttrEx2_Unk9:                         "Ex2Unk9",
	AttrEx2_Unk10:                        "Ex2Unk10",
	AttrEx2_HealthFunnel:                 "HealthFunnel",
	AttrEx2_Unk12:                        "Ex2Unk12",
	AttrEx2_Unk13:                        "Ex2Unk13",
	AttrEx2_Unk14:                        "Ex2Unk14",
	AttrEx2_Unk15:                        "Ex2Unk15",
	AttrEx2_TameBeast:                    "TameBeast",
	AttrEx2_NotResetAutoActions:          "NotResetAutoActions",
	AttrEx2_ReqDeadPet:                   "ReqDeadPet",
	AttrEx2_NotNeedShapeshift:            "NotNeedShapeshift",
	AttrEx2_IgnoreLos:                    "IgnoreLos",
	AttrEx2_CantCrit:                     "CantCrit",
	AttrEx2_TriggeredCanTriggerProc:      "TriggeredCanTriggerProc",
	AttrEx2_FoodBuff:                     "FoodBuff",
	AttrEx2_Unk24:                        "Ex2Unk24",
	AttrEx2_Unk25:                        "Ex2Unk25",
	AttrEx2_UnaffectedByAuraSchoolImmune: "UnaffectedByAuraSchoolImmune",
	AttrEx2_Unk27:                        "Ex2Unk27",
	AttrEx2_Unk28:                        "Ex2Unk28",
	AttrEx2_DamageReducedShield:          "DamageReducedShield",
	AttrEx2_NoInitialThreat:              "NoInitialThreat",
	AttrEx2_IsArcaneConcentration:        "IsArcaneConcentration",

	// Block 3: AttributesExC
	AttrEx3_OutOfCombatAttack:          "OutOfCombatAttack",
	AttrEx3_Unk1:                       "Ex3Unk1",
	AttrEx3_Unk2:                       "Ex3Unk2",
	AttrEx3_BlockableSpell:             "BlockableSpell",
	AttrEx3_IgnoreResurrectionTimer:    "IgnoreResurrectionTimer",
	AttrEx3_Unk5:                       "Ex3Unk5",
	AttrEx3_Unk6:                       "Ex3Unk6",
	AttrEx3_StackForDiffCasters:        "StackForDiffCasters",
	AttrEx3_TargetOnlyPlayer:           "TargetOnlyPlayer",
	AttrEx3_TriggeredCanTriggerSpecial: "TriggeredCanTriggerSpecial",
	AttrEx3_MainHand:                   "MainHand",
	AttrEx3_Battleground:               "Battleground",
	AttrEx3_CastOnDead:                 "CastOnDead",
	AttrEx3_DontDisplayChannelBar:      "DontDisplayChannelBar",
	AttrEx3_IsHonorlessTarget:          "IsHonorlessTarget",
	AttrEx3_RangedAttack:               "RangedAttack",
	AttrEx3_SuppressCasterProcs:        "SuppressCasterProcs",
	AttrEx3_SuppressTargetProcs:        "SuppressTargetProcs",
	AttrEx3_AlwaysHit:                  "AlwaysHit",
	AttrEx3_Unk19:                      "Ex3Unk19",
	AttrEx3_DeathPersistent:            "DeathPersistent",
	AttrEx3_Unk21:                      "Ex3Unk21",
	AttrEx3_ReqWand:                    "ReqWand",
	AttrEx3_Unk23:                      "Ex3Unk23",
	AttrEx3_ReqOffhand:                 "ReqOffhand",
	AttrEx3_TreatAsPeriodic:            "TreatAsPeriodic",
	AttrEx3_CanProcFromTriggered:       "CanProcFromTriggered",
	AttrEx3_Unk27:                      "Ex3Unk27",
	AttrEx3_Unk28:                      "Ex3Unk28",
	AttrEx3_IgnoreCasterModifiers:      "IgnoreCasterModifiers",
	AttrEx3_DontDisplayRange:           "DontDisplayRange",
	AttrEx3_Unk31:                      "Ex3Unk31",

	// Block 4: AttributesExD
	AttrEx4_IgnoreResistances:          "IgnoreResistances",
	AttrEx4_ProcOnlyOnCaster:           "ProcOnlyOnCaster",
	AttrEx4_AuraExpiresOffline:         "AuraExpiresOffline",
	AttrEx4_Unk3:                       "Ex4Unk3",
	AttrEx4_Unk4:                       "Ex4Unk4",
	AttrEx4_Unk5:                       "Ex4Unk5",
	AttrEx4_NotStealable:               "NotStealable",
	AttrEx4_CanCastWhileCasting:        "CanCastWhileCasting",
	AttrEx4_IgnoreDamageTakenModifiers: "IgnoreDamageTakenModifiers",
	AttrEx4_TriggerActivate:            "TriggerActivate",
	AttrEx4_SpellVsExtendCost:          "SpellVsExtendCost",
	AttrEx4_Unk11:                      "Ex4Unk11",
	AttrEx4_Unk12:                      "Ex4Unk12",
	AttrEx4_Unk13:                      "Ex4Unk13",
	AttrEx4_DamageDoesntBreakAuras:     "DamageDoesntBreakAuras",
	AttrEx4_Unk15:                      "Ex4Unk15",
	AttrEx4_NotUsableInArena:           "NotUsableInArena",
	AttrEx4_UsableInArena:              "UsableInArena",
	AttrEx4_Unk18:                      "Ex4Unk18",
	AttrEx4_Unk19:                      "Ex4Unk19",
	AttrEx4_NotCheckSelfcastPower:      "NotCheckSelfcastPower",
	AttrEx4_Unk21:                      "Ex4Unk21",
	AttrEx4_Unk22:                      "Ex4Unk22",
	AttrEx4_Unk23:                      "Ex4Unk23",
	AttrEx4_AutoRangedCombatSpell:      "AutoRangedCombatSpell",
	AttrEx4_IsPetScaling:               "IsPetScaling",
	AttrEx4_CastOnlyInOutland:          "CastOnlyInOutland",
	AttrEx4_Unk27:                      "Ex4Unk27",
	AttrEx4_Unk28:                      "Ex4Unk28",
	AttrEx4_Unk29:                      "Ex4Unk29",
	AttrEx4_Unk30:                      "Ex4Unk30",
	AttrEx4_Unk31:                      "Ex4Unk31",
}

// attributesByBlock groups attributes by their block index for efficient lookup.
// Built lazily on first use.
var attributesByBlock [9][]Attribute

func init() {
	for attr := range attributeNames {
		block := attr.Block()
		if block >= 0 && block < 9 {
			attributesByBlock[block] = append(attributesByBlock[block], attr)
		}
	}
}

// String returns the name of the attribute, or a formatted representation if unknown.
func (a Attribute) String() string {
	if name, ok := attributeNames[a]; ok {
		return name
	}
	return fmt.Sprintf("Attribute(block=%d, mask=0x%X)", a.Block(), a.Mask())
}

// String returns a pipe-separated list of all set attributes.
// Skips blocks where the value is 0 for efficiency.
func (sa SpellAttributes) String() string {
	var set []string

	for block := 0; block < 9; block++ {
		// Shortcut: skip if block has no bits set
		if sa[block] == 0 {
			continue
		}

		// Only check attributes in this block
		for _, attr := range attributesByBlock[block] {
			if sa[attr.Block()]&attr.Mask() != 0 {
				set = append(set, attributeNames[attr])
			}
		}
	}

	if len(set) == 0 {
		return "none"
	}
	sort.Strings(set)
	return strings.Join(set, " | ")
}

// SetAttributes returns a slice of all Attributes that are set in this SpellAttributes.
// Useful for iteration. Skips blocks where the value is 0.
func (sa SpellAttributes) SetAttributes() []Attribute {
	var result []Attribute

	for block := 0; block < 9; block++ {
		// Shortcut: skip if block has no bits set
		if sa[block] == 0 {
			continue
		}

		for _, attr := range attributesByBlock[block] {
			if sa[attr.Block()]&attr.Mask() != 0 {
				result = append(result, attr)
			}
		}
	}

	return result
}
