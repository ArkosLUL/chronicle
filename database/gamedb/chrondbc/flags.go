package chrondbc

type TargetFlags uint32

func (h TargetFlags) Has(flag TargetFlags) bool {
	return h&flag != 0
}

const (
	TargetSelf                TargetFlags = 0x00000000
	TargetSpellDynamic1       TargetFlags = 0x00000001
	TargetUnit                TargetFlags = 0x00000002
	TargetUnitRaid            TargetFlags = 0x00000004
	TargetUnitParty           TargetFlags = 0x00000008
	TargetItem                TargetFlags = 0x00000010
	TargetSourceLocation      TargetFlags = 0x00000020
	TargetDestinationLocation TargetFlags = 0x00000040
	TargetUnitEnemy           TargetFlags = 0x00000080
	TargetUnitAlly            TargetFlags = 0x00000100
	TargetCorpseEnemy         TargetFlags = 0x00000200
	TargetUnitDead            TargetFlags = 0x00000400
	TargetGameObject          TargetFlags = 0x00000800
	TargetTradeItem           TargetFlags = 0x00001000
	TargetNameString          TargetFlags = 0x00002000
	TargetGameObjectItem      TargetFlags = 0x00004000
	TargetCorpseAlly          TargetFlags = 0x00008000
	TargetUnitMinipet         TargetFlags = 0x00010000
	TargetGlyph               TargetFlags = 0x00020000
	TargetDestinationTarget   TargetFlags = 0x00040000
	TargetExtraTargets        TargetFlags = 0x00080000 // 4.x VisualChain
	TargetUnitPassenger       TargetFlags = 0x00100000
	TargetUnk400000           TargetFlags = 0x00400000
	TargetUnk1000000          TargetFlags = 0x01000000
	TargetUnk4000000          TargetFlags = 0x04000000
	TargetUnk10000000         TargetFlags = 0x10000000
	TargetUnk40000000         TargetFlags = 0x40000000
)
