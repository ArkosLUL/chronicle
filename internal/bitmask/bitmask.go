package bitmask

type Bitmask32 uint32

func (b Bitmask32) Has(flag Bitmask32) bool {
	return b&flag != 0
}

type Bitmask64 uint64

func (b Bitmask64) Has(flag Bitmask64) bool {
	return b&flag != 0
}
