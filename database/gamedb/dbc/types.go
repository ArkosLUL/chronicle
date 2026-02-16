package dbc

type School int32

const (
	SchoolNone   School = 0x00
	SchoolHoly   School = 1
	SchoolFire   School = 2
	SchoolNature School = 3
	SchoolFrost  School = 4
	SchoolShadow School = 5
	SchoolArcane School = 6
)

type ProcFlags uint32

func (p ProcFlags) Has(flag ProcFlags) bool {
	return p&flag != 0
}

const (
	ProcFlagNone                         ProcFlags = 0x00000000
	ProcFlagKilled                       ProcFlags = 0x00000001 // 00 Killed by aggressor
	ProcFlagKill                         ProcFlags = 0x00000002 // 01 Kill target (in most cases need XP/Honor reward)
	ProcFlagDoneMeleeAutoAttack          ProcFlags = 0x00000004 // 02 Done melee auto attack
	ProcFlagTakenMeleeAutoAttack         ProcFlags = 0x00000008 // 03 Taken melee auto attack
	ProcFlagDoneSpellMeleeDmgClass       ProcFlags = 0x00000010 // 04 Done attack by Spell that has dmg class melee
	ProcFlagTakenSpellMeleeDmgClass      ProcFlags = 0x00000020 // 05 Taken attack by Spell that has dmg class melee
	ProcFlagDoneRangedAutoAttack         ProcFlags = 0x00000040 // 06 Done ranged auto attack
	ProcFlagTakenRangedAutoAttack        ProcFlags = 0x00000080 // 07 Taken ranged auto attack
	ProcFlagDoneSpellRangedDmgClass      ProcFlags = 0x00000100 // 08 Done attack by Spell that has dmg class ranged
	ProcFlagTakenSpellRangedDmgClass     ProcFlags = 0x00000200 // 09 Taken attack by Spell that has dmg class ranged
	ProcFlagDoneSpellNoneDmgClassPos     ProcFlags = 0x00000400 // 10 Done positive spell that has dmg class none
	ProcFlagTakenSpellNoneDmgClassPos    ProcFlags = 0x00000800 // 11 Taken positive spell that has dmg class none
	ProcFlagDoneSpellNoneDmgClassNeg     ProcFlags = 0x00001000 // 12 Done negative spell that has dmg class none
	ProcFlagTakenSpellNoneDmgClassNeg    ProcFlags = 0x00002000 // 13 Taken negative spell that has dmg class none
	ProcFlagDoneSpellMagicDmgClassPos    ProcFlags = 0x00004000 // 14 Done positive spell that has dmg class magic
	ProcFlagTakenSpellMagicDmgClassPos   ProcFlags = 0x00008000 // 15 Taken positive spell that has dmg class magic
	ProcFlagDoneSpellMagicDmgClassNeg    ProcFlags = 0x00010000 // 16 Done negative spell that has dmg class magic
	ProcFlagTakenSpellMagicDmgClassNeg   ProcFlags = 0x00020000 // 17 Taken negative spell that has dmg class magic
	ProcFlagDonePeriodic                 ProcFlags = 0x00040000 // 18 Successful do periodic (damage / healing)
	ProcFlagTakenPeriodic                ProcFlags = 0x00080000 // 19 Taken spell periodic (damage / healing)
	ProcFlagTakenDamage                  ProcFlags = 0x00100000 // 20 Taken any damage
	ProcFlagDoneTrapActivation           ProcFlags = 0x00200000 // 21 On trap activation
	ProcFlagDoneMainhandAttack           ProcFlags = 0x00400000 // 22 Done main-hand melee attacks (spell and autoattack)
	ProcFlagDoneOffhandAttack            ProcFlags = 0x00800000 // 23 Done off-hand melee attacks (spell and autoattack)
	ProcFlagDeath                        ProcFlags = 0x01000000 // 24 Died in any way
)

